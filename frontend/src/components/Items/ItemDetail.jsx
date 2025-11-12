import React, { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { itemsAPI, recommendationsAPI } from "../../services/api";
import "./ItemDetail.css";

const ItemDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchItemDetail();
    logInteraction();
  }, [id]);

  const fetchItemDetail = async () => {
    try {
      const response = await itemsAPI.getById(id);
      setItem(response.data.item);

      // Get content-based recommendations for this item
      const recResponse = await recommendationsAPI.getContent({
        itemId: id,
        limit: 5,
      });
      setRecommendations(recResponse.data.recommendations);
    } catch (err) {
      setError("Failed to load item details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const logInteraction = async () => {
    try {
      await recommendationsAPI.logInteraction({
        itemId: id,
        interactionType: "view",
        weight: 1,
      });
    } catch (err) {
      console.error("Failed to log interaction:", err);
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this item?")) {
      try {
        await itemsAPI.delete(id);
        navigate("/dashboard");
      } catch (err) {
        alert("Failed to delete item");
      }
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getSentimentEmoji = (label) => {
    const emojis = {
      positive: "😊",
      negative: "😔",
      neutral: "😐",
    };
    return emojis[label] || "😐";
  };

  const getCategoryColor = (category) => {
    const colors = {
      research: "#667eea",
      work: "#f093fb",
      personal: "#4facfe",
      entertainment: "#fa709a",
      other: "#888",
    };
    return colors[category] || colors.other;
  };

  if (loading) {
    return <div className="loading-container">Loading item details...</div>;
  }

  if (error || !item) {
    return (
      <div className="error-container">
        <h2>❌ {error || "Item not found"}</h2>
        <button
          onClick={() => navigate("/dashboard")}
          className="btn btn-primary"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="item-detail-container">
      <div className="item-detail-header">
        <button onClick={() => navigate("/dashboard")} className="back-btn">
          ← Back
        </button>
        <button onClick={handleDelete} className="delete-btn-large">
          🗑️ Delete
        </button>
      </div>

      <div className="item-detail-content">
        <div className="main-content-area">
          {/* Title and Meta */}
          <div className="item-title-section">
            <h1>{item.title}</h1>
            <div className="item-metadata">
              <span className="meta-item">📅 {formatDate(item.createdAt)}</span>
              <span className="meta-item">📝 {item.type}</span>
              {item.aiAnalysis?.category && (
                <span
                  className="category-badge-large"
                  style={{
                    backgroundColor: getCategoryColor(item.aiAnalysis.category),
                  }}
                >
                  {item.aiAnalysis.category}
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="item-content-section">
            <h3>Content</h3>
            <div className="content-text">{item.content}</div>
          </div>

          {/* AI Analysis */}
          {item.aiAnalysis && (
            <div className="ai-analysis-section">
              <h3>🤖 AI Analysis</h3>

              {/* Summary */}
              {item.aiAnalysis.summary && (
                <div className="analysis-card">
                  <h4>Summary</h4>
                  <p>{item.aiAnalysis.summary}</p>
                </div>
              )}

              {/* Keywords */}
              {item.aiAnalysis.keywords &&
                item.aiAnalysis.keywords.length > 0 && (
                  <div className="analysis-card">
                    <h4>Keywords</h4>
                    <div className="keyword-list">
                      {item.aiAnalysis.keywords.map((keyword, idx) => (
                        <span key={idx} className="keyword-pill">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Topics */}
              {item.aiAnalysis.topics && item.aiAnalysis.topics.length > 0 && (
                <div className="analysis-card">
                  <h4>Topics</h4>
                  <div className="topic-list">
                    {item.aiAnalysis.topics.map((topic, idx) => (
                      <span key={idx} className="topic-tag">
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sentiment */}
              {item.aiAnalysis.sentiment && (
                <div className="analysis-card">
                  <h4>Sentiment</h4>
                  <div className="sentiment-display">
                    <span className="sentiment-emoji">
                      {getSentimentEmoji(item.aiAnalysis.sentiment.label)}
                    </span>
                    <span className="sentiment-label">
                      {item.aiAnalysis.sentiment.label}
                    </span>
                    <span className="sentiment-score">
                      ({Math.round(item.aiAnalysis.sentiment.score * 100)}%
                      confidence)
                    </span>
                  </div>
                </div>
              )}

              {/* Entities */}
              {item.aiAnalysis.entities &&
                item.aiAnalysis.entities.length > 0 && (
                  <div className="analysis-card">
                    <h4>Extracted Entities</h4>
                    <div className="entity-list">
                      {item.aiAnalysis.entities.map((entity, idx) => (
                        <div key={idx} className="entity-item">
                          <span className="entity-text">{entity.text}</span>
                          <span className="entity-type">{entity.type}</span>
                          <span className="entity-relevance">
                            {Math.round(entity.relevance * 100)}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* Importance */}
              <div className="analysis-meta">
                <span
                  className={`importance-badge ${item.aiAnalysis.importance}`}
                >
                  {item.aiAnalysis.importance} importance
                </span>
              </div>
            </div>
          )}

          {/* Connections */}
          {item.connections && item.connections.length > 0 && (
            <div className="connections-section">
              <h3>🔗 Connected Items ({item.connections.length})</h3>
              <div className="connection-list">
                {item.connections.map((conn, idx) => (
                  <Link
                    to={`/items/${conn.itemId._id}`}
                    key={idx}
                    className="connection-card"
                  >
                    <div className="connection-info">
                      <h4>{conn.itemId.title}</h4>
                      <p className="connection-reason">{conn.reason}</p>
                      <div className="connection-meta">
                        <span className="connection-strength">
                          {Math.round(conn.strength * 100)}% similar
                        </span>
                        <span className="connection-type">{conn.type}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* User Tags */}
          {item.userTags && item.userTags.length > 0 && (
            <div className="tags-section">
              <h3>🏷️ Tags</h3>
              <div className="tag-list">
                {item.userTags.map((tag, idx) => (
                  <span key={idx} className="user-tag">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar with Recommendations */}
        <aside className="detail-sidebar">
          <div className="sidebar-section">
            <h3>💡 Related Content</h3>
            {recommendations.length === 0 ? (
              <p className="no-recommendations">No recommendations yet</p>
            ) : (
              <div className="related-items">
                {recommendations.map((rec, idx) => (
                  <Link
                    to={`/items/${rec.item._id}`}
                    key={idx}
                    className="related-item"
                  >
                    <h4>{rec.item.title}</h4>
                    <p className="related-reason">{rec.reason}</p>
                    <span className="related-score">
                      {Math.round(rec.score * 100)}% match
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};

export default ItemDetail;
