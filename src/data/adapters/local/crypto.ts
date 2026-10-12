const encoder = new TextEncoder();
const toHex = (bytes: Uint8Array) =>
  [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");

export class InsecureContextCryptoError extends Error {
  constructor(
    message = "Secure cryptography (Web Crypto API) is unavailable. NEXMENU requires HTTPS or localhost to ensure secure password hashing. Insecure HTTP connections over LAN are not supported.",
  ) {
    super(message);
    this.name = "InsecureContextCryptoError";
  }
}

/**
 * Hashes a password using standard Web Cryptography PBKDF2 with SHA-256 and 120,000 iterations.
 * Fails fast with InsecureContextCryptoError if the browser/runtime environment is not a secure context (HTTPS/localhost).
 */
export async function hashPassword(
  password: string,
  saltHex?: string,
): Promise<{ hash: string; salt: string }> {
  if (!globalThis.crypto?.subtle?.importKey || !globalThis.crypto?.subtle?.deriveBits) {
    throw new InsecureContextCryptoError();
  }

  const salt = saltHex
    ? new Uint8Array(saltHex.match(/.{1,2}/g)?.map((value) => Number.parseInt(value, 16)) ?? [])
    : globalThis.crypto.getRandomValues(new Uint8Array(16));

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
}
