import { describe, expect, it } from "vitest";
import { hashPassword, InsecureContextCryptoError } from "./crypto";

describe("Local Adapter Crypto Hardening", () => {
  it("generates 256-bit PBKDF2 hash and 128-bit salt", async () => {
    const result = await hashPassword("superSecretPass123!");
    expect(result.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(result.salt).toMatch(/^[0-9a-f]{32}$/);
  });

  it("produces identical hash given the same password and salt", async () => {
    const first = await hashPassword("mySecretPassword");
    const second = await hashPassword("mySecretPassword", first.salt);
    expect(second.hash).toBe(first.hash);
    expect(second.salt).toBe(first.salt);
  });

  it("produces different hash for an incorrect password", async () => {
    const original = await hashPassword("correctPassword");
    const candidate = await hashPassword("wrongPassword", original.salt);
    expect(candidate.hash).not.toBe(original.hash);
  });

  it("fails fast with InsecureContextCryptoError when crypto.subtle is unavailable", async () => {
    const originalSubtle = globalThis.crypto?.subtle;
    try {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: undefined,
        configurable: true,
      });

      await expect(hashPassword("testPassword")).rejects.toThrow(InsecureContextCryptoError);
      await expect(hashPassword("testPassword")).rejects.toThrow(
        /Secure cryptography \(Web Crypto API\) is unavailable\. NEXMENU requires HTTPS or localhost/,
      );
    } finally {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });
    }
  });
});
