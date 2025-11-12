import React, { useState } from "react";
import { itemsAPI } from "../../services/api";
import "./Items.css";

const CreateItem = ({ onClose, onCreated }) => {
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    userTags: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const tags = formData.userTags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      await itemsAPI.create({
        title: formData.title,
        content: formData.content,
        userTags: tags,
      });

      onCreated();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create item");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Note</h2>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit} className="create-form">
          <div className="form-group">
            <label>Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Enter note title..."
              required
            />
          </div>

          <div className="form-group">
            <label>Content</label>
            <textarea
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              placeholder="Write your note here..."
              rows="10"
              required
            />
          </div>

          <div className="form-group">
            <label>Tags (comma-separated)</label>
            <input
              type="text"
              value={formData.userTags}
              onChange={(e) =>
                setFormData({ ...formData, userTags: e.target.value })
              }
              placeholder="e.g., AI, machine learning, research"
            />
          </div>

          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? "Creating..." : "Create Note"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateItem;
