import React from "react";
import { useLocation } from "react-router-dom";
import { matchesByDate } from "../data.js";

export default function Matches() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const date = params.get("date") || "Unknown date";

  const items = matchesByDate[date] || [];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Matches — {date}</h1>

      {items.length === 0 ? (
        <p className="text-gray-400">No matches for this date (mock data).</p>
      ) : (
        <div className="space-y-3">
          {items.map((m) => (
            <div key={m.id} className="bg-gray-900 p-3 rounded-lg flex justify-between">
              <div>
                <div className="text-xs text-gray-400">{m.comp}</div>
                <div className="font-semibold">{m.home} vs {m.away}</div>
                <div className="text-sm text-gray-400">{m.time}</div>
              </div>
              <div className="font-bold text-red-500">{m.score}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
