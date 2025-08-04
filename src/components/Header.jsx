import { Link, useLocation } from "react-router-dom";

const Header = ({ toggleDarkMode }) => {
  const { pathname } = useLocation();
  return (
    <header className="app-header">
      <Link to="/" className="header-logo">QILIKU</Link>
      {pathname === "/" && (
        <nav className="header-tabs">
          <button className="tab-btn" data-filter="all">All</button>
          <button className="tab-btn" data-filter="live">Live</button>
          <button className="tab-btn" data-filter="finished">Finished</button>
          <button className="tab-btn" data-filter="upcoming">Upcoming</button>
        </nav>
      )}
      <button className="header-account" aria-label="Account">
        <svg width="24" height="24" viewBox="0 0 24 24">
          <circle cx="12" cy="7" r="4" />
          <path d="M5.5 21v-2a4.5 4.5 0 0 1 9 0v2" />
        </svg>
      </button>
      <button className="dark-toggle-btn" onClick={toggleDarkMode}>🌙</button>
    </header>
  );
};

export default Header;