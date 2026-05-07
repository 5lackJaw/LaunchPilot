import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { env } from "@/config/env";

const algorithm = "aes-256-gcm";

export function encryptConnectionCredentials(credentials: Record<string, unknown>) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, getCredentialEncryptionKey(), iv);
  const plaintext = JSON.stringify(credentials);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

export function decryptConnectionCredentials<T extends Record<string, unknown>>(
  encryptedValue: string,
): T {
  const [version, iv, tag, encrypted] = encryptedValue.split(".");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new CredentialEncryptionError("Stored credential payload uses an unsupported format.");
  }

  const decipher = createDecipheriv(
    algorithm,
    getCredentialEncryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as T;
}

function getCredentialEncryptionKey() {
  const value = env.CONNECTION_CREDENTIALS_ENCRYPTION_KEY;

  if (!value) {
    throw new CredentialEncryptionError(
      "CONNECTION_CREDENTIALS_ENCRYPTION_KEY is required before saving provider credentials.",
    );
  }

  const candidates = [
    Buffer.from(value, "base64"),
    Buffer.from(value, "base64url"),
    Buffer.from(value, "hex"),
    Buffer.from(value, "utf8"),
  ];
  const key = candidates.find((candidate) => candidate.length === 32);

  if (!key) {
    throw new CredentialEncryptionError(
      "CONNECTION_CREDENTIALS_ENCRYPTION_KEY must decode to 32 bytes. Generate one with: openssl rand -base64 32",
    );
  }

  return key;
}

export class CredentialEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialEncryptionError";
  }
}
