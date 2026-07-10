This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Google Drive Integration Setup

Each agency connects their own Google Drive (per-agency OAuth). To enable the
integration on a deployment you must register a Google OAuth client:

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project, e.g. **RoundTrack Pro**
3. Enable the **Google Drive API**
4. **OAuth consent screen** → External → add scopes `drive.file` and `userinfo.email`
5. **Credentials → Create OAuth 2.0 Client ID → Web application**
6. Add Authorized redirect URIs:
   - `https://roundtrackpro.com/api/google-drive/callback` (production)
   - `http://localhost:3000/api/google-drive/callback` (dev)
7. Copy the **Client ID** + **Client Secret** into `.env.local` and Vercel:

```bash
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Agencies then connect from **Settings → Documents → Connect Google Drive**.

## Environment Variables (Vercel)

All variables from `.env.example` must be set in the Vercel project. Notable ones
added recently:

- `ADMIN_PASSWORD` — super-admin password for `/admin` (separate from user auth)
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google Drive OAuth (above)

Remember: changing a Vercel env var only takes effect on the **next deployment**.

## Database Migrations

SQL migrations live in `supabase/migrations/`. Run new files in the Supabase SQL
Editor in order. The latest are `011_signature_and_onboarding.sql` and
`012_google_drive.sql`.

## Deploy on Vercel

The production branch is `main`. Local development happens on `master`; deploy with
`git push origin master:main`.

Check out the [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
