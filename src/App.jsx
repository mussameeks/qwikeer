import { Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { useContext } from "react";
import { DarkModeContext } from "./context/DarkModeContext";
import Home from "./pages/Home";
import About from "./pages/About";
import Advertise from "./pages/Advertise";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Details from "./pages/Details";

function App() {
  const { toggle } = useContext(DarkModeContext);

  return (
    <>
      <Header toggleDarkMode={toggle} />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/advertise" element={<Advertise />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/details/:fixtureId" element={<Details />} />
        </Routes>
      </main>
      <Footer />
    </>
  );
}

export default App;