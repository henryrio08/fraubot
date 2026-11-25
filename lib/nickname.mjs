export function normalizeNickname(value) {
  if (typeof value !== "string") return null;
  const name = value.normalize("NFC").trim().replace(/\s+/g, " ");
  return [...name].length >= 2 && [...name].length <= 20 && !/[\p{Cc}\p{Cf}]/u.test(name) ? name : null;
}
