/**
 * IP allowlist (masterdoc §8.2) — the optional "super-security" layer.
 *
 * Exact-match against a configured list (IPv4/IPv6). Handles the common IPv4
 * mapped-in-IPv6 form (`::ffff:1.2.3.4`) that Node reports behind some proxies.
 */

/** Normalize an address for comparison (strip IPv4-mapped IPv6 prefix). */
function normalize(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}

/** True if `ip` matches one of the allowlist `entries`. */
export function isIpAllowed(ip: string | undefined, entries: string[]): boolean {
  if (!ip) return false;
  const target = normalize(ip);
  return entries.some((e) => normalize(e.trim()) === target);
}
