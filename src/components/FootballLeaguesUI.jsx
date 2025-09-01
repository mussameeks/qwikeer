import React from "react";
import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  dates,
  favouriteCompetitions,
  otherCompetitions,
  slugify,
} from "../data.js";

const Badge = ({ value }) =>
  value ? (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white">
      {value}
    </span>
  ) : null;

const Pill = ({ value }) => (
  <span className="inline-flex items-center rounded-full border border-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-200">
    {value}
  </span>
);

const SectionHeader = ({ title }) => (
  <div className="px-4 py-2 text-[11px] font-bold tracking-widest text-gray-400">
    {title}
  </div>
);

const Row = ({ flag, name, region, badge, total, onClick }) => (
  <motion.button
    type="button"
    whileTap={{ scale: 0.98 }}
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3 bg-gray-900 hover:bg-gray-800 active:bg-gray-800 transition-colors"
  >
    <div className="text-xl leading-none">{flag}</div>

    <div className="flex-1 text-left">
      <div className="text-[10px] font-semibold tracking-wide text-gray-400">{region}</div>
      <div className="text-[15px] text-white font-medium leading-tight">{name}</div>
    </div>

    <div className="flex items-center gap-2">
      {badge !== undefined && <Badge value={badge} />}
      {total !== undefined && <Pill value={total} />}
      <ChevronRight className="w-4 h-4 text-gray-500" />
    </div>
  </motion.button>
);

const DateChip = ({ item, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      "min-w-[68px] px-3 py-2 rounded-md border text-center " +
      (item.active
        ? "bg-red-600 text-white border-red-600"
        : "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700")
    }
    aria-pressed={!!item.active}
  >
    <div className="text-[10px] font-bold tracking-widest">{item.label}</div>
    <div className="text-sm font-semibold">{item.date}</div>
  </button>
);

export default function FootballLeaguesUI() {
  const navigate = useNavigate();
  const goToDate = (d) => navigate(`/matches?date=${encodeURIComponent(d.date)}`);
  const goToLeague = (c) => navigate(`/leagues/${slugify(c.name)}?region=${encodeURIComponent(c.region)}`);

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-3 py-3">
        {dates.map((d) => (
          <DateChip key={`${d.label}-${d.date}`} item={d} onClick={() => goToDate(d)} />
        ))}
      </div>

      <SectionHeader title="FAVOURITE COMPETITIONS" />
      <div className="flex flex-col">
        {favouriteCompetitions.map((c, idx) => (
          <Row key={`fav-${c.name}-${idx}`} {...c} onClick={() => goToLeague(c)} />
        ))}
      </div>

      <SectionHeader title="OTHER COMPETITIONS" />
      <div className="flex flex-col">
        {otherCompetitions.map((c, idx) => (
          <Row key={`other-${c.name}-${idx}`} {...c} onClick={() => goToLeague(c)} />
        ))}
      </div>
    </div>
  );
}
