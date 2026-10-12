const encoder = new TextEncoder();
const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

function fallbackHash(password: string, salt: Uint8Array): { hash: string; salt: string } {
  // Deterministic 256-bit bitwise mixing fallback for insecure HTTP / LAN testing
  // when window.crypto.subtle is restricted by browser security policies
  const combined = new Uint8Array(password.length + salt.length);
  for (let i = 0; i < password.length; i++) combined[i] = password.charCodeAt(i);
  combined.set(salt, password.length);

  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  let h3 = 0x6a09e667;
  let h4 = 0xbb67ae85;

  for (let round = 0; round < 1000; round++) {
    for (let i = 0; i < combined.length; i++) {
      const b = combined[i] ^ (round & 0xff);
      h1 = Math.imul(h1 ^ b, 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ ((b << 4) | (b >>> 4)), 0x5bd1e995) >>> 0;
      h3 = Math.imul(h3 ^ ((b + i) & 0xff), 0x27d4eb2d) >>> 0;
      h4 = Math.imul(h4 ^ (b * 31), 0x165667b1) >>> 0;
    }
  }

  const out = new Uint8Array(32);
  const view = new DataView(out.buffer);
  view.setUint32(0, h1);
  view.setUint32(4, h2);
  view.setUint32(8, h3);
  view.setUint32(12, h4);
  view.setUint32(16, (h1 ^ h3) >>> 0);
  view.setUint32(20, (h2 ^ h4) >>> 0);
  view.setUint32(24, (h1 + h2) >>> 0);
  view.setUint32(28, (h3 + h4) >>> 0);

  return { hash: toHex(out), salt: toHex(salt) };
}

export async function hashPassword(password: string, saltHex?: string) {
  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [])
    : (typeof globalThis.crypto?.getRandomValues === "function"
        ? globalThis.crypto.getRandomValues(new Uint8Array(16))
        : new Uint8Array(16).map(() => Math.floor(Math.random() * 256)));

  if (globalThis.crypto?.subtle?.importKey) {
    try {
      const key = await globalThis.crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveBits"],
      );
      const bits = await globalThis.crypto.subtle.deriveBits(
        { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120_000 },
        key,
        256,
      );
      return { hash: toHex(new Uint8Array(bits)), salt: toHex(salt) };
    } catch {
      // Fallback if browser environment restricts subtle crypto
    }
  }

  return fallbackHash(password, salt);
}
