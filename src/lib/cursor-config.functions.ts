import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  CURSOR_FILE_PREFIX,
  CURSOR_IMAGE_MAX_BYTES,
  CURSOR_IMAGE_TYPES,
  CURSOR_METAFIELD,
  cursorConfigSchema,
  type CursorConfig,
  type CursorImage,
} from "@/lib/cursor-config";
import { adminClientFromSessionToken, type AdminClient } from "@/lib/shopify-admin";

type UserError = { field?: string[] | null; message: string };

function throwUserErrors(errors: UserError[] | undefined) {
  if (errors?.length) throw new Error(errors.map((error) => error.message).join(", "));
}

const APP_INSTALLATION_QUERY = `#graphql
  query CursorConfig($namespace: String!, $key: String!) {
    currentAppInstallation {
      id
      metafield(namespace: $namespace, key: $key) { jsonValue }
    }
  }`;

async function readInstallation(admin: AdminClient) {
  const data = await admin.graphql<{
    currentAppInstallation: { id: string; metafield: { jsonValue: unknown } | null };
  }>(APP_INSTALLATION_QUERY, CURSOR_METAFIELD);
  return data.currentAppInstallation;
}

const sessionInput = z.object({ idToken: z.string().min(1) });

export const loadCursorConfig = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessionInput.parse(input))
  .handler(async ({ data }): Promise<CursorConfig | null> => {
    const admin = await adminClientFromSessionToken(data.idToken);
    const installation = await readInstallation(admin);
    const parsed = cursorConfigSchema.safeParse(installation.metafield?.jsonValue);
    return parsed.success ? parsed.data : null;
  });

const METAFIELDS_SET = `#graphql
  mutation SaveCursorConfig($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }`;

export const saveCursorConfig = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessionInput.extend({ config: cursorConfigSchema }).parse(input))
  .handler(async ({ data }): Promise<CursorConfig> => {
    const admin = await adminClientFromSessionToken(data.idToken);
    const installation = await readInstallation(admin);
    const result = await admin.graphql<{ metafieldsSet: { userErrors: UserError[] } }>(
      METAFIELDS_SET,
      {
        metafields: [
          {
            ownerId: installation.id,
            ...CURSOR_METAFIELD,
            type: "json",
            value: JSON.stringify(data.config),
          },
        ],
      },
    );
    throwUserErrors(result.metafieldsSet.userErrors);
    return data.config;
  });

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StageCursorImage($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets { url resourceUrl parameters { name value } }
      userErrors { field message }
    }
  }`;

const FILE_CREATE = `#graphql
  mutation CreateCursorFile($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files { id }
      userErrors { field message }
    }
  }`;

const FILE_URL_QUERY = `#graphql
  query CursorFileUrl($id: ID!) {
    node(id: $id) {
      ... on MediaImage { fileStatus image { url } }
      ... on GenericFile { fileStatus url }
    }
  }`;

type FileNode = { fileStatus?: string; url?: string | null; image?: { url: string } | null } | null;

const uploadInput = sessionInput.extend({
  filename: z.string().min(1).max(200),
  mimeType: z.enum(CURSOR_IMAGE_TYPES),
  dataBase64: z.string().min(1),
});

/** Prefixes uploads so "My uploads" can find the app's images with `filename:cursorforge-*`. */
function cursorFilename(filename: string) {
  const safe =
    filename
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+/, "") || "cursor.png";
  return safe.startsWith(CURSOR_FILE_PREFIX) ? safe : `${CURSOR_FILE_PREFIX}${safe}`;
}

/** Uploads a cursor image to the shop's Files and returns its file id and CDN URL. */
export const uploadCursorImage = createServerFn({ method: "POST" })
  .validator((input: unknown) => uploadInput.parse(input))
  .handler(async ({ data }): Promise<CursorImage> => {
    const bytes = Buffer.from(data.dataBase64, "base64");
    if (bytes.byteLength > CURSOR_IMAGE_MAX_BYTES)
      throw new Error("Cursor image must be 1 MB or smaller");

    const admin = await adminClientFromSessionToken(data.idToken);
    const filename = cursorFilename(data.filename);
    // SVGs aren't accepted as media images, so they're stored as generic files.
    const isSvg = data.mimeType === "image/svg+xml";

    const staged = await admin.graphql<{
      stagedUploadsCreate: {
        stagedTargets: Array<{
          url: string;
          resourceUrl: string;
          parameters: Array<{ name: string; value: string }>;
        }>;
        userErrors: UserError[];
      };
    }>(STAGED_UPLOADS_CREATE, {
      input: [
        {
          filename,
          mimeType: data.mimeType,
          resource: isSvg ? "FILE" : "IMAGE",
          httpMethod: "POST",
        },
      ],
    });
    throwUserErrors(staged.stagedUploadsCreate.userErrors);
    const target = staged.stagedUploadsCreate.stagedTargets[0];
    if (!target) throw new Error("Shopify returned no upload target");

    const form = new FormData();
    for (const { name, value } of target.parameters) form.append(name, value);
    form.append("file", new Blob([bytes], { type: data.mimeType }), filename);
    const upload = await fetch(target.url, { method: "POST", body: form });
    if (!upload.ok) throw new Error(`Image upload failed (${upload.status})`);

    const created = await admin.graphql<{
      fileCreate: { files: Array<{ id: string }>; userErrors: UserError[] };
    }>(FILE_CREATE, {
      files: [
        {
          originalSource: target.resourceUrl,
          contentType: isSvg ? "FILE" : "IMAGE",
          alt: "CursorForge cursor",
        },
      ],
    });
    throwUserErrors(created.fileCreate.userErrors);
    const fileId = created.fileCreate.files[0]?.id;
    if (!fileId) throw new Error("Shopify did not create the file");

    // Files are processed asynchronously; wait until the CDN URL is available.
    for (let attempt = 0; attempt < 15; attempt++) {
      const { node } = await admin.graphql<{ node: FileNode }>(FILE_URL_QUERY, { id: fileId });
      if (node?.fileStatus === "FAILED") throw new Error("Shopify could not process the image");
      const url = node?.image?.url ?? node?.url;
      if (node?.fileStatus === "READY" && url) return { id: fileId, url };
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Timed out waiting for Shopify to process the image");
  });

const CURSOR_FILES_QUERY = `#graphql
  query CursorFiles($query: String!) {
    files(first: 50, query: $query, sortKey: CREATED_AT, reverse: true) {
      nodes {
        id
        fileStatus
        ... on MediaImage { image { url } }
        ... on GenericFile { url }
      }
    }
  }`;

/** Lists the cursor images this app uploaded to the shop's Files, newest first. */
export const listCursorImages = createServerFn({ method: "POST" })
  .validator((input: unknown) => sessionInput.parse(input))
  .handler(async ({ data }): Promise<CursorImage[]> => {
    const admin = await adminClientFromSessionToken(data.idToken);
    const result = await admin.graphql<{
      files: { nodes: Array<{ id: string } & NonNullable<FileNode>> };
    }>(CURSOR_FILES_QUERY, { query: `filename:${CURSOR_FILE_PREFIX}*` });
    return result.files.nodes.flatMap((node) => {
      const url = node.image?.url ?? node.url;
      return node.fileStatus === "READY" && url ? [{ id: node.id, url }] : [];
    });
  });

const FILE_DELETE = `#graphql
  mutation DeleteCursorFile($fileIds: [ID!]!) {
    fileDelete(fileIds: $fileIds) {
      deletedFileIds
      userErrors { field message }
    }
  }`;

/** Image URLs the published cursor uses; those files must not be deleted. */
function publishedImageUrls(config: CursorConfig | null) {
  if (!config) return new Set<string>();
  const designs = [
    config,
    ...Object.values(config.states).map((state) => (state.mode === "custom" ? state.design : null)),
  ];
  return new Set(designs.flatMap((design) => (design?.image_url ? [design.image_url] : [])));
}

/** Deletes one of the app's cursor images, unless the published cursor still uses it. */
export const deleteCursorImage = createServerFn({ method: "POST" })
  .validator((input: unknown) =>
    sessionInput.extend({ fileId: z.string().startsWith("gid://shopify/") }).parse(input),
  )
  .handler(async ({ data }): Promise<void> => {
    const admin = await adminClientFromSessionToken(data.idToken);
    const [images, installation] = await Promise.all([
      admin.graphql<{ files: { nodes: Array<{ id: string } & NonNullable<FileNode>> } }>(
        CURSOR_FILES_QUERY,
        {
          query: `filename:${CURSOR_FILE_PREFIX}*`,
        },
      ),
      readInstallation(admin),
    ]);
    // Only files this app uploaded can be deleted.
    const file = images.files.nodes.find((node) => node.id === data.fileId);
    if (!file) throw new Error("That image isn't one of your CursorForge uploads");
    const parsed = cursorConfigSchema.safeParse(installation.metafield?.jsonValue);
    const url = file.image?.url ?? file.url;
    if (url && publishedImageUrls(parsed.success ? parsed.data : null).has(url)) {
      throw new Error(
        "This image is used by your published cursor. Publish a different design first.",
      );
    }
    const result = await admin.graphql<{ fileDelete: { userErrors: UserError[] } }>(FILE_DELETE, {
      fileIds: [data.fileId],
    });
    throwUserErrors(result.fileDelete.userErrors);
  });
