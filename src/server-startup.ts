import * as fs from 'fs';
import type { HttpsOptions } from '@nestjs/common/interfaces/external/https-options.interface';

export interface TlsPaths {
  certPath?: string;
  keyPath?: string;
}

export function getServerPort(env: NodeJS.ProcessEnv = process.env): number {
  return parseInt(env.PORT || '3001', 10);
}

function normalizePath(value?: string): string | undefined {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

export function getTlsPaths(env: NodeJS.ProcessEnv = process.env): TlsPaths {
  return {
    certPath: normalizePath(env.HTTP_CERT_PATH),
    keyPath: normalizePath(env.HTTP_KEY_PATH),
  };
}

export function getTlsOptions({
  certPath,
  keyPath,
}: TlsPaths): HttpsOptions | null {
  if (!certPath || !keyPath) {
    return null;
  }

  try {
    // TLS file paths are supplied by deployment configuration.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const cert = fs.readFileSync(certPath);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const key = fs.readFileSync(keyPath);
    return { cert, key };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.warn(
      `Unable to load HTTPS certificate files: ${message}. Starting HTTP server.`,
    );
    return null;
  }
}

export function shouldWarnAboutPartialTlsConfig({
  certPath,
  keyPath,
}: TlsPaths): boolean {
  return Boolean(certPath) !== Boolean(keyPath);
}
