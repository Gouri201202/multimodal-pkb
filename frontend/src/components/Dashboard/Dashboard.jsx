import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { itemsAPI, recommendationsAPI } from "../../services/api";
import ItemList from "../Items/ItemList";
import CreateItemModal from "../Items/CreateItemModal"; // ✅ Changed from CreateItem
import RecommendationList from "../Recommendations/RecommendationList";
import Stats from "./Stats";
import Chatbot from "../Chat/Chatbot";
import "./Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [externalRecs, setExternalRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchItems();
    fetchRecommendations();
    fetchExternalRecommendations();
  }, []);

  const fetchItems = async () => {
    try {
      const response = await itemsAPI.getAll();
      setItems(response.data.items);
    } catch (error) {
      console.error("Failed to fetch items:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await recommendationsAPI.getHybrid({ limit: 5 });
      setRecommendations(response.data.recommendations);
    } catch (error) {
      console.error("Failed to fetch recommendations:", error);
    }
  };

  const fetchExternalRecommendations = async () => {
    try {
      const token = localStorage.getItem("token");
      // ✅ CHANGE THIS LINE - Add /items to the path
      const res = await fetch(
        `/api/items/recommendations/external?userId=${user._id}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      const data = await res.json();
      console.log("✅ External recs fetched:", data); // Add this to debug
      setExternalRecs(data.recommendations || []);
    } catch (error) {
      console.error("Failed to fetch external recommendations:", error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchItems();
      return;
    }

    try {
      setLoading(true);
      const response = await itemsAPI.search(searchQuery);
      setItems(response.data.results);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemCreated = () => {
    setShowCreateModal(false);
    fetchItems();
    fetchRecommendations();
    fetchExternalRecommendations();
  };

  const handleItemDelete = async (itemId) => {
    try {
      await itemsAPI.delete(itemId);
      fetchItems();
      fetchRecommendations();
    } catch (error) {
      console.error("Failed to delete item:", error);
    }
  };

  // ✅ Filter items by type
  const filteredItems =
    activeTab === "all"
      ? items
      : items.filter((item) => item.type === activeTab);

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.name}! 👋</h1>
          <p>Your AI-powered knowledge management system</p>
        </div>
        {/* ✅ ADD BUTTONS HERE */}
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <Chatbot variant="inline" />
          <button
            className="create-btn"
            onClick={() => {
              console.log("✅ CREATE NOTE CLICKED");
              setShowCreateModal(true);
            }}
            style={{
              whiteSpace: "nowrap",
              padding: "12px 24px",
              background: "#7c3aed",
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "15px",
              fontWeight: "600",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            + Create Note
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Search your knowledge base with AI..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSearch()}
          className="search-input"
        />
        <button onClick={handleSearch} className="search-btn">
          🔍 Search
        </button>
      </div>

      {/* Stats */}
      <Stats items={items} />

      {/* ✅ NEW: Content Type Tabs */}
      <div className="content-tabs">
        <button
          className={`tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          All Items ({items.length})
        </button>
        <button
          className={`tab ${activeTab === "text" ? "active" : ""}`}
          onClick={() => setActiveTab("text")}
        >
          📝 Text Notes ({items.filter((i) => i.type === "text").length})
        </button>
        <button
          className={`tab ${activeTab === "image" ? "active" : ""}`}
          onClick={() => setActiveTab("image")}
        >
          🖼️ Images ({items.filter((i) => i.type === "image").length})
        </button>
        <button
          className={`tab ${activeTab === "document" ? "active" : ""}`}
          onClick={() => setActiveTab("document")}
        >
          📄 PDFs ({items.filter((i) => i.type === "document").length})
        </button>
        <button
          className={`tab ${activeTab === "audio" ? "active" : ""}`}
          onClick={() => setActiveTab("audio")}
        >
          🎤 Voice ({items.filter((i) => i.type === "audio").length})
        </button>
      </div>

      {/* Items List */}
      <div className="content-section">
        <div className="items-section">
          <h2>
            {activeTab === "all"
              ? "All Items"
              : activeTab === "text"
              ? "Text Notes"
              : activeTab === "image"
              ? "Images"
              : activeTab === "document"
              ? "Documents"
              : "Voice Notes"}
          </h2>
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <ItemList items={filteredItems} onItemDelete={handleItemDelete} />
          )}
        </div>

        {/* Recommendations */}
        <div className="sidebar">
          <RecommendationList recommendations={recommendations} />

          {/* ✅ NEW: External Recommendations Section */}
          {externalRecs.length > 0 && (
            <div className="external-recommendations">
              <h3>🌐 Related Articles & Videos</h3>
              <div className="external-recs-list">
                {externalRecs.map((rec, idx) => (
                  <div key={idx} className="external-rec-card">
                    <a href={rec.url} target="_blank" rel="noopener noreferrer">
                      {rec.title}
                    </a>
                    <p>{rec.description?.substring(0, 120)}...</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ CORRECT - Use both conditional AND isOpen */}
      {showCreateModal && (
        <CreateItemModal
          isOpen={showCreateModal}
          onClose={() => {
            console.log("❌ Modal closed");
            setShowCreateModal(false);
          }}
          onCreated={handleItemCreated}
        />
      )}
    </div>
  );
};

export default Dashboard;
