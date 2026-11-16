# Store activity setup

The repository previously had no activity database. Existing install counts cannot be converted into historical usage.

1. Create an Upstash Redis database and set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in the hosting environment. Use the read/write REST token, not the read-only token.
2. Set `ACTIVITY_PUBLIC_URL` to the public HTTPS app origin and `ACTIVITY_DASHBOARD_PASSWORD` to a long random password. Keep all four variables server-only. The existing Shopify app secret signs storefront signals.
3. Deploy the web app, including its updated privacy policy, and release the updated theme extension with Shopify CLI. No new Shopify scopes are needed.
4. Open `/internal/activity` on the deployed app. Sign in with username `admin` and the configured password. Never put the password in a URL or share it with merchants.
5. Open the app in a test store: its last-opened timestamp should appear. Publish a cursor, enable the embed, save the theme, and load the live storefront on a desktop. Refresh the owner dashboard to see its last storefront load. Theme editor previews and coarse-pointer devices are excluded.

The dashboard shows stores observed after deployment, not all installations. App opens are authenticated through the existing Shopify session-token flow. Publishing saves a signed storefront endpoint in the existing app-owned config; existing stores must publish again to start storefront signals. This does not require enabling the embed again if it is already enabled.

The endpoint expires 90 days after publishing; publishing again renews it. The dashboard must not be treated as a definitive current embed-enabled check. Missing signals can mean an expired endpoint, no desktop traffic, blockers, or missing configuration. Storefront signals are public and replayable within their validity window, so they are approximate adoption signals, not billing or security evidence. The server accepts at most one signal per store per minute and stores only the latest time.

Records expire after 90 days without activity. The shop-redaction webhook removes stored activity and its index entry; storage errors cause webhook retries. Activity failures do not block cursor loading or publishing. With storage unset, app activity is a no-op and no new storefront tracking URL is issued. Do not remove database credentials before processing pending deletion requests.

Verification: `npm run build`, `npx tsc --noEmit`, and `node --experimental-strip-types --test tests/activity.test.mjs`. Integration tests use a mock REST service; repeat step 5 against the real configured service after deployment.
