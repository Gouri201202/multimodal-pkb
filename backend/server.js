const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const chatRouter = require("./routes/chat");
require("dotenv").config();

const app = express();

// ===== MIDDLEWARE =====
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"] // Replace with your domain
        : ["http://localhost:3000"],
    credentials: true,
  })
);

// Serve static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/chat", chatRouter);

// ===== DATABASE CONNECTION =====
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    console.log("✅ MongoDB connected successfully");
    console.log(`📍 Database: ${conn.connection.name}`);

    // Test AI service initialization
    console.log("🤖 Testing AI services...");
    const aiService = require("./services/freeAIService");

    // Test with a simple text
    try {
      const testResult = await aiService.analyzeText(
        "This is a test message to verify AI service is working."
      );
      console.log("✅ AI service is working!");
      console.log("📊 Sample analysis:", {
        keywords: testResult.keywords?.slice(0, 3),
        sentiment: testResult.sentiment?.label,
      });
    } catch (aiError) {
      console.warn("⚠️ AI service may have issues:", aiError.message);
      console.log("💡 Check your API keys in .env file");
    }
  } catch (error) {
    console.error("❌ MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

// ===== ROUTES =====
app.use("/api/auth", require("./routes/auth"));
app.use("/api/items", require("./routes/items"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Multi-Modal PKB API is running!",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Welcome route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "🚀 Welcome to Multi-Modal Personal Knowledge Base API!",
    version: "1.0.0",
    documentation: "/api/health",
    endpoints: [
      "POST /api/auth/register - Register new user",
      "POST /api/auth/login - User login",
      "GET /api/auth/profile - Get user profile",
      "POST /api/items/text - Create text note",
      "POST /api/items/image - Upload image",
      "POST /api/items/web-clip - Save web clip",
      "GET /api/items - Get all items",
      "GET /api/items/search/semantic - Semantic search",
      "GET /api/items/:id - Get specific item",
      "PUT /api/items/:id - Update item",
      "DELETE /api/items/:id - Delete item",
    ],
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File too large. Maximum size is 10MB.",
    });
  }

  if (error.message.includes("Only image and audio files")) {
    return res.status(400).json({
      success: false,
      message: "Invalid file type. Only image and audio files are allowed.",
    });
  }

  res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

// ===== START SERVER =====
const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
  console.log("\n🌟 ===== MULTI-MODAL PKB SERVER =====");
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 API URL: http://localhost:${PORT}`);
  console.log(`📚 Documentation: http://localhost:${PORT}/api/health`);
  console.log("⚡ Environment:", process.env.NODE_ENV || "development");

  // Connect to database
  await connectDB();

  console.log("\n✅ All systems ready! You can now:");
  console.log("1. Register a new user account");
  console.log("2. Upload and analyze content");
  console.log("3. Search and discover connections");
  console.log("=====================================\n");
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("📴 SIGTERM received. Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  console.log("\n📴 SIGINT received. Shutting down gracefully...");
  await mongoose.connection.close();
  process.exit(0);
});
