import React, { useEffect, useState } from "react";
import { fetchLiveFixtures } from "../services/apiFootball";
import MatchCard from "../components/MatchCard";

export default function LiveMatches() {
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  async function load() {
    try {
      setErr(null);
      const data = await fetchLiveFixtures();
      setFixtures(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <div className="p-6">Loading live matches…</div>;
  if (err) return <div className="p-6 text-red-500">Error: {err}</div>;

  if (!fixtures.length) {
    return <div className="p-6">No live matches right now.</div>;
  }

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-3">
      <h1 className="text-2xl font-bold mb-2">Live Matches</h1>
      {fixtures.map((item) => (
        <MatchCard key={item.fixture?.id} fixture={item} />
      ))}
    </div>
  );
}
