import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import FootballLeaguesUI from "./FootballLeaguesUI.jsx";
import League from "./pages/League.jsx";
import Matches from "./pages/Matches.jsx";
import LiveMatches from "./pages/LiveMatches.jsx";

const Page = (title) => () => (
  <div className="p-4">
    <h1 className="text-xl font-bold">{title}</h1>
    <p className="text-gray-400 mt-2">Stub page — replace with real content.</p>
  </div>
);

const AllGames = Page("All Games");
const Live = Page("LIVE");
const Favourites = Page("Favourites");
const News = Page("News");
const Search = Page("Search");
const Settings = Page("Settings");
const SportsFootball = Page("Sports • Football");

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<AllGames />} />
        <Route path="live" element={<Live />} />
        <Route path="favourites" element={<Favourites />} />
        <Route path="news" element={<News />} />

        <Route path="leagues" element={<FootballLeaguesUI />} />
        <Route path="leagues/:slug" element={<League />} />
        <Route path="matches" element={<Matches />} />

        <Route path="search" element={<Search />} />
        <Route path="settings" element={<Settings />} />
        <Route path="sports/football" element={<SportsFootball />} />
      </Route>

      <Route path="*" element={<Navigate to="/leagues" replace />} />
    </Routes>
  );
}
