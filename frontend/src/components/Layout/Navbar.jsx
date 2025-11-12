import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Layout.css";

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <nav className="navbar">
      <div className="nav-brand">
        <Link to="/dashboard">🧠 AI Knowledge Base</Link>
      </div>

      {user && (
        <div className="nav-menu">
          <Link to="/dashboard" className="nav-link">
            Dashboard
          </Link>
          <div className="user-menu">
            <span className="user-name">{user.name}</span>
            <button onClick={handleLogout} className="btn-logout">
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
