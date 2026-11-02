/** Match codes are 6 characters (see makeCode). A QR code holds the code, raw or as a ?code= link. */
export function parseMatchCode(text: string): string | null {
  try {
    const c = new URL(text).searchParams.get("code");
    if (c && /^[A-Z0-9]{6}$/i.test(c)) return c.toUpperCase();
  } catch { /* not a link */ }
  const raw = text.trim().toUpperCase();
  return /^[A-Z0-9]{6}$/.test(raw) ? raw : null;
}

/** What the waiting room's QR code contains; scanned by the app's own scanner. */
export const matchQrValue = (code: string) => `mrbludo://join?code=${code}`;
