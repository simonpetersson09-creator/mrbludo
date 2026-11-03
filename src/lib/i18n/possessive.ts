/** Names already ending in s/x/z take no extra genitive s ("Lars tur", "James' turn"). */
export function possessive(text: string, name: string): string {
  if (!/[sxz]$/i.test(name)) return text;
  return text.replace(`${name}s `, `${name} `).replace(`${name}'s `, `${name}' `);
}
