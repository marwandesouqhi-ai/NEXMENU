import { describe, expect, it } from "vitest";
import { hashPassword, InsecureContextCryptoError } from "@/data/adapters/local/crypto";

describe("Phase A Finding 5 / Phase C: Local Crypto Incompatibility Audit", () => {
  it("verifies that insecure contexts fail fast with InsecureContextCryptoError and cannot produce weak fallback hashes", async () => {
    // 1. Simulate hashing in an insecure context (crypto.subtle is undefined)
    const originalSubtle = globalThis.crypto?.subtle;
    try {
      // Force insecure context by temporarily hiding crypto.subtle
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: undefined,
        configurable: true,
      });

      // Instead of silently producing an incompatible weak hash, it must throw InsecureContextCryptoError
      await expect(hashPassword("mySecretPassword123")).rejects.toThrow(InsecureContextCryptoError);
    } finally {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });
    }

    // In a restored/secure context, PBKDF2 hashing works consistently
    const secureResult = await hashPassword("mySecretPassword123");
    expect(secureResult.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(secureResult.salt).toMatch(/^[0-9a-f]{32}$/);
  });
});
