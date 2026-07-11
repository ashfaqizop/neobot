# Security Policy

NeoBot handles sensitive material — Minecraft server credentials, a Discord bot
token, a Supabase service key, and an admin password. We take security reports
seriously.

## Supported Versions

NeoBot is pre-1.0 and under active phased development. Security fixes are applied
to the latest `main` and the most recent release.

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report privately via one of:

- GitHub's **[Private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)**
  (Security tab → "Report a vulnerability"), or
- Email **ashfaqizop@gmail.com** with the details.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept if possible).
- Affected version/commit.

We aim to acknowledge reports within **72 hours** and to provide a remediation
timeline after triage. Please give us a reasonable window to fix the issue
before any public disclosure.

## Security practices in NeoBot

- Admin passwords are stored **bcrypt-hashed**.
- Secrets (Discord token, Supabase key) are provided via environment variables
  and never committed — `.env` is gitignored.
- Auth endpoints are rate-limited with lockout on repeated failures.
- Optional login token URL and IP allowlist layers are available.

## Hardening tips for self-hosters

- Never commit your `.env` file or paste real tokens into issues/PRs.
- Rotate your Discord bot token and Supabase key if they may have leaked.
- Enable the IP allowlist if your dashboard is internet-exposed.
