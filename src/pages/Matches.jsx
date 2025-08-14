import React from "react";
import { useLocation } from "react-router-dom";

export default function Matches() {
  const qs = new URLSearchParams(useLocation().search);
  const date = qs.get("date");

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Matches</h1>
      {date && <p className="text-gray-400 text-sm">Date: {date}</p>}
      <div className="mt-4 text-gray-300">Match list for the chosen date…</div>
    </div>
  );
}
