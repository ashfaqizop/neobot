/**
 * Live-suite env loader (vitest setupFile).
 *
 * NeoBot reads `process.env` directly — in production the platform (Render /
 * Docker `env_file`) injects it, so the app never bundles a dotenv loader. For
 * local live tests we load the gitignored `.env` here, BEFORE any test imports
 * `src/config/env.ts`, so the Discord/Supabase smoke tests can pick up real
 * credentials when present (and skip cleanly when absent).
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env');
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}
