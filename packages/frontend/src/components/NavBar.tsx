import { NavLink } from "react-router-dom";
import "./NavBar.css";

const links = [
  { to: "/files", label: "Files", icon: "📁" },
  { to: "/prompt", label: "Prompt", icon: "⚡" },
  { to: "/history", label: "History", icon: "📜" },
  { to: "/git", label: "Git", icon: "🔀" },
];

export default function NavBar() {
  return (
    <nav className="navbar">
      {links.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
        >
          <span className="nav-icon">{icon}</span>
          <span className="nav-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
