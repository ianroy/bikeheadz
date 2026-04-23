import { Link, useLocation } from "react-router";
import { User, Bike, Menu, X } from "lucide-react";
import { useState } from "react";

export function Header() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const navLink = (to: string, label: string) => {
    const active = location.pathname === to;
    return (
      <Link
        to={to}
        onClick={() => setMenuOpen(false)}
        className={`px-4 py-2 rounded-lg transition-all duration-200 ${
          active
            ? "bg-[#b4ff45]/20 text-[#b4ff45] border border-[#b4ff45]/30"
            : "text-[#9090b0] hover:text-[#e0e0f0] hover:bg-white/5"
        }`}
      >
        {label}
      </Link>
    );
  };

  return (
    <header
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(9,9,15,0.95)",
        backdropFilter: "blur(20px)",
        borderColor: "#1e1e35",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #b4ff45, #7fc718)" }}
          >
            <Bike className="w-5 h-5 text-black" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-white tracking-tight" style={{ fontSize: "1.1rem", fontWeight: 700 }}>
              Bike
            </span>
            <span className="text-[#b4ff45] tracking-widest uppercase" style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em" }}>
              Headz
            </span>
          </div>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLink("/how-it-works", "How It Works")}
          {navLink("/account", "Account")}
          <Link
            to="/account"
            className="ml-2 w-9 h-9 rounded-full flex items-center justify-center border border-[#2a2a45] hover:border-[#b4ff45]/40 transition-colors"
            style={{ background: "#1a1a2e" }}
          >
            <User className="w-4 h-4 text-[#9090b0]" />
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2 rounded-lg text-[#9090b0] hover:text-white hover:bg-white/5 transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          className="md:hidden border-t px-4 py-3 flex flex-col gap-1"
          style={{ background: "#0d0d1a", borderColor: "#1e1e35" }}
        >
          {navLink("/how-it-works", "How It Works")}
          {navLink("/account", "Account")}
        </div>
      )}
    </header>
  );
}
