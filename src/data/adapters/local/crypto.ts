const encoder = new TextEncoder();
const toHex = (bytes: Uint8Array) => [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [])
    : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 }, key, 256,
  );
  return { hash: toHex(new Uint8Array(bits)), salt: toHex(salt) };
}
