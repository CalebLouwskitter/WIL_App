import { buildSosShareMessage, mapsLink, whatsAppShareUrls } from '../utils/sosShare';

describe('sosShare helper', () => {
  it('builds a maps link from a fix, rounded to 6 decimals', () => {
    expect(mapsLink({ latitude: -34.0312345678, longitude: 25.5 })).toBe('https://maps.google.com/?q=-34.031235,25.500000');
  });

  it('refuses unusable coordinates', () => {
    expect(mapsLink({ latitude: NaN, longitude: 25 })).toBeNull();
    expect(mapsLink({ latitude: 91, longitude: 25 })).toBeNull();
    expect(mapsLink({ latitude: -34, longitude: 181 })).toBeNull();
    expect(buildSosShareMessage({ latitude: Infinity, longitude: 0 })).toBeNull();
  });

  it('asks for help with the location, without claiming an SBHRA alert or a live location', () => {
    const message = buildSosShareMessage({ latitude: -34.03, longitude: 25.5 });
    expect(message).toBe(
      '🚨 EMERGENCY: I need help.\nMy location when I sent this:\nhttps://maps.google.com/?q=-34.030000,25.500000\n\nTap the link to open it in Google Maps.'
    );
    expect(message).not.toMatch(/SBHRA/i);
    expect(message).not.toMatch(/live/i);
    expect(message).not.toMatch(/alert (was )?sent/i);
  });

  it('encodes the whole message into both the app and web URLs', () => {
    const message = buildSosShareMessage({ latitude: -34.03, longitude: 25.5 })!;
    const { app, web } = whatsAppShareUrls(message);
    const encoded = encodeURIComponent(message);
    expect(app).toBe(`whatsapp://send?text=${encoded}`);
    expect(web).toBe(`https://wa.me/?text=${encoded}`);
    // Newlines, emoji, "?", "&"-safe: nothing unescaped can split the query string
    expect(encoded).not.toMatch(/[\n ?&=]/);
    expect(encoded).toContain('%0A');
    expect(encoded).toContain('%F0%9F%9A%A8');
    expect(decodeURIComponent(app.split('text=')[1])).toBe(message);
  });
});
