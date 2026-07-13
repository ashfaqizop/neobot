/**
 * Pure wizard-form → `POST /api/setup` payload assembly (masterdoc §8.3).
 * Extracted from the component so it's unit-testable against the backend
 * `setupSchema` (src/server/setupWizard.ts). No secrets here — Supabase/Discord
 * stay env-only and are only *reported* by the wizard.
 */

export interface SetupForm {
  adminUsername: string;
  adminPassword: string;
  adminPasswordConfirm: string;

  host: string;
  port: string;
  autoDetectVersion: boolean;
  version: string;
  botUsername: string;

  safeX: string;
  safeY: string;
  safeZ: string;
  safeRadius: string;
  blockMode: 'off' | 'self-placed-only' | 'radius-any';
  boundless: boolean;

  chatEnabled: boolean;
  chatMessages: string;

  tokenUrlEnabled: boolean;
  ipAllowlistEnabled: boolean;
  ipAllowlistEntries: string;
}

export const defaultSetupForm: SetupForm = {
  adminUsername: '',
  adminPassword: '',
  adminPasswordConfirm: '',
  host: '',
  port: '25565',
  autoDetectVersion: true,
  version: '',
  botUsername: '',
  safeX: '',
  safeY: '',
  safeZ: '',
  safeRadius: '32',
  blockMode: 'off',
  boundless: false,
  chatEnabled: false,
  chatMessages: '',
  tokenUrlEnabled: false,
  ipAllowlistEnabled: false,
  ipAllowlistEntries: '',
};

const numOrNull = (raw: string): number | null => {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

const linesOf = (raw: string): string[] =>
  raw
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export interface SetupPayload {
  admin: { username: string; password: string };
  connection: { host: string | null; port: number; version: string | null; username: string | null };
  safeZone: { x: number | null; y: number | null; z: number | null; radius: number };
  blockInteraction: { mode: SetupForm['blockMode']; boundless: boolean };
  chat: { enabled: boolean; messages: string[] };
  auth: {
    tokenUrl: { enabled: boolean };
    ipAllowlist: { enabled: boolean; entries: string[] };
  };
}

export function buildSetupPayload(form: SetupForm): SetupPayload {
  return {
    admin: { username: form.adminUsername.trim(), password: form.adminPassword },
    connection: {
      host: form.host.trim() || null,
      port: Number(form.port) || 25565,
      version: form.autoDetectVersion ? null : form.version.trim() || null,
      username: form.botUsername.trim() || null,
    },
    safeZone: {
      x: numOrNull(form.safeX),
      y: numOrNull(form.safeY),
      z: numOrNull(form.safeZ),
      radius: Math.max(0, numOrNull(form.safeRadius) ?? 0),
    },
    blockInteraction: { mode: form.blockMode, boundless: form.boundless },
    chat: { enabled: form.chatEnabled, messages: linesOf(form.chatMessages) },
    auth: {
      tokenUrl: { enabled: form.tokenUrlEnabled },
      ipAllowlist: {
        enabled: form.ipAllowlistEnabled,
        entries: linesOf(form.ipAllowlistEntries),
      },
    },
  };
}

/** Per-step validation. Returns an error string, or null when the step is OK. */
export function validateStep(step: number, form: SetupForm): string | null {
  if (step === 0) {
    if (form.adminUsername.trim().length < 1) return 'Choose an admin username.';
    if (form.adminPassword.length < 6) return 'Password must be at least 6 characters.';
    if (form.adminPassword !== form.adminPasswordConfirm) return 'Passwords do not match.';
  }
  if (step === 1) {
    const port = Number(form.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) return 'Enter a valid port (1–65535).';
    if (!form.autoDetectVersion && form.version.trim() === '')
      return 'Enter a version, or enable auto-detect.';
  }
  return null;
}
