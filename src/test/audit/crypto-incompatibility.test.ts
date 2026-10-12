import { describe, expect, it } from "vitest";
import { hashPassword } from "@/data/adapters/local/crypto";

describe("Phase A Finding 5: Local Crypto Incompatibility Audit", () => {
  it("proves that fallback hash output is incompatible with standard PBKDF2 verification", async () => {
    // 1. Simulate hashing in an insecure context (crypto.subtle is undefined)
    const originalSubtle = globalThis.crypto?.subtle;
    try {
      // Force fallback path by temporarily hiding crypto.subtle
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: undefined,
        configurable: true,
      });

      const fallbackResult = await hashPassword("mySecretPassword123");
      expect(fallbackResult.hash).toBeDefined();
      expect(fallbackResult.salt).toBeDefined();

      // 2. Restore crypto.subtle (simulate user now logging in on localhost / HTTPS)
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });

      // Verify the password using the salt from the fallback hash
      const secureResult = await hashPassword("mySecretPassword123", fallbackResult.salt);

      // The hashes do not match! This proves the lockout issue across environments.
      expect(secureResult.hash).not.toEqual(fallbackResult.hash);
    } finally {
      Object.defineProperty(globalThis.crypto, "subtle", {
        value: originalSubtle,
        configurable: true,
      });
    }
  });
});
