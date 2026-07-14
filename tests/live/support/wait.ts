/** Poll `predicate` until true or `timeoutMs` elapses. */
export async function waitFor(
  predicate: () => boolean,
  { timeoutMs = 20_000, intervalMs = 200, label = 'condition' } = {},
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out after ${timeoutMs}ms waiting for: ${label}`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
