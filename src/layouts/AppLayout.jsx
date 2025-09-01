import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { Search, Bell, Trophy, Settings as SettingsIcon, Radio, Star, Newspaper } from "lucide-react";

const TopBar = () => {
  const navigate = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-gray-800 bg-black/80 backdrop-blur">
      <div className="mx-auto flex h-12 items-center justify-between px-3">
        <button
          type="button"
          onClick={() => navigate("/search")}
          className="inline-flex items-center gap-2 text-gray-300 hover:text-white"
        >
          <Search className="h-5 w-5" />
          <span className="text-sm font-medium">Search</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/sports/football")}
            className="inline-flex items-center gap-2 rounded-md border border-gray-700 px-2 py-1 text-xs text-gray-200 hover:bg-gray-800"
          >
            <Trophy className="h-4 w-4" />
            Football
          </button>
          <button
            type="button"
            onClick={() => {}}
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-300 hover:text-white"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};

const BottomNav = () => {
  const tabs = [
    { icon: Trophy, label: "Leagues", path: "/" },
    { icon: Radio, label: "LIVE", path: "/live" },
    { icon: Star, label: "Favourites", path: "/favourites" },
    { icon: Newspaper, label: "Feed", path: "/feed" },
    { icon: SettingsIcon, label: "Settings", path: "/settings" },
  ];

  return (
    <nav className="sticky bottom-0 z-20 border-t border-gray-800 bg-black/80 backdrop-blur">
      <div className="flex items-center justify-around">
        {tabs.map(({ icon: Icon, label, path }) => (
          <NavLink
            key={label}
            to={path}
            end={path === "/"}
            className={({ isActive }) =>
              "flex flex-col items-center gap-1 px-3 py-2 text-xs " +
              (isActive ? "text-white" : "text-gray-400 hover:text-gray-200")
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
};

export default function AppLayout() {
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      <TopBar />
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
