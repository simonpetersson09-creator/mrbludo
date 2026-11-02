export const AVATARS = ["🎲", "🦁", "🐯", "🦊", "🐼", "🐸", "🐙", "🦄", "🐲", "🚀", "⚽", "👑"];
export const COUNTRIES = ["SE", "NO", "DK", "FI", "IS", "DE", "GB", "US", "FR", "ES", "IT", "NL", "PL", "TR", "IN", "BR", "MX", "CA", "AU", "JP"];
export function flag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
