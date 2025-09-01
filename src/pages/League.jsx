import React from "react";
import { useParams, useLocation } from "react-router-dom";
import { leagueTables } from "../data.js";

export default function League() {
  const { slug } = useParams();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const region = params.get("region") || "Unknown region";

  const table = leagueTables[slug] || [];

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold capitalize">{slug?.replace(/-/g, " ")}</h1>
      <p className="text-gray-400 mt-2">Region: {region}</p>

      <h2 className="text-lg font-semibold mt-6 mb-3">Table</h2>
      {table.length === 0 ? (
        <p className="text-gray-400">No table data for this league (mock data).</p>
      ) : (
        <ul className="space-y-2">
          {table.map((team, idx) => (
            <li key={idx} className="flex justify-between bg-gray-900 p-3 rounded-lg">
              <span>{team.name}</span>
              <span className="font-bold">{team.points} pts</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
