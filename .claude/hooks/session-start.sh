#!/bin/bash
# SessionStart hook for Crescent Finances (Claude Code on the web).
#
# Two jobs, both aimed at making remote sessions start on solid ground:
#   1. Install npm dependencies so `npm run check`/`test`/`build` work right
#      away (a fresh container has no node_modules).
#   2. Warn — read-only, never auto-fix — when the working branch is built on a
#      base that's behind `origin/dev`. Per CLAUDE.md, feature work branches from
#      `dev`; a session seeded from stale `main` starts dozens of commits behind.
#
# No `set -e`: a failure in one step (e.g. offline) must not abort the session.
# Only stdout becomes agent context, so dependency-install noise goes to stderr
# and stdout carries just the stale-base warning, if any.
set -uo pipefail

# Remote (web/phone) sessions only — local desktop users manage their own setup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# 1) Dependencies. `npm install` (not `ci`) so the cached container layer is
#    reused on resume. Output to stderr to keep agent context clean.
if [ -f package-lock.json ]; then
  echo "session-start: installing npm dependencies…" >&2
  npm install --no-audit --no-fund >&2 || echo "session-start: npm install failed (continuing)" >&2
fi

# 2) Stale-base guard. Compare the branch's merge-base against origin/dev.
if git rev-parse --git-dir >/dev/null 2>&1 && git fetch -q origin dev 2>/dev/null; then
  base="$(git merge-base HEAD origin/dev 2>/dev/null || true)"
  if [ -n "$base" ]; then
    behind="$(git rev-list --count "$base"..origin/dev 2>/dev/null || echo 0)"
    if [ "$behind" -gt 0 ]; then
      echo "⚠️ Stale base: this branch is $behind commit(s) behind origin/dev. Per CLAUDE.md, feature work should branch from dev. Before building, consider: git fetch origin && git rebase origin/dev (or git reset --hard origin/dev on a fresh branch). Do NOT push without confirming the base is current."
    fi
  fi
fi

exit 0
