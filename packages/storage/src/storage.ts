export interface StoredArtifact {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StorageAdapter {
  put(key: string, body: Buffer, mimeType: string): Promise<StoredArtifact>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}
