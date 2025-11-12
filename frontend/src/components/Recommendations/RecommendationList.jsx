import React from "react";
import { Link } from "react-router-dom";
import "./Recommendations.css";

const RecommendationList = ({ recommendations, onRefresh }) => {
  return (
    <div className="recommendations-widget">
      <div className="widget-header">
        <h3>🎯 Recommended for You</h3>
        <button onClick={onRefresh} className="refresh-btn">
          🔄
        </button>
      </div>

      {recommendations.length === 0 ? (
        <p className="no-recommendations">
          Create more notes to get personalized recommendations
        </p>
      ) : (
        <div className="recommendation-list">
          {recommendations.map((rec, idx) => (
            <Link
              to={`/items/${rec.item._id}`}
              key={idx}
              className="recommendation-item"
            >
              <div className="rec-content">
                <h4>{rec.item.title}</h4>
                <p className="rec-reason">{rec.reason}</p>
                <div className="rec-meta">
                  <span className="rec-score">
                    {Math.round(rec.score * 100)}% match
                  </span>
                  <span className="rec-type">{rec.type}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default RecommendationList;
