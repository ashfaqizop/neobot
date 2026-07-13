/**
 * First-run setup wizard (masterdoc §8.3). A stepped form that creates the admin
 * account and writes non-secret config via `POST /api/setup`. Secrets
 * (Supabase/Discord) are env-only, so they appear as read-only environment
 * status here — never as input fields (the Phase 6 decision, §13).
 */
import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api.ts';
import type { SetupStatus } from '../lib/types.ts';
import { cn } from '../lib/cn.ts';
import { Brand } from '../components/Brand.tsx';
import { Button, Panel, Badge } from '../components/ui/primitives.tsx';
import { Field, Input, Select, Textarea, Toggle } from '../components/ui/form.tsx';
import { IconCheck } from '../components/ui/icons.tsx';
import {
  buildSetupPayload,
  defaultSetupForm,
  validateStep,
  type SetupForm,
} from './setupPayload.ts';

const STEPS = ['Admin', 'Connection', 'Behavior', 'Security', 'Review'];

export function SetupWizard() {
  const [form, setForm] = useState<SetupForm>(defaultSetupForm);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [envStatus, setEnvStatus] = useState<SetupStatus | null>(null);

  useEffect(() => {
    api
      .setupStatus()
      .then(setEnvStatus)
      .catch(() => setEnvStatus(null));
  }, []);

  const set = <K extends keyof SetupForm>(key: K, value: SetupForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const next = () => {
    const err = validateStep(step, form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const back = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.runSetup(buildSetupPayload(form));
      // Admin now exists but there's no session yet — send them to login with a
      // full reload so the boot guard re-reads setup status (now false).
      window.location.assign('/login');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('This instance is already configured. Redirecting…');
        setTimeout(() => window.location.assign('/login'), 1200);
      } else {
        setError(err instanceof Error ? err.message : 'Setup failed.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-start justify-center bg-base bg-grid px-4 py-8 sm:items-center">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Brand size={38} />
          <div>
            <h1 className="text-xl font-semibold text-ink">Welcome — let's set up NeoBot</h1>
            <p className="mt-1 text-sm text-muted">
              A one-time wizard. You can change everything later from the dashboard.
            </p>
          </div>
        </div>

        <Stepper step={step} />

        <Panel className="mt-4">
          <div className="flex flex-col gap-5">
            {step === 0 && <AdminStep form={form} set={set} />}
            {step === 1 && <ConnectionStep form={form} set={set} />}
            {step === 2 && <BehaviorStep form={form} set={set} />}
            {step === 3 && <SecurityStep form={form} set={set} envStatus={envStatus} />}
            {step === 4 && <ReviewStep form={form} envStatus={envStatus} />}

            {error && (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            )}

            <div className="mt-1 flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={back} disabled={step === 0 || busy}>
                Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button variant="primary" onClick={next}>
                  Continue
                </Button>
              ) : (
                <Button variant="primary" onClick={() => void submit()} loading={busy}>
                  Finish setup
                </Button>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((label, i) => (
        <li key={label} className="flex flex-1 flex-col gap-1.5">
          <div
            className={cn(
              'h-1 rounded-full transition-colors',
              i < step ? 'bg-accent' : i === step ? 'bg-accent/70' : 'bg-border',
            )}
          />
          <span
            className={cn(
              'text-[11px] font-medium',
              i <= step ? 'text-muted' : 'text-faint',
            )}
          >
            {label}
          </span>
        </li>
      ))}
    </ol>
  );
}

type StepProps = {
  form: SetupForm;
  set: <K extends keyof SetupForm>(key: K, value: SetupForm[K]) => void;
};

function AdminStep({ form, set }: StepProps) {
  return (
    <>
      <p className="text-sm text-muted">Create the single admin account for this dashboard.</p>
      <Field label="Admin username" htmlFor="admin-username" required>
        <Input
          id="admin-username"
          value={form.adminUsername}
          onChange={(e) => set('adminUsername', e.target.value)}
          autoComplete="username"
        />
      </Field>
      <Field label="Password" htmlFor="admin-password" hint="At least 6 characters." required>
        <Input
          id="admin-password"
          type="password"
          value={form.adminPassword}
          onChange={(e) => set('adminPassword', e.target.value)}
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirm password" htmlFor="admin-confirm" required>
        <Input
          id="admin-confirm"
          type="password"
          value={form.adminPasswordConfirm}
          onChange={(e) => set('adminPasswordConfirm', e.target.value)}
          autoComplete="new-password"
        />
      </Field>
    </>
  );
}

function ConnectionStep({ form, set }: StepProps) {
  return (
    <>
      <p className="text-sm text-muted">
        Where should the bot connect? Leave the host blank to configure it later.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Server host" htmlFor="host" className="col-span-2">
          <Input
            id="host"
            placeholder="play.example.net"
            value={form.host}
            onChange={(e) => set('host', e.target.value)}
          />
        </Field>
        <Field label="Port" htmlFor="port">
          <Input
            id="port"
            inputMode="numeric"
            value={form.port}
            onChange={(e) => set('port', e.target.value)}
          />
        </Field>
      </div>
      <Field label="Bot username" htmlFor="bot-username" hint="The in-game name (offline auth).">
        <Input
          id="bot-username"
          placeholder="NeoBot"
          value={form.botUsername}
          onChange={(e) => set('botUsername', e.target.value)}
        />
      </Field>
      <Toggle
        checked={form.autoDetectVersion}
        onChange={(v) => set('autoDetectVersion', v)}
        label="Auto-detect Minecraft version"
        hint="Recommended. Turn off to pin a specific protocol version."
      />
      {!form.autoDetectVersion && (
        <Field label="Version" htmlFor="version">
          <Input
            id="version"
            placeholder="1.20.4"
            value={form.version}
            onChange={(e) => set('version', e.target.value)}
          />
        </Field>
      )}
    </>
  );
}

function BehaviorStep({ form, set }: StepProps) {
  return (
    <>
      <p className="text-sm text-muted">
        Roaming boundary and interaction limits. Per-behavior weights are tuned on the Config page.
      </p>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-muted">Safe-zone anchor</span>
        <div className="grid grid-cols-4 gap-2">
          {(['safeX', 'safeY', 'safeZ', 'safeRadius'] as const).map((k, i) => (
            <Input
              key={k}
              aria-label={['X', 'Y', 'Z', 'Radius'][i]}
              placeholder={['X', 'Y', 'Z', 'Radius'][i]}
              inputMode="numeric"
              value={form[k]}
              onChange={(e) => set(k, e.target.value)}
            />
          ))}
        </div>
        <p className="mt-1 text-xs text-faint">
          Leave X/Y/Z blank to anchor at the bot's spawn point. Radius in blocks.
        </p>
      </div>
      <Field label="Block interaction" htmlFor="block-mode" hint="How freely the bot may place/break blocks.">
        <Select
          id="block-mode"
          value={form.blockMode}
          onChange={(e) => set('blockMode', e.target.value as SetupForm['blockMode'])}
        >
          <option value="off">Off — leave no trace (default)</option>
          <option value="self-placed-only">Self-placed only — net-zero</option>
          <option value="radius-any">Radius-any — within the safe-zone</option>
        </Select>
      </Field>
      <Toggle
        checked={form.boundless}
        onChange={(v) => set('boundless', v)}
        label="Boundless mode"
        hint="Unrestricted roam/interaction — only for private/empty test servers."
      />
      <Toggle
        checked={form.chatEnabled}
        onChange={(v) => set('chatEnabled', v)}
        label="Enable chat messages"
        hint="Off by default. Sends occasional messages from the pool below."
      />
      {form.chatEnabled && (
        <Field label="Chat message pool" htmlFor="chat-messages" hint="One message per line.">
          <Textarea
            id="chat-messages"
            value={form.chatMessages}
            onChange={(e) => set('chatMessages', e.target.value)}
            placeholder={'hello\nafk keeping the server warm'}
          />
        </Field>
      )}
    </>
  );
}

function SecurityStep({ form, set, envStatus }: StepProps & { envStatus: SetupStatus | null }) {
  return (
    <>
      <p className="text-sm text-muted">
        Login + password is always on. These extra layers are optional (masterdoc §8.2).
      </p>
      <Toggle
        checked={form.tokenUrlEnabled}
        onChange={(v) => set('tokenUrlEnabled', v)}
        label="Token access URL"
        hint="Generates a shareable link with an embedded access token."
      />
      <Toggle
        checked={form.ipAllowlistEnabled}
        onChange={(v) => set('ipAllowlistEnabled', v)}
        label="IP allowlist"
        hint="Super-security: only these IPs may reach the dashboard."
      />
      {form.ipAllowlistEnabled && (
        <Field label="Allowed IPs" htmlFor="ip-entries" hint="One IP per line.">
          <Textarea
            id="ip-entries"
            value={form.ipAllowlistEntries}
            onChange={(e) => set('ipAllowlistEntries', e.target.value)}
            placeholder={'203.0.113.4\n198.51.100.0'}
          />
        </Field>
      )}
      <EnvStatus envStatus={envStatus} />
    </>
  );
}

function ReviewStep({ form, envStatus }: { form: SetupForm; envStatus: SetupStatus | null }) {
  const rows: Array<[string, string]> = [
    ['Admin', form.adminUsername || '—'],
    ['Server', form.host ? `${form.host}:${form.port}` : 'not set (configure later)'],
    ['Version', form.autoDetectVersion ? 'auto-detect' : form.version || '—'],
    ['Bot name', form.botUsername || 'NeoBot (default)'],
    ['Block mode', form.blockMode + (form.boundless ? ' · boundless' : '')],
    ['Chat', form.chatEnabled ? 'enabled' : 'off'],
    [
      'Extra auth',
      [form.tokenUrlEnabled && 'token URL', form.ipAllowlistEnabled && 'IP allowlist']
        .filter(Boolean)
        .join(', ') || 'login only',
    ],
  ];
  return (
    <>
      <p className="text-sm text-muted">Review, then finish. Everything is editable afterwards.</p>
      <dl className="divide-y divide-border/70 overflow-hidden rounded-[var(--radius-md)] border border-border">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-4 px-3 py-2.5">
            <dt className="text-sm text-faint">{k}</dt>
            <dd className="text-right font-mono text-sm text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <EnvStatus envStatus={envStatus} />
    </>
  );
}

function EnvStatus({ envStatus }: { envStatus: SetupStatus | null }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-border bg-surface-2/60 p-3">
      <p className="mb-2 text-xs font-medium text-faint">
        Environment (set via server env — never entered here)
      </p>
      <div className="flex flex-wrap gap-2">
        <EnvBadge label="Supabase" ok={envStatus?.supabaseConfigured ?? false} />
        <EnvBadge label="Discord" ok={envStatus?.discordConfigured ?? false} />
      </div>
    </div>
  );
}

function EnvBadge({ label, ok }: { label: string; ok: boolean }) {
  return (
    <Badge tone={ok ? 'ok' : 'idle'}>
      {ok ? <IconCheck size={13} /> : null}
      {label}: {ok ? 'configured' : 'not set'}
    </Badge>
  );
}
