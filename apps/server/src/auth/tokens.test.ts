import { describe, expect, it } from "vitest";

import { createPlainToken, hashToken } from "./tokens.js";

describe("token primitives", () => {
  it("hashes tokens without storing plaintext", () => {
    const token = createPlainToken();
    const hash = hashToken(token);

    expect(token).not.toEqual(hash);
    expect(hash).toHaveLength(64);
  });

  it("creates base64url tokens from 32 random bytes", () => {
    const token = createPlainToken();

    expect(token).toHaveLength(43);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("creates unique plaintext tokens", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => createPlainToken()));

    expect(tokens.size).toBe(20);
  });
});
