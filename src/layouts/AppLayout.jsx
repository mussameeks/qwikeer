import React from "react";
import { Outlet, NavLink, useNavigate } from "react-router-dom";
import {
  Bell, Search, ChevronDown, Settings,
  Home, Radio, Star, Newspaper, Trophy,
} from "lucide-react";

const TopBar = () => {
  const navigate = useNavigate();
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between border-b border-gray-800 bg-black/70 px-4 py-3 backdrop-blur">
      <button type="button" onClick={() => navigate("/search")} className="rounded-md p-2 hover:bg-gray-800">
        <Search className="w-5 h-5 text-gray-200" />
      </button>

      <button
        type="button"
        onClick={() => navigate("/sports/football")}
        className="flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-gray-100 hover:bg-gray-800"
      >
        Football <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>

      <div className="flex items-center gap-1">
        <button type="button" className="rounded-md p-2 hover:bg-gray-800" aria-label="Notifications">
          <Bell className="w-5 h-5 text-gray-200" />
        </button>
        <button type="button" onClick={() => navigate("/settings")} className="rounded-md p-2 hover:bg-gray-800">
          <Settings className="w-5 h-5 text-gray-200" />
        </button>
      </div>
    </div>
  );
};

const BottomNav = () => {
  const tabs = [
    { icon: Home, label: "All Games", path: "/" },
    { icon: Radio, label: "LIVE", path: "/live" },
    { icon: Star, label: "Favourites", path: "/favourites" },
    { icon: Newspaper, label: "News", path: "/news" },
    { icon: Trophy, label: "Leagues", path: "/leagues" },
  ];
  return (
    <nav className="sticky bottom-0 z-20 grid grid-cols-5 border-t border-gray-800 bg-black/80 backdrop-blur">
      {tabs.map(({ icon: Icon, label, path }) => (
        <NavLink
          key={label}
          to={path}
          end={path === "/"}
          className={({ isActive }) =>
            "flex flex-col items-center gap-1 py-2 text-xs " +
            (isActive ? "text-white" : "text-gray-400 hover:text-gray-200")
          }
        >
          <Icon className="w-5 h-5" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-black text-white">
      <TopBar />
      <main className="pb-16">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}
