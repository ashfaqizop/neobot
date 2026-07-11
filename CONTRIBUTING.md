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
[`docs/BEHAVIOR_MODULE_GUIDE.md`](docs/BEHAVIOR_MODULE_GUIDE.md) (added in a
later phase).

## Code style

- TypeScript strict mode; no `any` unless truly unavoidable (and justified).
- Prefer small, testable modules.
- Run `npm run format` (Prettier) before committing.

## Reporting bugs & requesting features

Use the issue templates. For security issues, **do not** open a public issue —
see [`SECURITY.md`](SECURITY.md).
