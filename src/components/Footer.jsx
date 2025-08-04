import { Link } from "react-router-dom";

const Footer = () => (
  <footer className="app-footer">
    <nav className="footer-links">
      <Link to="/privacy">Privacy & Cookies</Link>
      <Link to="/terms">Terms & Conditions</Link>
      <Link to="/advertise">Advertise</Link>
      <Link to="/about">About Us</Link>
      <Link to="#">Feedback</Link>
    </nav>
    <div style={{ marginTop: "10px" }}>&copy; 2025 QILIKU. All rights reserved.</div>
  </footer>
);

export default Footer;