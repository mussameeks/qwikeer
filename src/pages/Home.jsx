import React, { useEffect, useState } from 'react';

function Home() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('https://v3.football.api-sports.io/fixtures?live=all', {
      headers: {
        'x-apisports-key': '8c4f13a1a0a5587bfe0455ae76e58583'
      }
    })
    .then(res => res.json())
    .then(data => {
      setMatches(data.response || []);
      setLoading(false);
    })
    .catch(err => {
      console.error('API fetch error:', err);
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <h1>Live Matches</h1>
      {loading ? (
        <p>Loading matches...</p>
      ) : matches.length === 0 ? (
        <p>No live matches right now.</p>
      ) : (
        <ul>
          {matches.map((match, i) => (
            <li key={i}>
              {match.teams.home.name} vs {match.teams.away.name} — {match.fixture.status.long}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default Home;
