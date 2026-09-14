# Backend deployment on Vercel

Create a separate Vercel project for this directory. If importing a repository
containing both apps, set Root Directory to `backend`; if importing this backend
repository alone, leave Root Directory as `.`.

Use the Express preset (auto-detection), Node.js 24.x, `npm ci`, and
`npm run build`. Leave Output Directory at the framework default. `src/app.ts`
exports Express directly; Vercel does not need `npm start`, a port listener,
`src/server.ts`, or a permanently running process.

## Configure before deployment

Copy the variable NAMES from `.env.example` into Vercel's environment settings.
Set Production and Preview separately; use a separate database/storage for previews.
Never upload the local `.env` or expose database credentials with NEXT_PUBLIC_.

Required:

- `NODE_ENV=production`
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: an externally hosted
  MySQL database reachable from Vercel. Keep the existing database if appropriate.
- `DB_CONNECTION_LIMIT=2`: per function instance, not a global pool limit.
- `DB_SSL=true` and optional `DB_SSL_CA` if your database provider supports TLS.
- `JWT_SECRET`: a unique random value at least 32 characters long. Generate one
  locally with `openssl rand -hex 32`; keep it private.
- `CORS_ORIGIN`: the exact frontend HTTPS origin.
- `BLOB_READ_WRITE_TOKEN`: connect a **public Vercel Blob** store to this project.
- `BLOB_PUBLIC_BASE_URL`: that store's public HTTPS origin, without a path.

Uploads travel directly from an authenticated admin's browser to Blob. The API
checks the uploaded object's origin, path, MIME type and size before saving its
URL. Announcements and sermon audio are public, matching the current website.
Local development still supports disk uploads. Existing files in `uploads/`
are NOT moved automatically: copy them into Blob and update their database URLs
before relying on those older attachments/audio in production. No existing
content or remote database is changed by this deployment preparation.

Before deploying to a new database, run `npm run migrate` from a trusted local
terminal with that database's configuration. Never run migrations or seeds in
the Vercel build command. Existing administrator records remain valid. For a
brand-new database, review `src/seeds/seed.ts` before using the seed command.

## Optional services

For push notifications, supply VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT;
set the same public key as NEXT_PUBLIC_VAPID_PUBLIC_KEY in the frontend. Push
promises are registered with Vercel waitUntil so they can finish after responses.

The website uses Facebook embeds by default and needs no Facebook credentials.
Legacy polling is NOT automatically scheduled on Vercel. If you enable the old
API feed, configure an external scheduler to GET `/api/cron/facebook` with
`Authorization: Bearer <CRON_SECRET>`. Choose a schedule allowed by your plan;
node-cron runs only on the local server entrypoint.

The in-memory rate limiter is best-effort per instance. For strict global abuse
limits, configure platform firewall rules or a shared rate-limit store.

## Release checks

1. Deploy backend; visit `https://your-backend.vercel.app/api/health`.
2. Configure and deploy the frontend following its DEPLOYMENT.md.
3. Ensure backend Deployment Protection permits requests from the frontend proxy
   and Blob callbacks. Do not remove the API's administrator authentication.
4. On the FRONTEND origin test login, reload the admin, then log out.
5. Submit a contact message and confirm it in the admin inbox.
6. Create a test attachment and an audio sermon; verify playback/download after a
   redeploy. This validates external storage rather than temporary local disk.
7. Check events, the harvest page, and Facebook embeds.

Local validation: `npm run build` and `node --test tests/*.test.cjs`.
The Blob integration requires a connected store for a real end-to-end upload test.
