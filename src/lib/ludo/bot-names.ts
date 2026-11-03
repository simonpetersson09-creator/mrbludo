/** Computer player names, same pool as Mr. B Yatzy. */
export const BOT_NAMES = [
  "Erik", "Anna", "Lars", "Karin", "Olle", "Lisa", "Sven", "Eva",
  "Astrid", "Gustav", "Maja", "Nils", "Sofia", "Johan", "Elin", "Magnus",
  "Linnea", "Oskar", "Hanna", "Filip", "Sara", "Anders", "Klara", "Mikael",
  "Ida", "Henrik", "Frida", "Jonas", "Emma", "Viktor",
];

export function randomBotNames(count: number, random: () => number = Math.random): string[] {
  const pool = [...BOT_NAMES];
  const out: string[] = [];
  for (let i = 0; i < count && pool.length; i++) out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  return out;
}
