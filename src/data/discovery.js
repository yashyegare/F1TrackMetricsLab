// Announced 2026 calendar, not a live schedule. Source:
// https://api.fia.com/news/fia-and-formula-1-announce-2026-calendar
export const calendar2026 = new Set(['au-1953','cn-2004','jp-1962','bh-2002','sa-2021','us-2022','ca-1978','mc-1929','es-1991','at-1969','gb-1948','be-1925','hu-1986','nl-1948','it-1922','es-2026','az-2016','sg-2008','us-2012','mx-1962','br-1940','us-2023','qa-2004','ae-2009']);
export function countryFlag(id) {
  return id.slice(0,2).toUpperCase().replace(/[A-Z]/g, c => String.fromCodePoint(127397+c.charCodeAt(0)));
}
