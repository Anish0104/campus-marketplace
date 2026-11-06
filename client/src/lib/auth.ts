/** Allow only paths on this origin, including after URL normalization. */
export function safeReturnPath(value: string | null, fallback = "/") {
  if (!value?.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u0020]/.test(value)) return fallback;
  return value;
}
