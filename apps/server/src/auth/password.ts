import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const PASSWORD_HASH_SCHEME = "scrypt";
const PASSWORD_HASH_VERSION = "v1";
const SCRYPT_N = 16_384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const SALT_BYTES = 16;
const HASH_BYTES = 64;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

type ScryptParams = {
  N: number;
  r: number;
  p: number;
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await derivePasswordHash(password, salt, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });

  return [
    PASSWORD_HASH_SCHEME,
    PASSWORD_HASH_VERSION,
    SCRYPT_N.toString(),
    SCRYPT_R.toString(),
    SCRYPT_P.toString(),
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const parsed = parsePasswordHash(storedHash);

  if (parsed === null) {
    return false;
  }

  try {
    const hash = await derivePasswordHash(password, parsed.salt, parsed.params);

    if (hash.length !== parsed.hash.length) {
      return false;
    }

    return timingSafeEqual(hash, parsed.hash);
  } catch {
    return false;
  }
}

async function derivePasswordHash(password: string, salt: Buffer, params: ScryptParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      HASH_BYTES,
      {
        N: params.N,
        r: params.r,
        p: params.p,
        maxmem: SCRYPT_MAXMEM,
      },
      (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey);
      },
    );
  });
}

function parsePasswordHash(storedHash: string): { params: ScryptParams; salt: Buffer; hash: Buffer } | null {
  const parts = storedHash.split("$");

  if (parts.length !== 7) {
    return null;
  }

  const [scheme, version, nText, rText, pText, saltText, hashText] = parts;

  if (scheme !== PASSWORD_HASH_SCHEME || version !== PASSWORD_HASH_VERSION) {
    return null;
  }

  if (!saltText || !hashText || !BASE64URL_PATTERN.test(saltText) || !BASE64URL_PATTERN.test(hashText)) {
    return null;
  }

  const params = {
    N: parsePositiveInteger(nText),
    r: parsePositiveInteger(rText),
    p: parsePositiveInteger(pText),
  };

  if (params.N === null || params.r === null || params.p === null) {
    return null;
  }

  if (params.N !== SCRYPT_N || params.r !== SCRYPT_R || params.p !== SCRYPT_P) {
    return null;
  }

  const salt = Buffer.from(saltText, "base64url");
  const hash = Buffer.from(hashText, "base64url");

  if (salt.length === 0 || hash.length !== HASH_BYTES) {
    return null;
  }

  return {
    params: {
      N: params.N,
      r: params.r,
      p: params.p,
    },
    salt,
    hash,
  };
}

function parsePositiveInteger(value: string | undefined): number | null {
  if (value === undefined || !/^[1-9]\d*$/.test(value)) {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) {
    return null;
  }

  return parsed;
}
