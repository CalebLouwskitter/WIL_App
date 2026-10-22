import * as nodePath from 'path';

/** Subset of `fs` used here; injectable so tests can use a temp directory. */
export interface GoogleServicesFs {
  existsSync(path: string): boolean;
  writeFileSync(path: string, data: string, encoding: 'utf8'): void;
}

export const DEFAULT_GOOGLE_SERVICES_FILE = './google-services.json';

/**
 * Resolve `android.googleServicesFile` from GOOGLE_SERVICES_JSON.
 *
 * - An existing file path (an EAS file secret) is returned as-is.
 * - A JSON payload (trimmed, starts with `{`) is written to `<dir>/google-services.json`
 *   and that path is returned.
 * - Anything else (unset, empty, an unresolved `@secret` reference) falls back to
 *   `./google-services.json`.
 *
 * The value is a credential: it is never logged, and write failures report only the
 * error code.
 */
export function resolveGoogleServicesFile(
  env: Record<string, string | undefined>,
  fs: GoogleServicesFs,
  dir: string
): string {
  const value = env.GOOGLE_SERVICES_JSON?.trim();
  if (!value) return DEFAULT_GOOGLE_SERVICES_FILE;

  if (!value.startsWith('{') && fs.existsSync(value)) return value;

  if (value.startsWith('{')) {
    const target = nodePath.join(dir, 'google-services.json');
    try {
      fs.writeFileSync(target, value, 'utf8');
      return target;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException)?.code ?? 'unknown';
      console.warn(`Failed to write google-services.json from GOOGLE_SERVICES_JSON (${code}).`);
    }
  }

  return DEFAULT_GOOGLE_SERVICES_FILE;
}
