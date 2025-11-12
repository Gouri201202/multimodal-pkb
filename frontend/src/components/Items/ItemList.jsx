import React from "react";
import ItemCard from "./ItemCard";
import "./Items.css";

const ItemList = ({ items, onDelete }) => {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📝</div>
        <h3>No items yet</h3>
        <p>Create your first note to get started</p>
      </div>
    );
  }

  return (
    <div className="item-list">
      {items.map((item) => (
        <ItemCard key={item._id} item={item} onDelete={onDelete} />
      ))}
    </div>
  );
};

export default ItemList;
