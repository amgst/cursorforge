import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy | CursorForge" },
      {
        name: "description",
        content: "How CursorForge handles merchant, store, and customer information.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: PrivacyPolicy,
});

const sections = [
  ["information", "Information we process"],
  ["use", "How we use information"],
  ["sharing", "Sharing and service providers"],
  ["retention", "Storage and retention"],
  ["rights", "Your rights"],
  ["security", "Security"],
  ["changes", "Changes to this policy"],
  ["contact", "Contact"],
] as const;

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-workshop text-foreground">
      <header className="border-b border-border bg-panel/95">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 text-sm font-semibold">
            <ArrowLeft size={16} aria-hidden="true" />
            CursorForge
          </Link>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase text-mint">
            <ShieldCheck size={15} aria-hidden="true" />
            Privacy
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-6 sm:py-14 lg:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-8 lg:self-start" aria-label="Privacy policy sections">
          <p className="font-mono text-[10px] uppercase text-sun">Policy index</p>
          <nav className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:items-start lg:overflow-visible">
            {sections.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {label}
              </a>
            ))}
          </nav>
        </aside>

        <article className="min-w-0 max-w-3xl">
          <div className="border-b border-border pb-8">
            <p className="font-mono text-[10px] uppercase text-mint">
              Effective September 29, 2026
            </p>
            <h1 className="mt-3 text-4xl font-bold sm:text-5xl">Privacy Policy</h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
              CursorForge helps Shopify merchants design and publish custom cursors to their
              storefronts. This policy explains what information the app processes, why it is
              needed, and the choices available to merchants and their customers.
            </p>
          </div>

          <PolicySection id="information" title="Information we process">
            <p>CursorForge processes only the information needed to provide the app:</p>
            <ul>
              <li>
                <strong>Shop information.</strong> Shopify supplies the shop domain and a temporary
                session token so the app can authenticate the merchant and act on the correct shop.
              </li>
              <li>
                <strong>Cursor designs.</strong> Design settings, including colors, sizes, hotspots,
                cursor states, and trail preferences, are saved to app-owned Shopify data associated
                with the installation.
              </li>
              <li>
                <strong>Uploaded files.</strong> Cursor images a merchant uploads or draws are saved
                to that merchant&apos;s Shopify Files library.
              </li>
              <li>
                <strong>Browser storage.</strong> When storefront shopping features are used, the
                browser can store cart identifiers and cart contents locally so the cart persists
                between page visits.
              </li>
              <li>
                <strong>Technical data.</strong> Hosting systems may process standard request data,
                such as IP address, browser type, timestamps, and error logs, to operate and secure
                the service.
              </li>
            </ul>
            <p>
              CursorForge does not request access to Shopify customer records and does not maintain
              a separate customer database. Checkout and payment information is handled by Shopify,
              not CursorForge.
            </p>
          </PolicySection>

          <PolicySection id="use" title="How we use information">
            <p>We use the information described above to:</p>
            <ul>
              <li>authenticate merchants and connect the app to the correct Shopify shop;</li>
              <li>create, preview, save, and publish cursor designs;</li>
              <li>upload, display, and remove merchant-selected cursor files;</li>
              <li>provide cart continuity and direct shoppers to Shopify checkout; and</li>
              <li>maintain security, diagnose errors, and prevent misuse.</li>
            </ul>
            <p>
              We do not sell personal information or use it for cross-context behavioral
              advertising.
            </p>
          </PolicySection>

          <PolicySection id="sharing" title="Sharing and service providers">
            <p>
              Information is processed through Shopify to provide authentication, app data, file
              storage, storefront cart, and checkout functions. Our hosting infrastructure may also
              process limited technical data needed to serve and protect the app. We do not disclose
              information to unrelated third parties except when required by law, to protect rights
              and safety, or as part of a business transfer subject to appropriate safeguards.
            </p>
            <p>
              Shopify&apos;s own handling of information is governed by its privacy terms and the
              merchant&apos;s agreement with Shopify.
            </p>
          </PolicySection>

          <PolicySection id="retention" title="Storage and retention">
            <p>
              Cursor configuration remains associated with the app installation until it is
              replaced, removed, or the app is uninstalled. Uploaded cursor images remain in the
              merchant&apos;s Shopify Files library and can be removed by the merchant. Local cart
              data remains in the shopper&apos;s browser until it is cleared or replaced. Technical
              logs are retained only as long as reasonably needed for security, troubleshooting, and
              legal obligations.
            </p>
          </PolicySection>

          <PolicySection id="rights" title="Your rights">
            <p>
              Depending on location, individuals may have rights to access, correct, delete,
              restrict, or obtain a copy of personal information, or to object to certain
              processing. Merchants can change or remove cursor settings and uploaded files through
              CursorForge and Shopify. Store customers should first contact the merchant whose store
              they visited. Shopify can then send the required data access or deletion request to
              installed apps.
            </p>
          </PolicySection>

          <PolicySection id="security" title="Security">
            <p>
              We use reasonable administrative and technical measures designed to protect
              information, including Shopify session authentication, verified webhook signatures,
              scoped API access, and encrypted HTTPS connections. No internet service can guarantee
              absolute security.
            </p>
          </PolicySection>

          <PolicySection id="changes" title="Changes to this policy">
            <p>
              We may update this policy when the app, our practices, or legal requirements change.
              The effective date at the top of this page identifies the latest version. Material
              changes will be communicated through an appropriate app or listing notice when
              required.
            </p>
          </PolicySection>

          <PolicySection id="contact" title="Contact">
            <p>
              For privacy questions or requests, contact the CursorForge developer using the support
              contact provided on the CursorForge Shopify App Store listing. Please include the shop
              domain and enough detail to identify and respond to the request. Do not send
              passwords, payment details, or other unnecessary sensitive information.
            </p>
          </PolicySection>
        </article>
      </main>
    </div>
  );
}

function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-8 border-b border-border py-8 text-sm leading-7 text-muted-foreground last:border-b-0"
    >
      <h2 className="mb-4 text-xl font-semibold text-foreground">{title}</h2>
      <div className="space-y-4 [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
