# Contributing to NeoBot

Thanks for your interest in improving NeoBot! This project is built to be
genuinely pluggable and contributor-friendly.

## Getting started

1. Fork and clone the repository.
2. Ensure you are on **Node 22** (`nvm use` reads `.nvmrc`).
3. Install dependencies: `npm install`.
4. Copy `.env.example` to `.env` (optional — NeoBot boots without credentials).
5. Run in watch mode: `npm run dev`.

## Before you open a pull request

Please make sure all checks pass locally — CI runs the same commands:

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest
npm run build       # Compile
```

Write unit tests alongside your changes (Vitest) rather than bolting them on
afterward.

### Live & end-to-end suites (optional)

Two heavier suites exercise the app for real and are **not** part of CI:

- `npm run test:live` — runs the real bot against an in-process Minecraft world
  (flying-squid) plus the real HTTP/Socket.IO server. Discord/Supabase smoke
  tests activate when a local `.env` has credentials, and skip otherwise.
- `npm run test:e2e` — drives the built dashboard in a real browser (Playwright).

Run these before shipping changes to the bot, server, or dashboard.

## Commit & PR guidelines

- Use clear, descriptive commit messages. We loosely follow
  [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`,
  `fix:`, `chore:`, `docs:`, `refactor:`, `test:`).
- Keep pull requests focused. Fill out the PR template.
- Reference any related issues.

## Writing a new behavior module

The anti-AFK behavior engine is a plugin system: each behavior is an independent
module implementing a shared interface and registered in
`src/bot/behaviors/index.ts`. You can add a new behavior without touching core
logic. A full guide lives in
[`docs/BEHAVIOR_MODULE_GUIDE.md`](docs/BEHAVIOR_MODULE_GUIDE.md).

## Code style

- TypeScript strict mode; no `any` unless truly unavoidable (and justified).
- Prefer small, testable modules.
- Run `npm run format` (Prettier) before committing.

## Releasing (maintainers)

Releases are semver-tagged and cut automatically by the
[release workflow](.github/workflows/release.yml):

1. Move the `## [Unreleased]` items in [`CHANGELOG.md`](CHANGELOG.md) under a new
   `## [x.y.z] - YYYY-MM-DD` heading.
2. Bump the version and tag it: `npm version <patch|minor|major>` (this updates
   `package.json` and creates a `vX.Y.Z` tag).
3. Push with tags: `git push --follow-tags`.

Pushing a `v*.*.*` tag triggers the workflow, which builds, tests, and publishes a
GitHub Release with notes extracted from the CHANGELOG. The Docker image is **not**
published to any registry (v1 keeps it build-only).

## Reporting bugs & requesting features

Use the issue templates. For security issues, **do not** open a public issue —
see [`SECURITY.md`](SECURITY.md).
