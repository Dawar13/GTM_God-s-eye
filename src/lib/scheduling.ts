/**
 * Give the main thread back to the browser between slices of work, so input and paint can run
 * and no single task blocks for long. Uses `scheduler.yield()` where the browser has it (the
 * continuation keeps its place in line), else a zero-delay timeout.
 */
export function yieldToMain(): Promise<void> {
  const s = (globalThis as { scheduler?: { yield?: () => Promise<void> } }).scheduler;
  if (typeof s?.yield === "function") return s.yield();
  return new Promise((resolve) => setTimeout(resolve, 0));
}
