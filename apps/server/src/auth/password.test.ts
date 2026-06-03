import { scryptSync } from "node:crypto";

import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password.js";

describe("password primitives", () => {
  it("stores scrypt hashes in versioned format and verifies them", async () => {
    const hash = await hashPassword("correct horse battery staple");

    expect(hash.startsWith("scrypt$v1$")).toBe(true);
    await expect(verifyPassword("correct horse battery staple", hash)).resolves.toBe(true);
    await expect(verifyPassword("wrong", hash)).resolves.toBe(false);
  });

  it("returns false for malformed and unsupported hashes", async () => {
    await expect(verifyPassword("secret", "")).resolves.toBe(false);
    await expect(verifyPassword("secret", "argon2$v1$16384$8$1$salt$hash")).resolves.toBe(false);
    await expect(verifyPassword("secret", "scrypt$v2$16384$8$1$salt$hash")).resolves.toBe(false);
    await expect(verifyPassword("secret", "scrypt$v1$bad$8$1$salt$hash")).resolves.toBe(false);
    await expect(verifyPassword("secret", "scrypt$v1$16384$8$1$salt")).resolves.toBe(false);
  });

  it("returns false when the stored hash length does not match the derived hash length", async () => {
    const hash = await hashPassword("secret");
    const parts = hash.split("$");
    parts[6] = parts[6]?.slice(0, -2) ?? "";

    await expect(verifyPassword("secret", parts.join("$"))).resolves.toBe(false);
  });

  it("rejects hashes when stored scrypt parameters do not exactly match this scheme", async () => {
    const password = "secret";
    const hash = await hashPassword(password);
    const [, , , , , saltText] = hash.split("$");
    const salt = Buffer.from(saltText ?? "", "base64url");

    const unsupportedHashes = [
      forgeHash(hash, password, salt, { N: 1024, r: 8, p: 1 }),
      forgeHash(hash, password, salt, { N: 16_384, r: 4, p: 1 }),
      forgeHash(hash, password, salt, { N: 16_384, r: 8, p: 2 }),
    ];

    for (const unsupportedHash of unsupportedHashes) {
      await expect(verifyPassword(password, unsupportedHash)).resolves.toBe(false);
    }
  });
});

function forgeHash(
  storedHash: string,
  password: string,
  salt: Buffer,
  params: { N: number; r: number; p: number },
): string {
  const parts = storedHash.split("$");
  const forgedHash = scryptSync(password, salt, 64, {
    N: params.N,
    r: params.r,
    p: params.p,
    maxmem: 64 * 1024 * 1024,
  });

  parts[2] = params.N.toString();
  parts[3] = params.r.toString();
  parts[4] = params.p.toString();
  parts[6] = forgedHash.toString("base64url");

  return parts.join("$");
}
