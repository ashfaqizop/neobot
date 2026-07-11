# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Phase 1 — Scaffolding.** Project skeleton and toolchain:
  - TypeScript (strict) project targeting Node 22, with `tsconfig` build config.
  - ESLint 9 (flat, type-checked) + Prettier + `.editorconfig`.
  - Vitest test runner with a smoke test.
  - Foundational modules: validated environment resolution (`src/config/env.ts`)
    and structured `pino` logging (`src/lib/logger.ts`).
  - Minimal bootstrap entrypoint (`src/index.ts`).
  - Multi-stage `Dockerfile` (non-root) and `docker-compose.yml`.
  - GitHub Actions CI: lint + typecheck + test + build, and a Docker build check.
  - Open-source hygiene: MIT `LICENSE`, `README`, `CONTRIBUTING`,
    `CODE_OF_CONDUCT`, `SECURITY`, issue/PR templates, and Dependabot.
  - `.env.example` documenting all configuration.
