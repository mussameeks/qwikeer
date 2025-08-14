import React from "react";
import { useParams, useLocation } from "react-router-dom";

export default function League() {
  const { slug } = useParams();
  const qs = new URLSearchParams(useLocation().search);
  const region = qs.get("region");

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold capitalize">{slug.replace(/-/g, " ")}</h1>
      {region && <p className="text-gray-400 text-sm">Region: {region}</p>}
      <div className="mt-4 text-gray-300">League details go here…</div>
    </div>
  );
}
