import { mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageAdapter } from "./index";

describe("LocalStorageAdapter", () => {
  it("writes and reads artifacts by key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });
      await storage.put("scans/run-1/report.txt", Buffer.from("audit report"), "text/plain");

      await expect(readFile(join(dir, "scans/run-1/report.txt"), "utf8")).resolves.toBe("audit report");
      await expect(storage.get("scans/run-1/report.txt")).resolves.toEqual(Buffer.from("audit report"));
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects keys that would escape the root directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });

      await expect(storage.put("../outside.txt", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot escape rootDir"
      );
      await expect(storage.put("/tmp/outside.txt", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot escape rootDir"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects symlink directory path components escaping the root directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    const outsideDir = await mkdtemp(join(tmpdir(), "a11yaudit-outside-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });
      await symlink(outsideDir, join(dir, "link"), "dir");

      await expect(storage.put("link/escape.txt", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot contain symlinks"
      );
      await expect(readFile(join(outsideDir, "escape.txt"), "utf8")).rejects.toThrow();
    } finally {
      await rm(dir, { recursive: true, force: true });
      await rm(outsideDir, { recursive: true, force: true });
    }
  });

  it("rejects backslash traversal escaping the root directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });

      await expect(storage.put("..\\outside.txt", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot escape rootDir"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects Windows drive paths", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });

      await expect(storage.put("C:/tmp/outside.txt", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot escape rootDir"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects dot as an artifact key", async () => {
    const dir = await mkdtemp(join(tmpdir(), "a11yaudit-"));
    try {
      const storage = new LocalStorageAdapter({ rootDir: dir });

      await expect(storage.put(".", Buffer.from("nope"), "text/plain")).rejects.toThrow(
        "Storage key cannot escape rootDir"
      );
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
