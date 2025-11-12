import React from "react";
import "./Dashboard.css";

const Stats = ({ items }) => {
  const totalItems = items.length;
  const textItems = items.filter((item) => item.type === "text").length;
  const researchItems = items.filter(
    (item) => item.aiAnalysis?.category === "research"
  ).length;
  const connections = items.reduce(
    (sum, item) => sum + (item.connections?.length || 0),
    0
  );

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-icon">📚</div>
        <div className="stat-content">
          <h3>{totalItems}</h3>
          <p>Total Items</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">📝</div>
        <div className="stat-content">
          <h3>{textItems}</h3>
          <p>Text Notes</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🔬</div>
        <div className="stat-content">
          <h3>{researchItems}</h3>
          <p>Research Items</p>
        </div>
      </div>

      <div className="stat-card">
        <div className="stat-icon">🔗</div>
        <div className="stat-content">
          <h3>{connections}</h3>
          <p>Connections</p>
        </div>
      </div>
    </div>
  );
};

export default Stats;
