require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Item = require("../models/Item");

class ChatService {
  constructor() {
    // Use same API key as freeAIService.js
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("❌ ERROR: No API key found! Check your .env file");
      console.error("Environment variables:", {
        GOOGLE_AI_API_KEY: !!process.env.GOOGLE_AI_API_KEY,
        GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
      });
      throw new Error("Missing API key");
    }

    console.log("🔑 API Key found:", apiKey.substring(0, 20) + "...");

    this.genAI = new GoogleGenerativeAI(apiKey);

    // IMPORTANT: Use gemini-1.5-flash for free tier, NOT gemini-pro
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
    });

    console.log("✅ ChatService initialized with gemini-2.5-flash");
  }

  // Search relevant items from user's knowledge base
  async searchRelevantItems(userId, query, limit = 5) {
    try {
      const allItems = await Item.find({ userId })
        .select("title content aiAnalysis type createdAt")
        .sort({ createdAt: -1 })
        .limit(50);

      if (!allItems || allItems.length === 0) {
        console.log("⚠️ No items found for user");
        return [];
      }

      const queryWords = query
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 2);

      const scoredItems = allItems.map((item) => {
        const text = `${item.title} ${item.content} ${
          item.aiAnalysis?.summary || ""
        }`.toLowerCase();
        const keywords = item.aiAnalysis?.keywords || [];

        let score = 0;
        queryWords.forEach((word) => {
          if (text.includes(word)) score += 1;
          if (keywords.some((k) => k.toLowerCase().includes(word))) score += 2;
        });

        return { item, score };
      });

      const relevant = scoredItems
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.item);

      console.log(`📄 Found ${relevant.length} relevant items`);
      return relevant;
    } catch (error) {
      console.error("Error searching items:", error);
      return [];
    }
  }

  // Generate AI response with context
  async chat(userId, userMessage, conversationHistory = []) {
    try {
      console.log(`💬 Processing chat for user: ${userId}`);
      console.log(`📝 Message: ${userMessage}`);

      const relevantItems = await this.searchRelevantItems(userId, userMessage);

      const context =
        relevantItems.length > 0
          ? relevantItems
              .map(
                (item, idx) =>
                  `[Document ${idx + 1}: ${item.title}]\n${
                    item.aiAnalysis?.summary || item.content?.substring(0, 500)
                  }`
              )
              .join("\n\n")
          : "No relevant documents found in knowledge base.";

      const recentHistory = conversationHistory.slice(-4);
      const historyText =
        recentHistory.length > 0
          ? recentHistory
              .map(
                (msg) =>
                  `${msg.role === "user" ? "User" : "Assistant"}: ${
                    msg.content
                  }`
              )
              .join("\n")
          : "This is the start of the conversation.";

      const prompt = `You are a helpful AI assistant with access to the user's personal knowledge base.

Context from knowledge base:
${context}

Recent conversation:
${historyText}

User question: ${userMessage}

Instructions:
- Answer based on the context from the knowledge base
- If the answer is in the context, cite which document
- If not in knowledge base, say so clearly
- Be concise and helpful

Answer:`;

      console.log("🤖 Calling Gemini API...");
      const result = await this.model.generateContent(prompt);
      const response = result.response.text();
      console.log("✅ Response generated successfully");

      return {
        message: response,
        relevantItems: relevantItems.map((item) => ({
          _id: item._id,
          title: item.title,
          type: item.type,
          summary:
            (item.aiAnalysis?.summary || item.content || "").substring(0, 150) +
            "...",
        })),
      };
    } catch (error) {
      console.error("❌ Chat error:", error.message);
      console.error("Error details:", error);
      throw new Error("Failed to generate response: " + error.message);
    }
  }
}

module.exports = new ChatService();
