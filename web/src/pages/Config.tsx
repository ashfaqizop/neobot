/**
 * Config editor (masterdoc §8.5). Loads the secret-free `AppConfig`, edits it,
 * and persists via `PUT /api/config`. Export downloads the current config as
 * JSON; Import validates + restores from a JSON file (useful before a redeploy
 * wipes ephemeral disk). Some changes apply on the next connection restart.
 */
import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api.ts';
import type { AppConfig } from '../lib/types.ts';
import type { AlertSetting } from '../lib/types.ts';
import { Button, Panel, Skeleton, Badge } from '../components/ui/primitives.tsx';
import { Field, Input, Select, Textarea, Toggle } from '../components/ui/form.tsx';
import { useToast } from '../components/ui/Toast.tsx';
import { humanizeAlertKey, humanizeError } from '../lib/humanize.ts';
import { IconDownload, IconUpload } from '../components/ui/icons.tsx';

export function ConfigPage() {
  const { push } = useToast();
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api
      .getConfig()
      .then(setConfig)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load config'));
  }, []);

  if (!config) {
    return error ? (
      <Panel>
        <p className="text-sm text-danger">{error}</p>
      </Panel>
    ) : (
      <div className="flex flex-col gap-5">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40" />
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const update = (mut: (draft: AppConfig) => void) => {
    setConfig((prev) => {
      if (!prev) return prev;
      const draft = structuredClone(prev);
      mut(draft);
      return draft;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.putConfig(config);
      push('Configuration saved', 'ok');
    } catch (err) {
      push(humanizeError(err instanceof Error ? err.message : 'Save failed'), 'danger');
    } finally {
      setSaving(false);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'neobot-config.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportFile = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text()) as AppConfig;
      await api.importConfig(parsed);
      setConfig(parsed);
      push('Configuration imported', 'ok');
    } catch (err) {
      push(humanizeError(err instanceof Error ? err.message : 'Import failed — invalid file'), 'danger');
    }
  };

  const c = config;
  const behaviorNames = Object.keys(c.behavior.behaviors).sort();

  return (
    <div className="flex flex-col gap-5 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Configuration</h1>
          <p className="text-sm text-muted">
            Some connection/behavior changes take full effect after a restart.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportConfig}>
            <IconDownload size={16} /> Export
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            <IconUpload size={16} /> Import
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
              e.target.value = '';
            }}
          />
          <Button variant="primary" onClick={() => void save()} loading={saving}>
            Save changes
          </Button>
        </div>
      </div>

      <Panel title="Connection">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Host" htmlFor="c-host" className="sm:col-span-2">
            <Input
              id="c-host"
              value={c.connection.host ?? ''}
              placeholder="play.example.net"
              onChange={(e) => update((d) => (d.connection.host = e.target.value || null))}
            />
          </Field>
          <Field label="Port" htmlFor="c-port">
            <Input
              id="c-port"
              inputMode="numeric"
              value={c.connection.port}
              onChange={(e) => update((d) => (d.connection.port = Number(e.target.value) || 0))}
            />
          </Field>
          <Field label="Bot username" htmlFor="c-user">
            <Input
              id="c-user"
              value={c.connection.username ?? ''}
              placeholder="NeoBot"
              onChange={(e) => update((d) => (d.connection.username = e.target.value || null))}
            />
          </Field>
          <Field label="Version" htmlFor="c-version" hint="Blank = auto-detect." className="sm:col-span-2">
            <Input
              id="c-version"
              value={c.connection.version ?? ''}
              placeholder="auto-detect"
              onChange={(e) => update((d) => (d.connection.version = e.target.value || null))}
            />
          </Field>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Safe zone & interaction">
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-4 gap-2">
              <NumField
                label="X"
                value={c.behavior.safeZone.x}
                onChange={(n) => update((d) => (d.behavior.safeZone.x = n))}
              />
              <NumField
                label="Y"
                value={c.behavior.safeZone.y}
                onChange={(n) => update((d) => (d.behavior.safeZone.y = n))}
              />
              <NumField
                label="Z"
                value={c.behavior.safeZone.z}
                onChange={(n) => update((d) => (d.behavior.safeZone.z = n))}
              />
              <NumField
                label="Radius"
                value={c.behavior.safeZone.radius}
                onChange={(n) => update((d) => (d.behavior.safeZone.radius = n ?? 0))}
              />
            </div>
            <Field label="Block interaction" htmlFor="c-block">
              <Select
                id="c-block"
                value={c.behavior.blockInteraction.mode}
                onChange={(e) =>
                  update(
                    (d) =>
                      (d.behavior.blockInteraction.mode = e.target
                        .value as AppConfig['behavior']['blockInteraction']['mode']),
                  )
                }
              >
                <option value="off">Off — leave no trace</option>
                <option value="self-placed-only">Self-placed only</option>
                <option value="radius-any">Radius-any</option>
              </Select>
            </Field>
            <Toggle
              checked={c.behavior.blockInteraction.boundless}
              onChange={(v) => update((d) => (d.behavior.blockInteraction.boundless = v))}
              label="Boundless mode"
              hint="Unrestricted — private/test servers only."
            />
            <Toggle
              checked={c.behavior.hazards.enabled}
              onChange={(v) => update((d) => (d.behavior.hazards.enabled = v))}
              label="Hazard self-preservation"
              hint="Avoid lava, drowning, mobs, and fall edges."
            />
            <NumField
              label="Player-pause radius"
              value={c.behavior.playerPause.radius}
              onChange={(n) => update((d) => (d.behavior.playerPause.radius = n ?? 0))}
              wide
            />
          </div>
        </Panel>

        <Panel title="Chat">
          <div className="flex flex-col gap-4">
            <Toggle
              checked={c.behavior.chat.enabled}
              onChange={(v) => update((d) => (d.behavior.chat.enabled = v))}
              label="Enable chat"
              hint="Sends occasional messages from the pool."
            />
            <Field label="Message pool" htmlFor="c-chat" hint="One message per line.">
              <Textarea
                id="c-chat"
                value={c.behavior.chat.messages.join('\n')}
                onChange={(e) =>
                  update(
                    (d) =>
                      (d.behavior.chat.messages = e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)),
                  )
                }
              />
            </Field>
          </div>
        </Panel>
      </div>

      <Panel title="Behaviors" bodyClassName="p-0">
        <ul className="divide-y divide-border/60">
          {behaviorNames.map((name) => {
            const b = c.behavior.behaviors[name]!;
            return (
              <li key={name} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Toggle
                    checked={b.enabled}
                    onChange={(v) => update((d) => (d.behavior.behaviors[name]!.enabled = v))}
                    label={name}
                  />
                </div>
                <label className="flex items-center gap-2 text-xs text-faint">
                  weight
                  <Input
                    className="w-20"
                    inputMode="decimal"
                    value={b.weight}
                    onChange={(e) =>
                      update((d) => (d.behavior.behaviors[name]!.weight = Number(e.target.value) || 0))
                    }
                  />
                </label>
              </li>
            );
          })}
        </ul>
      </Panel>

      <Panel title="Access & security">
        <div className="flex flex-col gap-4">
          <Toggle
            checked={c.auth.tokenUrl.enabled}
            onChange={(v) => update((d) => (d.auth.tokenUrl.enabled = v))}
            label="Token access URL"
            hint="Shareable link with an embedded access token."
          />
          {c.auth.tokenUrl.enabled && c.auth.tokenUrl.token && (
            <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-border bg-surface-2 px-3 py-2">
              <Badge tone="accent">token</Badge>
              <code className="truncate font-mono text-xs text-muted">
                {`${window.location.origin}/?token=${c.auth.tokenUrl.token}`}
              </code>
            </div>
          )}
          <Toggle
            checked={c.auth.ipAllowlist.enabled}
            onChange={(v) => update((d) => (d.auth.ipAllowlist.enabled = v))}
            label="IP allowlist"
            hint="Only these IPs may reach the dashboard."
          />
          {c.auth.ipAllowlist.enabled && (
            <Field label="Allowed IPs" htmlFor="c-ips" hint="One IP per line.">
              <Textarea
                id="c-ips"
                value={c.auth.ipAllowlist.entries.join('\n')}
                onChange={(e) =>
                  update(
                    (d) =>
                      (d.auth.ipAllowlist.entries = e.target.value
                        .split('\n')
                        .map((s) => s.trim())
                        .filter(Boolean)),
                  )
                }
              />
            </Field>
          )}
        </div>
      </Panel>

      <AlertsPanel />
    </div>
  );
}

/**
 * Per-event alert toggles (§11) — shared with the Discord `/alerts` command via
 * the `alert_settings` table. Self-contained: fetches + persists independently of
 * the main config form.
 */
function AlertsPanel() {
  const { push } = useToast();
  const [alerts, setAlerts] = useState<AlertSetting[] | null>(null);

  useEffect(() => {
    api.alerts
      .list()
      .then((list) => setAlerts([...list].sort((a, b) => a.eventKey.localeCompare(b.eventKey))))
      .catch(() => setAlerts([]));
  }, []);

  const toggle = async (eventKey: string, enabled: boolean) => {
    setAlerts((prev) => prev?.map((a) => (a.eventKey === eventKey ? { ...a, enabled } : a)) ?? prev);
    try {
      await api.alerts.set(eventKey, enabled);
    } catch (err) {
      setAlerts((prev) =>
        prev?.map((a) => (a.eventKey === eventKey ? { ...a, enabled: !enabled } : a)) ?? prev,
      );
      push(humanizeError(err instanceof Error ? err.message : 'Failed to update alert'), 'danger');
    }
  };

  return (
    <Panel
      title="Discord alerts"
      action={<span className="text-xs text-faint">per-event push toggles</span>}
    >
      {alerts === null ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-6" />
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm text-faint">No alert settings available.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <Toggle
              key={a.eventKey}
              checked={a.enabled}
              onChange={(v) => void toggle(a.eventKey, v)}
              label={humanizeAlertKey(a.eventKey)}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function NumField({
  label,
  value,
  onChange,
  wide,
}: {
  label: string;
  value: number | null;
  onChange: (n: number | null) => void;
  wide?: boolean;
}) {
  return (
    <Field label={label} className={wide ? '' : ''}>
      <Input
        aria-label={label}
        inputMode="numeric"
        value={value ?? ''}
        placeholder="—"
        onChange={(e) => {
          const t = e.target.value.trim();
          onChange(t === '' ? null : Number(t));
        }}
      />
    </Field>
  );
}
