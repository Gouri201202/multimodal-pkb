import React from "react";
import { Link, useLocation } from "react-router-dom";
import "./Layout.css";

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path ? "active" : "";
  };

  return (
    <aside className="sidebar-nav">
      <nav className="sidebar-menu">
        <Link
          to="/dashboard"
          className={`sidebar-item ${isActive("/dashboard")}`}
        >
          <span className="sidebar-icon">📊</span>
          <span>Dashboard</span>
        </Link>

        <Link
          to="/all-items"
          className={`sidebar-item ${isActive("/all-items")}`}
        >
          <span className="sidebar-icon">📚</span>
          <span>All Items</span>
        </Link>

        <Link to="/search" className={`sidebar-item ${isActive("/search")}`}>
          <span className="sidebar-icon">🔍</span>
          <span>Search</span>
        </Link>

        <Link
          to="/recommendations"
          className={`sidebar-item ${isActive("/recommendations")}`}
        >
          <span className="sidebar-icon">💡</span>
          <span>Recommendations</span>
        </Link>

        <div className="sidebar-divider"></div>

        <div className="sidebar-section-title">Categories</div>

        <Link to="/category/research" className="sidebar-item">
          <span className="sidebar-icon">🔬</span>
          <span>Research</span>
        </Link>

        <Link to="/category/work" className="sidebar-item">
          <span className="sidebar-icon">💼</span>
          <span>Work</span>
        </Link>

        <Link to="/category/personal" className="sidebar-item">
          <span className="sidebar-icon">👤</span>
          <span>Personal</span>
        </Link>
      </nav>
    </aside>
  );
};

export default Sidebar;
