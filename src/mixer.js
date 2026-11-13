export const PARTS = ["spout", "head", "body", "tail"];
export function initialMix(items, search = "") {
  const params = new URLSearchParams(search);
  const parts = Object.fromEntries(
    PARTS.map((key, i) => [
      key,
      items.some((item) => item.id === params.get(key))
        ? params.get(key)
        : items[i % items.length].id,
    ]),
  );
  const value = Number(params.get("seam"));
  const softness =
    params.has("seam") && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : 20;
  return { parts, softness };
}
export function shareUrl(href, parts, softness) {
  const url = new URL(href);
  PARTS.forEach((key) => url.searchParams.set(key, parts[key]));
  url.searchParams.set("seam", softness);
  return url.href;
}
