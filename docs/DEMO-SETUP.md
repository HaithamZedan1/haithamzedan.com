# Setting up the pipeline for the CI/CD session

About 15 minutes, all in GitHub and Cloudflare. No server, nothing to pay for: GitHub Actions
is free for public repositories, and the Cloudflare Pages free plan covers staging and production.

Do it at least a day before the session, so there is time to rehearse.

## What this changes for the live site

Read this first. Nothing here takes effect until you push.

- **Today** every push to `main` goes straight to Cloudflare Pages.
- **After this** a push to `main` is tested, scanned, built into a container image that is
  scanned and test-started, published as a Cloudflare preview at
  `https://staging.haithamzedan.pages.dev`, scanned again from outside, and published to
  haithamzedan.com only after you approve it.
- **The published files are the same** as today, plus one new file: `/build.json`, which
  says which commit is live. `index.html`, `api/` and `_headers` are untouched.
- **Two tool versions move.** The pipeline runs Node 22 instead of 20, and Wrangler 4.155.0
  through `wrangler-action` v4.1.3 instead of the floating `v3` tag.

To undo everything: `git revert <the pipeline commit>` and push. That restores the old
workflow. To undo a published version of the site, use **Deployments > Rollback** in the
Cloudflare Pages dashboard.

## 1. Clean up the folder

The first version of this setup used a server. Delete what it left behind:

- the `deploy` folder
- `ci\deploy-staging.sh`
- the `_move-into-github` folder, after step 2

## 2. Put the new workflow in place

The new `deploy.yml` is waiting in `_move-into-github`, because workflow files are yours to
put in place. Move it over the current one:

```bash
mv _move-into-github/deploy.yml .github/workflows/deploy.yml
rm -r _move-into-github
```

`.github/dependabot.yml` is already in place and does not change.

## 3. Configure GitHub

### Your Cloudflare secrets

The repository already has `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` as repository
secrets. Have the token and account ID ready to paste again: GitHub never shows a saved
secret. If you don't have them, see steps 3 and 4 of `DEPLOY.md`.

### Environments

**Settings > Environments**: create two.

**staging**

- Add environment secrets `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
- Under **Deployment branches and tags**, choose **Selected branches and tags** and add `main`.

**production**

- Add the same two environment secrets.
- Tick **Required reviewers** and add yourself. Leave **Prevent self-review** unticked, so
  you can approve your own push during the demo.
- Under **Deployment branches and tags**, choose **Selected branches and tags** and add `main`.

Then delete the two repository-level secrets under **Settings > Secrets and variables >
Actions > Repository secrets**. From then on the token is released only to the two deploy
jobs, and the production copy only after your approval.

No repository variables are needed. The URLs are at the top of `deploy.yml`.

## 4. Review, commit and push

```bash
git status            # new folders, plus changes to deploy.yml and .gitignore
git diff              # read the changes to the two existing files
git add -A
git commit -m "Add the DevSecOps pipeline"
git push
```

Open the **Actions** tab and watch the run. When it reaches **5 · Publish to Cloudflare**,
click **Review deployments**, tick **production**, and approve.

Then open `https://haithamzedan.com/build.json`. It should show the commit you just pushed.

This first run is the real test of the setup. If a stage fails, the live site is not
touched; see [Troubleshooting](DEMO-RUNSHEET.md#troubleshooting).

## 5. Rehearse

Follow [DEMO-RUNSHEET.md](DEMO-RUNSHEET.md) once from start to finish, and time it. Record
the screen during a full green run: that recording is your backup if the network fails.

## Going further

- **Fix the two findings ZAP reports today.** The site sends no Content-Security-Policy and
  no anti-clickjacking header. Add them to `_headers` and to `nginx/site.conf` (the tests
  fail if the two files disagree), check the page still works on staging, then change the
  two `WARN` lines in `.zap/rules.tsv` to `FAIL`.
- **Use a token per environment.** Today staging and production share one Cloudflare token.
  Pages tokens cannot be limited to preview deployments, so the gain is mainly separate
  rotation and audit.
- **Pin the two container images by digest.** The base image in the `Dockerfile` and the ZAP
  image are referenced by tag.
- **Protect the main branch**, so changes arrive through reviewed pull requests.
