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
});
