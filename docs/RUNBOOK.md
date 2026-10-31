# GTM God's Eye runbook

How to run, check, update and deploy GTM God's Eye. For what the app is and why it is built this way, read `docs/PROJECT_CONTEXT.md` and `docs/DECISIONS.md`.

## Prerequisites

- Node 24. The project is built and tested on Node 24.13.0, and `@types/node` is pinned to 24.
- pnpm 10.33.0. `package.json` names it in `packageManager`, and `pnpm-lock.yaml` is lockfile version 9.0. Corepack (`corepack enable`) picks the right version.
- For the data pipeline only: Python 3.11 or later (`pipeline/pyproject.toml`) and uv (0.12.19 was used). uv installs the pinned Python packages from `pipeline/uv.lock`.
- git. Line endings are LF everywhere; `.gitattributes` enforces it.

## Install

```sh
pnpm install
cd pipeline && uv sync
```

pnpm only runs the install script of `esbuild` (see `pnpm-workspace.yaml`); that is expected.

## Run the app

```sh
pnpm dev                 # development server, http://localhost:3000
pnpm build               # production build
pnpm start -p 3000       # serve the production build
```

Page routes render per request and need a Node server. The `/api` routes (directory rows, strategy rows, filter index, graph, palette index) are built once at build time from `data/processed/`. A static export will not work.

## Checks

Run all of these before every commit:

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm validate:data
pnpm build
```

Two browser checks run against a server on port 3000 (start the production build first):

```sh
pnpm exec tsx scripts/keyboard-walkthrough.ts
MSYS_NO_PATHCONV=1 pnpm exec tsx scripts/screenshot.ts /strategy out.png 1440 900 --viewport-only --wait=2500
```

The walkthrough visits every route, drives the rail, the command palette and the Inspector by keyboard, and fails on any console error or server error. The screenshot script uses Playwright's Chromium.

## Update the data

Data lives in `data/processed/`, written only by the pipeline. The app reads it through the loaders in `src/lib/data/`.

1. Add or edit inputs: user lists in `data/seed/` and `data/raw/`, research files in `data/research/`. For research, follow `data/research/README.md` (the fact protocol, file formats and privacy rules), then run `pnpm research:check`.
2. Run the pipeline: `pnpm pipeline`. It validates each file against `data/schemas/` before writing, then lays out the network graph.
3. Validate: `pnpm validate:data`, then `pnpm test`. The consistency tests read the real data, so a change that breaks a chart total fails here.
4. Optional: `pnpm coverage:report` refreshes `docs/COVERAGE.md` and `docs/CONFLICTS.md`.
5. Rebuild: `pnpm build`. The `/api` routes are generated at build time, so new data reaches the app only through a new build. On Vercel that means a new deployment (push the commit). Locally, restart `pnpm dev` too, because the loaders are cached.

## Deploy on Vercel

Deploy it yourself; nothing in this repo deploys automatically. Pages need server functions, so use a normal Next.js deployment, not a static export. Keep it private.

1. Push the repo to GitHub. In Vercel, add a new project and import the repo. Vercel detects Next.js and pnpm from `package.json` and the lockfile. Keep the default build command (`pnpm build`) and set the Node version to 24 in the project settings. No environment variables are needed.
2. Turn on Vercel Authentication under the project's Deployment Protection settings, so only people signed in to Vercel with access to the project can open it.
3. On the free Hobby plan, standard protection covers preview deployments but not the production domain. To keep everything private, set the project's production branch to a branch you never push (for example `production-unused`). Every push to `main` or any other branch then builds a protected preview, and nothing is ever published on the production domain. Importing the repo builds the default branch as a production deployment straight away, and on Hobby that one is public: once the production branch is changed, delete that first deployment from the project's Deployments list.
4. On a paid plan, set the protection to cover all deployments instead, and keep `main` as the production branch.
5. Vercel's Hobby plan is meant for personal, non-commercial use. Check its terms fit an internal company tool before relying on it.
6. Open the deployment while signed in and click through each tab.

To publish new data, run the steps in "Update the data", commit, and push. Vercel builds a new deployment from the commit.

### Re-measure performance on the deployment

The Lighthouse numbers in `docs/PHASE_2_REPORT.md` were taken on a laptop against `pnpm start`, which does not compress the `/api` JSON. Vercel compresses it and has different server timing, so measure again on the deployment:

- In a Chrome window where you are signed in to Vercel, open the deployment, then DevTools, Lighthouse, mode Navigation, device Desktop, category Performance. Run it three times per page and take the median.
- Pages to check: `/` (target 90 or more), `/investors/directory` (90 or more) and `/investors/network` (85 or more).
- A command-line run cannot sign in. If you want one, create a Protection Bypass for Automation secret in the project's Deployment Protection settings and pass it as a header: `pnpm dlx lighthouse@12 <url> --preset=desktop --only-categories=performance --extra-headers="{\"x-vercel-protection-bypass\":\"<secret>\"}"`. Keep the secret out of the repo.

## Windows notes

- The repo folder name has an apostrophe and a space (`GTM_finance_God's eye`). Quote the path in every shell command. npm-based scaffolders reject the folder name as a package name; run them in another folder and copy the output in.
- Git Bash rewrites an argument that starts with `/` into a Windows path. Prefix route arguments with `MSYS_NO_PATHCONV=1`, as in the screenshot command above.
- A `next dev` started in the background can outlive its shell, and killing only the child makes the parent start it again. Find the parent with `powershell -NoProfile -c "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | ? CommandLine -like '*pnpm.cjs dev*' | select ProcessId,CommandLine"` and stop the whole tree with `taskkill //PID <id> //T //F` (Git Bash; in PowerShell use single slashes). Use `pnpm.cjs start` in the filter for a production server.
- `netstat -ano` can miss a live Next server on port 3000. Check with `curl --max-time 3 http://localhost:3000/` instead.
- Stop any dev or production server before `pnpm build`, since the build rewrites `.next`.

## People and profiles

Each person on a browser picks a profile from the chip in the top bar (initials and name). Their round, theme, tier changes, Practice, Directory choices and last-used Strategy weights and filters are kept apart. Profiles live in this browser only; they are not passwords, and sign-in is the deployment's. Clearing site data removes them. To start someone fresh, add a person; to remove one, use the bin icon next to their name (the last profile cannot be removed).
