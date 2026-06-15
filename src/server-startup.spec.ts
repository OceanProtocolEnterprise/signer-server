import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  getServerPort,
  getTlsOptions,
  getTlsPaths,
  shouldWarnAboutPartialTlsConfig,
} from './server-startup';

describe('server startup', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'signer-server-test-'),
    );
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
    jest.restoreAllMocks();
  });

  it('uses the signer default port', () => {
    expect(getServerPort({})).toBe(3001);
  });

  it('normalizes TLS paths from the environment', () => {
    expect(
      getTlsPaths({
        HTTP_CERT_PATH: ' /cert.pem ',
        HTTP_KEY_PATH: ' /key.pem ',
      }),
    ).toEqual({
      certPath: '/cert.pem',
      keyPath: '/key.pem',
    });
  });

  it('returns TLS options when both files can be loaded', () => {
    const certPath = path.join(tempDir, 'cert.pem');
    const keyPath = path.join(tempDir, 'key.pem');
    fs.writeFileSync(certPath, 'cert-content');
    fs.writeFileSync(keyPath, 'key-content');

    expect(getTlsOptions({ certPath, keyPath })).toEqual({
      cert: Buffer.from('cert-content'),
      key: Buffer.from('key-content'),
    });
  });

  it('falls back when TLS files cannot be loaded', () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation();

    expect(
      getTlsOptions({
        certPath: path.join(tempDir, 'missing-cert.pem'),
        keyPath: path.join(tempDir, 'missing-key.pem'),
      }),
    ).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unable to load HTTPS certificate files:',
      ),
    );
  });

  it('detects partial TLS configuration', () => {
    expect(
      shouldWarnAboutPartialTlsConfig({
        certPath: '/cert.pem',
      }),
    ).toBe(true);
    expect(
      shouldWarnAboutPartialTlsConfig({
        certPath: '/cert.pem',
        keyPath: '/key.pem',
      }),
    ).toBe(false);
  });
});
