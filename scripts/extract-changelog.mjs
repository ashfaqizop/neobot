#!/usr/bin/env node
/**
 * Extract release notes for a version from CHANGELOG.md (Keep a Changelog format).
 *
 * Usage:
 *   node scripts/extract-changelog.mjs [version]
 *
 * Prints the body of the `## [<version>]` section to stdout. If `version` is
 * omitted or not found, falls back to the top-most `## [...]` section (so it
 * works whether or not the release has been cut from `[Unreleased]` yet). Used
 * by the release workflow to populate GitHub Release notes (`body_path`).
 */
import { readFileSync } from 'node:fs';

const version = (process.argv[2] ?? '').replace(/^v/, '').trim();
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8');
const lines = changelog.split('\n');

const isSectionHeading = (line) => /^##\s+\[/.test(line);
const matchesVersion = (line) => version && new RegExp(`^##\\s+\\[${escapeRegExp(version)}\\]`).test(line);

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Find the start: the requested version, else the first section heading.
let start = version ? lines.findIndex(matchesVersion) : -1;
if (start === -1) start = lines.findIndex(isSectionHeading);

if (start === -1) {
  // No sections at all — emit a minimal fallback rather than failing the release.
  process.stdout.write('See CHANGELOG.md for details.\n');
  process.exit(0);
}

// Collect until the next section heading.
const body = [];
for (let i = start + 1; i < lines.length; i++) {
  if (isSectionHeading(lines[i])) break;
  body.push(lines[i]);
}

process.stdout.write(`${body.join('\n').trim()}\n`);
