import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import FootballLeaguesUI from "./FootballLeaguesUI.jsx";
import League from "./pages/League.jsx";
import Matches from "./pages/Matches.jsx";

// Simple stub page factory so the app runs even if views are not built yet
const Page = (title) => () => (
  <div className="p-4">
    <h1 className="text-xl font-bold">{title}</h1>
    <p className="text-gray-400 mt-2">Stub page — replace with real content.</p>
  </div>
);

const Live = Page("LIVE");
const Favourites = Page("Favourites");
const News = Page("News");
const Search = Page("Search");
const Settings = Page("Settings");
const SportsFootball = Page("Sports • Football");

export default function App() {
  return (
    <Routes>
      {/* All main screens share the AppLayout (top bar + bottom tabs) */}
      <Route element={<AppLayout />}>

        {/* HOME: now shows Leagues (date scroller + league list) */}
        <Route index element={<FootballLeaguesUI />} />

        {/* Other tabs */}
        <Route path="live" element={<Live />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="news" element={<News />} />

        {/* Leagues details & matches */}
        <Route path="leagues/:slug" element={<League />} />
        <Route path="matches" element={<Matches />} />

        {/* Additions */}
        <Route path="search" element={<Search />} />
        <Route path="settings" element={<Settings />} />
        <Route path="sports/football" element={<SportsFootball />} />

        {/* Back-compat: keep old /leagues URL working */}
        <Route path="leagues" element={<Navigate to="/" replace />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
