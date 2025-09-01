import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import FootballLeaguesUI from "./components/FootballLeaguesUI.jsx";
import League from "./pages/League.jsx";
import Matches from "./pages/Matches.jsx";
import Feed from "./pages/Feed.jsx";

// stub page factory
const Page = (title) => () => (
  <div className="p-4">
    <h1 className="text-xl font-bold">{title}</h1>
    <p className="text-gray-400 mt-2">Stub page — replace with real content.</p>
  </div>
);

const Live = Page("LIVE");
const Favourites = Page("Favourites");
const Search = Page("Search");
const SportsFootball = Page("Sports • Football");
const Settings = Page("Settings");

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        {/* Home */}
        <Route index element={<FootballLeaguesUI />} />

        {/* Tabs */}
        <Route path="live" element={<Live />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="feed" element={<Feed />} />
        <Route path="settings" element={<Settings />} />

        {/* Details */}
        <Route path="leagues/:slug" element={<League />} />
        <Route path="matches" element={<Matches />} />

        {/* Extras */}
        <Route path="search" element={<Search />} />
        <Route path="sports/football" element={<SportsFootball />} />

        {/* Back-compat */}
        <Route path="leagues" element={<Navigate to="/" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
