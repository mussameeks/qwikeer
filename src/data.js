export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

// Home chips & comps
export const dates = [
  { label: "SAT", date: "09.08" },
  { label: "SUN", date: "10.08" },
  { label: "MON", date: "11.08" },
  { label: "TODAY", date: "12.08", active: true },
  { label: "WED", date: "13.08" },
  { label: "THU", date: "14.08" },
  { label: "FRI", date: "15.08" },
];

export const favouriteCompetitions = [
  { region: "ENGLAND", name: "EFL Cup", flag: "🇬🇧", badge: 1, total: 30 },
  { region: "EUROPE", name: "Champions League", flag: "🇪🇺", badge: 7, total: 10 },
  { region: "EUROPE", name: "Europa League", flag: "🇪🇺", badge: 1, total: 1 },
];

export const otherCompetitions = [
  { region: "AFRICA", name: "African Nations Championship", flag: "🌍", badge: 1, total: 2 },
  { region: "ARGENTINA", name: "Torneo Betano", flag: "🇦🇷", total: 1 },
  { region: "ARGENTINA", name: "Primera Nacional", flag: "🇦🇷", total: 2 },
  { region: "ARGENTINA", name: "Reserve League", flag: "🇦🇷", badge: 4, total: 5 },
  { region: "ARGENTINA", name: "Primera A Women", flag: "🇦🇷", total: 1 },
  { region: "ARMENIA", name: "First League", flag: "🇦🇲", total: 4 },
  { region: "ASIA", name: "AFC Champions League", flag: "🌏", total: 2 },
];

// Matches by date (mock)
export const matchesByDate = {
  "12.08": [
    { id: 1, comp: "EFL Cup", home: "Team A", away: "Team B", time: "18:00", score: "2 - 1" },
    { id: 2, comp: "Champions League", home: "Team C", away: "Team D", time: "20:00", score: "0 - 0" },
    { id: 3, comp: "Europa League", home: "Team E", away: "Team F", time: "21:30", score: "1 - 3" },
  ],
  "13.08": [
    { id: 4, comp: "Primera Nacional", home: "River B", away: "Boca B", time: "17:00", score: "-" },
  ],
};

// League tables (mock keyed by slug)
export const leagueTables = {
  [slugify("EFL Cup")]: [
    { name: "Manchester United", points: 45 },
    { name: "Chelsea", points: 42 },
    { name: "Arsenal", points: 40 },
  ],
  [slugify("Champions League")]: [
    { name: "Real Madrid", points: 15 },
    { name: "Bayern Munich", points: 13 },
    { name: "Inter", points: 12 },
  ],
};

// Feed items (mock)
export const feedItems = [
  { id: "n1", title: "Breaking: Big derby tonight", source: "Sky Sports", time: "2h" },
  { id: "n2", title: "Injury update: key striker fit", source: "BBC Sport", time: "5h" },
];
