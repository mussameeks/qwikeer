export const API_BASE = import.meta.env.VITE_FOOTBALL_API_BASE;

function headers() {
  return {
    "x-rapidapi-key": import.meta.env.VITE_RAPIDAPI_KEY,
    "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
  };
}

export async function fetchLiveFixtures() {
  const url = `${API_BASE}/fixtures?live=all`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data?.response ?? [];
}

export async function fetchFixturesByDate(dateStr) {
  const url = `${API_BASE}/fixtures?date=${dateStr}`;
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data?.response ?? [];
}
