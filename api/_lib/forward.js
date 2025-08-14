export const FOOTBALL_API_BASE = process.env.FOOTBALL_API_BASE || 'https://api-football-v1.p.rapidapi.com/v3';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

export async function forward(pathWithQuery) {
  const url = `${FOOTBALL_API_BASE}${pathWithQuery}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}
