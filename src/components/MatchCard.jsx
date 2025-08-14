import React from "react";

export default function MatchCard({ fixture }) {
  const home = fixture?.teams?.home;
  const away = fixture?.teams?.away;
  const goals = fixture?.goals || {};
  const league = fixture?.league;

  return (
    <div className="rounded-2xl p-4 shadow border bg-white text-black dark:bg-zinc-900 dark:text-white dark:border-zinc-800">
      <div className="text-xs opacity-70 mb-2">
        {league?.country} • {league?.name}
      </div>
      <div className="flex items-center justify-between">
        <div className="flex-1 flex items-center gap-2">
          {home?.logo && <img src={home.logo} alt="" className="h-6 w-6" />}
          <span className="font-medium">{home?.name}</span>
        </div>
        <div className="mx-3 text-lg font-semibold">
          {goals?.home ?? "-"} : {goals?.away ?? "-"}
        </div>
        <div className="flex-1 flex items-center gap-2 justify-end">
          <span className="font-medium">{away?.name}</span>
          {away?.logo && <img src={away.logo} alt="" className="h-6 w-6" />}
        </div>
      </div>
      <div className="text-xs mt-2 opacity-70">
        {fixture?.fixture?.status?.long} • {fixture?.fixture?.status?.elapsed ?? 0}'
      </div>
    </div>
  );
}
