import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { resolveGoogleServicesFile } from '../config/googleServices';

describe('resolveGoogleServicesFile', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gservices-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns an existing file path (EAS file secret) unchanged', () => {
    const secretFile = path.join(dir, 'secret-file.json');
    fs.writeFileSync(secretFile, '{}', 'utf8');

    expect(resolveGoogleServicesFile({ GOOGLE_SERVICES_JSON: secretFile }, fs, dir)).toBe(secretFile);
    expect(fs.existsSync(path.join(dir, 'google-services.json'))).toBe(false);
  });

  it('materializes a JSON payload into <dir>/google-services.json', () => {
    const resolved = resolveGoogleServicesFile({ GOOGLE_SERVICES_JSON: '  {}\n' }, fs, dir);

    expect(resolved).toBe(path.join(dir, 'google-services.json'));
    expect(fs.readFileSync(resolved, 'utf8')).toBe('{}');
  });

  it('defaults to ./google-services.json when unset, empty or not a file/payload', () => {
    expect(resolveGoogleServicesFile({}, fs, dir)).toBe('./google-services.json');
    expect(resolveGoogleServicesFile({ GOOGLE_SERVICES_JSON: '  ' }, fs, dir)).toBe('./google-services.json');
    expect(resolveGoogleServicesFile({ GOOGLE_SERVICES_JSON: '@google-services-json' }, fs, dir)).toBe(
      './google-services.json'
    );
    expect(fs.readdirSync(dir)).toHaveLength(0);
  });

  it('falls back without logging the payload when the write fails', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const failingFs = {
      existsSync: () => false,
      writeFileSync: () => {
        throw Object.assign(new Error('EACCES: permission denied, open <payload>'), { code: 'EACCES' });
      },
    };

    expect(resolveGoogleServicesFile({ GOOGLE_SERVICES_JSON: '{"k":"s3cret"}' }, failingFs, dir)).toBe(
      './google-services.json'
    );
    const logged = JSON.stringify(warn.mock.calls);
    expect(logged).toContain('EACCES');
    expect(logged).not.toContain('s3cret');
    warn.mockRestore();
  });
});
