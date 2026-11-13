# Run sheet: the 10-minute live demo

One story, on a real site: I add a small script that notifies me after a deploy, and I
paste its API token into the code. The pipeline stops the token on its branch. I drop it,
release from `main`, and the change travels through staging and my approval to
haithamzedan.com.

The token is fake and only ever exists on a throwaway branch. That branch cannot deploy,
and the `fix` command deletes it, so `main` and the live site never contain it.

The times below are targets, not measurements. Time your own rehearsal and adjust.

## Before the session

The day before:

- [ ] Rehearse the whole sheet once and note how long the green run takes to reach the approval.
- [ ] Record your screen during a full green run. This is the backup.
- [ ] Merge or close any open Dependabot pull requests, then run the pipeline once more.

Thirty minutes before:

- [ ] Run `bash scripts/demo.sh status`. The demo branch should not be on GitHub.
- [ ] Open `https://staging.haithamzedan.pages.dev`. It should show the site.
- [ ] In the **Actions** tab, make sure no run is still waiting for approval. Reject any that is.
- [ ] Open five browser tabs: the Actions tab, `deploy.yml` on GitHub, the old version of
      `deploy.yml` (its history on GitHub), `https://staging.haithamzedan.pages.dev/build.json`,
      and `https://haithamzedan.com/build.json`.
- [ ] Open a terminal in the repository folder. Increase the font size in the terminal and the browser.

## The demo

| Time | Do | Say |
| --- | --- | --- |
| 0:00 | Show haithamzedan.com, then `/build.json`. | "This is my real site. This file says which commit is live. Nobody deployed it by hand." |
| 0:45 | Show the old `deploy.yml`. | "This was my pipeline until recently. Three actions, each referenced by a tag, and the last one receives my Cloudflare token. It is the setup from the attack I opened with." |
| 1:30 | Show the diagram comment at the top of the new `deploy.yml`. | "This is it now: five stages and one approval." |
| 2:00 | Run `bash scripts/demo.sh leak`. Show `ci/notify.mjs`. | "I want a ping on my phone after each deploy. A quick script, and to get it working I paste the token in. Commit, push my branch." |
| 2:30 | Actions tab: open the run for `demo/deploy-notify`. | "The site checks pass. The code works. That is why tests alone do not catch this." |
| 3:00 | Stage 2 turns red. Open the **Secrets (Gitleaks)** step. | "The scanner names the rule, the file and the line, and hides the token itself in the log. Nothing was built. Nothing was deployed." |
| 3:45 | Run `bash scripts/demo.sh fix`. | "I delete the branch and release from main. In real life the token is burned the moment it is pushed, so I would also rotate it." |
| 4:15 | While the run works, walk through `deploy.yml`. | See "What to point at" below. |
| 7:00 | When stage 4 finishes, refresh the staging `build.json`, then open the staging page. | "Staging is a private preview on Cloudflare, with the exact files that will go live. The scanner is attacking it now." |
| 8:00 | The run pauses at stage 5. Click **Review deployments**, tick **production**, approve. | "The pipeline cannot go further alone. My Cloudflare token is not released to the job until I approve." |
| 9:00 | Refresh `https://haithamzedan.com/build.json`. | "Production now shows the same commit as staging: the same files, built once." |
| 9:30 | Open the **zap-report** artifact of the run. | "And the scanner found real gaps on my own site: no Content-Security-Policy and no anti-clickjacking header. They are warnings today, with a note in the repository, until I fix them." |

### What to point at in `deploy.yml` (minutes 4 to 7)

Pick three or four. Each one is a line you can put the cursor on.

1. **`permissions: contents: read`** near the top. Every job starts with a read-only token.
2. **`uses: ...@<40 characters> # v7.0.1`**. Every action is pinned to a commit. Compare with
   the old file: `actions/checkout@v4`, `cloudflare/wrangler-action@v3`.
3. **The step "The pipeline itself (zizmor)"**. The pipeline audits its own file, so an
   unpinned action can no longer be merged. The old workflow fails this check.
4. **The build job**. The only job that can write to the registry runs no third-party code.
5. **`scan-image` and `dast`**. The jobs that run third-party scanners hold no deploy key
   and no Cloudflare token. A hijacked scanner would find nothing worth stealing.
6. **`environment: production`**. Its copy of the Cloudflare token is released only after
   approval.
7. **The step "Start the image and check it serves this commit"**. The container is not
   just built and scanned: it is started and asked which commit it is.
8. **`.zap/rules.tsv`**. Three decisions in one small file: what fails the release, what is
   a warning, and what is accepted on purpose.

You can also open a finished run and show the **sbom** artifact: every package inside the
image.

### If something goes wrong

- **The green run is slower than in rehearsal.** Keep talking through the list above, or
  open the finished run from your rehearsal and show its stages.
- **The network or GitHub fails.** Play the recording and narrate it.
- **A stage is red for a reason you did not plan.** A new vulnerability in the base image
  was probably published today. Say so: it is the pipeline doing its job. Then switch to
  the recording. The live site is not affected.

## After the session

```bash
bash scripts/demo.sh reset    # removes the demo branch if it is still there
```

The failed runs stay in the Actions history. Delete them there if you prefer a clean list.

## How the demo maps to the talk

| Key point from the talk | Where the audience sees it |
| --- | --- |
| Fail fast | The token is stopped in stage 2, on its branch, before anything is built |
| Shift left | Three scanners run on every push, next to the tests |
| Security in the pipeline | One check per stage: secrets, code, the pipeline file, the image, the running site |
| Security of the pipeline | SHA pins, read-only token, scanners without secrets, the token released only after approval |
| Build once, deploy many | The same `dist/` goes into the image, to staging, and to production |
| Continuous delivery | Everything is automatic up to the approval; a person decides the release |

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Stage 3: `not serving <commit> yet` at "Start the image" | The container did not start | Open the step log: the container's own log is printed under the check. Usually a typo in `nginx/site.conf` |
| Stage 3: Trivy reports a vulnerability | A fix for the base image was published after your last run | Run the pipeline again so the image is rebuilt. As a last resort, add the ID to `.trivyignore` with a reason |
| Stage 4 or 5: Wrangler reports an authentication error | The Cloudflare secrets are missing from that environment | Add `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` to the environment again |
| Stage 4 or 5: `Project not found` | The Pages project has a different name | Correct `PAGES_PROJECT` at the top of `deploy.yml` |
| Stage 4: `not serving <commit> yet`, then failure | The preview alias took longer than a minute to update | Run the failed jobs again from the run page |
| Stage 4 scan: `failed to scan the target` | The staging URL is wrong | Open `https://staging.haithamzedan.pages.dev`; if it fails, check `STAGING_URL` at the top of `deploy.yml` |
| Stage 5: the check fails after a successful deploy | `PRODUCTION_URL` at the top of `deploy.yml` does not match your Pages project | Correct it, or open the Pages dashboard to confirm the deploy |
| A run sits at "Waiting" | Stage 5 is waiting for approval | Click **Review deployments** and approve or reject |
| `demo.sh` says there are local changes | Uncommitted edits in the folder | `git stash`, then run the command again |
