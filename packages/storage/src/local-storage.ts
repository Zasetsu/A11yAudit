import { lstat, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import type { StorageAdapter, StoredArtifact } from "./storage.js";

export interface LocalStorageOptions {
  rootDir: string;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly rootDir: string;

  constructor(options: LocalStorageOptions) {
    this.rootDir = resolve(options.rootDir);
  }

  async put(key: string, body: Buffer, mimeType: string): Promise<StoredArtifact> {
    const path = await this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
    return { key, mimeType, sizeBytes: body.byteLength };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(await this.resolveKey(key));
  }

  async delete(key: string): Promise<void> {
    await rm(await this.resolveKey(key), { force: true });
  }

  private async resolveKey(key: string): Promise<string> {
    if (key.length === 0 || isAbsolute(key) || /^[A-Za-z]:[\\/]/.test(key)) {
      throw new Error("Storage key cannot escape rootDir");
    }

    const path = resolve(this.rootDir, key.replace(/\\/g, "/"));
    const relativePath = relative(this.rootDir, path);

    if (relativePath === "" || relativePath.startsWith("..") || isAbsolute(relativePath)) {
      throw new Error("Storage key cannot escape rootDir");
    }

    await this.assertNoSymlinkComponents(relativePath);
    return path;
  }

  private async assertNoSymlinkComponents(relativePath: string): Promise<void> {
    let currentPath = this.rootDir;

    for (const segment of relativePath.split(sep)) {
      currentPath = join(currentPath, segment);

      try {
        const stats = await lstat(currentPath);
        if (stats.isSymbolicLink()) {
          throw new Error("Storage key cannot contain symlinks");
        }
      } catch (error) {
        if (error instanceof Error && "code" in error && error.code === "ENOENT") {
          return;
        }

        throw error;
      }
    }
  }
}
