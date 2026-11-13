#!/usr/bin/env bash
# Live-demo helper for the CI/CD session. Run from the repository root:
#
#   bash scripts/demo.sh leak     Push a branch with a hardcoded token -> pipeline stops at "2 · Scan code"
#   bash scripts/demo.sh fix      Delete that branch, release from main -> green, then waits for approval
#   bash scripts/demo.sh reset    Remove the demo branch if it is still around
#   bash scripts/demo.sh status   Show where things stand
#
# The token only ever exists on a throwaway branch. That branch cannot deploy, and
# "fix" deletes it, so main and the live site never contain it.
set -euo pipefail

BRANCH="demo/deploy-notify"
LEAK_FILE="ci/notify.mjs"

# A made-up value that only looks like a real credential. It is split in two here so
# that this script does not itself trip the secret scanner.
half_a='q7Lm2xVt9RkPz4Wd8NsB'
half_b='c3Hy6JfGa1Te5UoXi0Mn'

say() { printf '\n%s\n' "$*"; }
die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

actions_url() {
  git remote get-url origin | sed -e 's#^git@github.com:#https://github.com/#' -e 's#\.git$##' -e 's#$#/actions#'
}

on_main_and_clean() {
  [ -f index.html ] && [ -d .github/workflows ] || die "run this from the repository root"
  [ "$(git rev-parse --abbrev-ref HEAD)" = "main" ] || die "switch to the main branch first"
  [ -z "$(git status --porcelain)" ] || die "commit or stash your local changes first"
}

remove_demo_branch() {
  if [ "$(git rev-parse --abbrev-ref HEAD)" = "$BRANCH" ]; then
    git checkout --quiet main
  fi
  git branch --quiet -D "$BRANCH" 2> /dev/null || true
  if git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null 2>&1; then
    git push --quiet origin --delete "$BRANCH"
  fi
}

case "${1:-}" in
  leak)
    on_main_and_clean
    git pull --quiet --ff-only origin main
    remove_demo_branch
    git checkout --quiet -b "$BRANCH"
    mkdir -p "$(dirname "$LEAK_FILE")"
    cat > "$LEAK_FILE" << SCRIPT
// Ping my phone when a deploy finishes.
const NOTIFY_API_TOKEN = "${half_a}${half_b}";

await fetch("https://notify.example.com/v1/messages", {
  method: "POST",
  headers: { Authorization: \`Bearer \${NOTIFY_API_TOKEN}\` },
  body: "haithamzedan.com was deployed",
});
SCRIPT
    git add "$LEAK_FILE"
    git commit --quiet -m "Add a deploy notification"
    git push --quiet --set-upstream origin "$BRANCH"
    say "Pushed branch ${BRANCH}. Watch the pipeline: $(actions_url)"
    echo "Expect: 1 · Test passes, 2 · Scan code fails at the Gitleaks step. Nothing is built or deployed."
    ;;
  fix)
    [ -z "$(git status --porcelain)" ] || die "commit or stash your local changes first"
    remove_demo_branch
    on_main_and_clean
    git pull --quiet --ff-only origin main
    git commit --quiet --allow-empty -m "Release without the hardcoded token"
    git push --quiet origin main
    say "Deleted ${BRANCH} and pushed $(git rev-parse --short HEAD) to main. Watch the pipeline: $(actions_url)"
    echo "Expect: every stage passes, then 5 · Publish to Cloudflare waits for your approval."
    ;;
  reset)
    [ -z "$(git status --porcelain)" ] || die "commit or stash your local changes first"
    remove_demo_branch
    say "The demo branch is gone, locally and on GitHub. You are on $(git rev-parse --abbrev-ref HEAD)."
    ;;
  status)
    echo "Current branch:    $(git rev-parse --abbrev-ref HEAD)"
    if git ls-remote --exit-code --heads origin "$BRANCH" > /dev/null 2>&1; then
      echo "Demo branch:       still on GitHub (run: bash scripts/demo.sh fix, or reset)"
    else
      echo "Demo branch:       not on GitHub"
    fi
    echo "Last commit, main: $(git log -1 --format='%h %s' main)"
    ;;
  *)
    sed -n '2,11p' "$0" | sed 's/^# \{0,1\}//'
    exit 1
    ;;
esac
