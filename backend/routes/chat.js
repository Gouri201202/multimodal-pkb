const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const chatService = require("../services/chatService");

// Chat endpoint
router.post("/", auth, async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    console.log(`💬 Chat request from user ${req.userId}: ${message}`);

    const response = await chatService.chat(
      req.userId,
      message,
      conversationHistory
    );

    res.json({
      success: true,
      response: response.message,
      relevantItems: response.relevantItems,
    });
  } catch (error) {
    console.error("❌ Chat error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process chat message",
      details: error.message,
    });
  }
});

module.exports = router;
