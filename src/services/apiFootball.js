export const API_BASE = '/api';

export async function fetchLiveFixtures() {
  const url = `${API_BASE}/fixtures/live`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data?.response ?? [];
}

export async function fetchFixturesByDate(dateStr) {
  const url = `${API_BASE}/fixtures/by-date?date=${encodeURIComponent(dateStr)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data?.response ?? [];
}
