/**
 * Text and links for the rider's own WhatsApp location share.
 *
 * This is separate from the SBHRA alert: the rider picks the recipient and sends it themselves,
 * so the wording never says the message came from, or went through, SBHRA.
 */

export type ShareCoords = { latitude: number; longitude: number };

export type WhatsAppShareUrls = {
  /** Opens the WhatsApp app's composer directly. */
  app: string;
  /** Web fallback when the app scheme can't be opened. */
  web: string;
};

/** Google Maps link for a fix, or null when the coordinates aren't usable. */
export function mapsLink({ latitude, longitude }: ShareCoords): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** The message the rider sends. The location is a one-off fix, not a live share. */
export function buildSosShareMessage(coords: ShareCoords): string | null {
  const link = mapsLink(coords);
  if (!link) return null;
  return `🚨 EMERGENCY: I need help.\nMy location when I sent this:\n${link}\n\nTap the link to open it in Google Maps.`;
}

export function whatsAppShareUrls(message: string): WhatsAppShareUrls {
  const text = encodeURIComponent(message);
  return {
    app: `whatsapp://send?text=${text}`,
    web: `https://wa.me/?text=${text}`,
  };
}
