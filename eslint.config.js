// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'web/**',
      'coverage/**',
      'scripts/**',
      'tests/live/**',
      'tests/e2e/**',
      'playwright.config.ts',
      'vitest.live.config.ts',
      '*.config.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
  {
    // Tests interact with loosely-typed helpers (supertest bodies, emitter
    // payloads); relax the `any`-flow rules here rather than littering casts.
    files: ['tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      // Spy assertions reference repository methods without calling them.
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    // The Supabase client is untyped without a generated `Database` type, so row
    // access is `any` at this boundary. We validate/shape rows explicitly with
    // casts; relax the `any`-flow rules here rather than generating DB types.
    files: ['src/db/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
    },
  },
);
