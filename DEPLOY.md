# Deploying to Cloudflare Pages via GitHub Actions

The site is static. Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. regenerates `llms-full.txt` from `api/*.json` (`node build.mjs`),
2. assembles the public files into `dist/`,
3. deploys `dist/` to Cloudflare Pages with Wrangler.

Do the one-time setup below once; after that, `git push` deploys.

## 1. Create the GitHub repository
The `gh` CLI isn't installed, so create it in the browser:

1. https://github.com/new → name it (e.g. `haithamzedan.com`). Public or private both work with Cloudflare.
2. Do **not** let GitHub add a README/.gitignore — this repo already has them.
3. Push (the local repo is already committed on `main`):
   ```bash
   git remote add origin https://github.com/HaithamZedan1/<repo>.git
   git push -u origin main
   ```

## 2. Create the Cloudflare Pages project (one time)
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Upload assets** (Direct Upload).
2. Name it **`haithamzedan`** — this must match `--project-name` in the workflow.
3. Set the production branch to `main`. (CLI alternative: `npx wrangler pages project create haithamzedan --production-branch=main`)

## 3. Get your Cloudflare credentials
- **Account ID:** dashboard → **Workers & Pages** → right sidebar, "Account ID".
- **API token:** https://dash.cloudflare.com/profile/api-tokens → **Create Token** → template **"Edit Cloudflare Pages"** (or a custom token with `Account › Cloudflare Pages › Edit`). Copy it.

## 4. Add the secrets to GitHub
Repo → **Settings → Secrets and variables → Actions → New repository secret**:
- `CLOUDFLARE_API_TOKEN` = the token from step 3
- `CLOUDFLARE_ACCOUNT_ID` = your account ID

## 5. Deploy
Push to `main`, or go to the **Actions** tab → this workflow → **Run workflow**. When it's green, the site is live at `https://haithamzedan.pages.dev/`.

## 6. Connect your domain
Pages project → **Custom domains** → **Set up a domain** → `haithamzedan.com` (add `www` too if you like).
- DNS on Cloudflare → the record is added for you.
- DNS elsewhere → add the CNAME the dashboard shows, at your registrar.
HTTPS is issued automatically. The site's `canonical`/OG/sitemap URLs already point at `haithamzedan.com`, so nothing else to change.

## The MCP server (optional, later)
`server.mjs` is a live Node process and **cannot run on Cloudflare Pages** (static hosting only), so `/mcp` will 404. The site, the JSON API, and `llms.txt`/`llms-full.txt` all work without it. To make `/mcp` live, deploy `server.mjs` to a free Node host (Render / Railway / Fly.io) or port it to a Cloudflare Worker.

## Your CV
`Haitham_Zedan_CV.pdf` is git-ignored so your full CV isn't published in the repo. Remove that line from `.gitignore` if you want it committed and linked for download.
