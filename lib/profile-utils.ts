/** Suggests a starting username from the Google account's email or name. */
export function suggestHandle(seed: string): string {
  const cleaned = seed
    .toLowerCase()
    .replace(/@.*/, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
  return cleaned || "collector";
}
