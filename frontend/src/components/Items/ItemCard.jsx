import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Items.css";

const ItemCard = ({ item, onDelete }) => {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);

  const handleClick = () => {
    navigate(`/items/${item._id}`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this item?")) {
      onDelete(item._id);
    }
  };

  const toggleSummary = (e) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Get icon based on type
  const getTypeIcon = () => {
    switch (item.type) {
      case "text":
        return "📝";
      case "image":
        return "🖼️";
      case "document":
        return "📄";
      case "audio":
        return "🎤";
      default:
        return "📄";
    }
  };

  const summary = item.aiAnalysis?.summary || "No summary available";
  const shouldTruncate = summary.length > 150;
  const displaySummary =
    isExpanded || !shouldTruncate ? summary : summary.substring(0, 150) + "...";

  return (
    <div className="item-card" onClick={handleClick}>
      <div className="item-card-header">
        <div className="item-title-with-icon">
          <span className="item-type-icon">{getTypeIcon()}</span>
          <h3 className="item-title">{item.title}</h3>
        </div>
        <button
          className="item-delete-btn"
          onClick={handleDelete}
          title="Delete item"
        >
          🗑️
        </button>
      </div>

      {/* Show image preview if it's an image */}
      {item.type === "image" && item.fileUrl && (
        <div className="item-image-preview">
          <img
            src={`http://localhost:5000${item.fileUrl}`}
            alt={item.title}
            onError={(e) => (e.target.style.display = "none")}
          />
        </div>
      )}

      {/* Show file info for documents/audio */}
      {(item.type === "document" || item.type === "audio") && item.fileSize && (
        <div className="item-file-info">
          📎 {(item.fileSize / 1024).toFixed(2)} KB
        </div>
      )}

      {/* Text content preview */}
      {item.content && item.type === "text" && (
        <div className="item-content">
          <p className="item-excerpt">
            {item.content.substring(0, 100)}
            {item.content.length > 100 && "..."}
          </p>
        </div>
      )}

      {/* AI Summary */}
      {item.aiAnalysis?.summary && (
        <div className="item-summary-section">
          <div className="item-summary-label">
            <strong>AI Summary:</strong>
          </div>
          <p className="item-summary">{displaySummary}</p>
          {shouldTruncate && (
            <button className="read-more-btn" onClick={toggleSummary}>
              {isExpanded ? "Show Less ▲" : "Read More ▼"}
            </button>
          )}
        </div>
      )}

      {/* Keywords */}
      <div className="item-meta">
        <div className="item-tags">
          {item.aiAnalysis?.keywords?.slice(0, 3).map((keyword, index) => (
            <span key={index} className="item-tag">
              {keyword}
            </span>
          ))}
        </div>

        {/* Stats */}
        <div className="item-stats">
          <span className="item-date">
            {new Date(item.createdAt).toLocaleDateString()}
          </span>
          {item.connections && item.connections.length > 0 && (
            <span className="item-connections" title="Connected items">
              🔗 {item.connections.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemCard;
