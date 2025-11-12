const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;
const pdfParse = require("pdf-parse");
const Item = require("../models/Item");
const User = require("../models/User");
const aiService = require("../services/freeAIService");
const auth = require("../middleware/auth");
const recommendationService = require("../services/recommendationService");
const { getExternalRecommendations } = require("../services/freeAIService");

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../uploads");
    try {
      await fs.mkdir(uploadPath, { recursive: true });
      cb(null, uploadPath);
    } catch (error) {
      cb(error, null);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const allowedMimeTypes = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/ogg",
  "audio/x-wav",
  "audio/wave",
  "audio/vnd.wave",
];
const allowedExtensions = [
  ".jpeg",
  ".jpg",
  ".png",
  ".gif",
  ".webp",
  ".pdf",
  ".webm",
  ".mp3",
  ".wav",
  ".ogg",
];
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (
      allowedMimeTypes.includes(file.mimetype) ||
      allowedExtensions.includes(ext)
    ) {
      return cb(null, true);
    }
    cb(new Error("Only images, PDFs, and audio files are allowed"));
  },
});

// ===== CREATE ITEMS =====

// Create text note
router.post("/text", auth, async (req, res) => {
  try {
    const { title, content, userTags } = req.body;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        message: "Title and content are required",
      });
    }

    console.log("📝 Creating text note:", title);

    // ✅ CREATE ITEM WITHOUT aiAnalysis FIRST
    const item = new Item({
      title,
      content,
      type: "text",
      userTags: userTags || [],
      userId: req.userId,
      embeddings: [],
      // DON'T include aiAnalysis here
    });

    // Generate AI analysis and embeddings in parallel
    const [aiAnalysis, embeddings] = await Promise.all([
      aiService.analyzeText(content),
      aiService.generateEmbedding(content),
    ]);

    console.log("🔍 Raw aiAnalysis:", JSON.stringify(aiAnalysis, null, 2));
    console.log("🔍 Entities type:", typeof aiAnalysis?.entities);
    console.log("🔍 Is entities array?", Array.isArray(aiAnalysis?.entities));

    // ✅ SAFE STEP-BY-STEP ASSIGNMENT
    item.embeddings = embeddings;

    // Build aiAnalysis object piece by piece
    item.aiAnalysis = {};
    item.aiAnalysis.summary = aiAnalysis.summary || "";
    item.aiAnalysis.keywords = Array.isArray(aiAnalysis.keywords)
      ? aiAnalysis.keywords
      : [];
    item.aiAnalysis.topics = Array.isArray(aiAnalysis.topics)
      ? aiAnalysis.topics
      : [];
    item.aiAnalysis.sentiment = {
      label: aiAnalysis.sentiment?.label || "neutral",
      score: aiAnalysis.sentiment?.score || 0,
    };
    item.aiAnalysis.category = aiAnalysis.category || "other";
    item.aiAnalysis.importance = aiAnalysis.importance || "medium";

    // ✅ HANDLE ENTITIES SEPARATELY AND SAFELY
    item.aiAnalysis.entities = [];
    if (aiAnalysis.entities && Array.isArray(aiAnalysis.entities)) {
      for (const entity of aiAnalysis.entities) {
        if (entity && entity.text) {
          item.aiAnalysis.entities.push({
            text: String(entity.text).trim(),
            type: String(entity.type || "OTHER").toUpperCase(),
            relevance: Number(entity.relevance || 0.5),
          });
        }
      }
    }

    console.log("🔍 Final entities count:", item.aiAnalysis.entities.length);
    console.log("🔍 First entity:", item.aiAnalysis.entities[0]);

    // Save the item
    await item.save();

    await recommendationService.logUserInteraction(
      req.userId,
      item._id,
      "create",
      2
    );
    // Find similar content
    const existingItems = await Item.find({
      userId: req.userId,
      _id: { $ne: item._id },
      embeddings: { $exists: true },
    });

    const connections = await aiService.findSimilarContent(item, existingItems);

    // Save connections
    item.connections = connections.map((conn) => ({
      itemId: conn.itemId,
      strength: conn.similarity,
      reason: conn.reason,
      type: conn.type,
    }));

    await item.save();

    // Update user stats
    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": 1,
        "stats.itemsByType.text": 1,
      },
    });

    res.status(201).json({
      success: true,
      message: "Text note created successfully",
      item: await item.populate("connections.itemId", "title type"),
    });
  } catch (error) {
    console.error("❌ Error creating text note:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create text note",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

// Upload image
router.post("/image", auth, upload.single("image"), async (req, res) => {
  try {
    const { title, userTags } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image file provided",
      });
    }

    console.log("🖼️ Creating image item:", title);

    const item = new Item({
      title: title || "Untitled Image",
      type: "image",
      filePath: req.file.path,
      fileUrl: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userTags: userTags ? userTags.split(",").map((tag) => tag.trim()) : [],
      userId: req.userId,
      embeddings: [],
    });

    // ✅ ANALYZE IMAGE WITH GEMINI VISION
    console.log("🔍 Analyzing image content...");
    const imageAnalysis = await aiService.analyzeImage(req.file.path);

    console.log("📝 Image analysis result:", imageAnalysis);

    // Create enriched description combining title, tags, and AI analysis
    const userTagsList = userTags
      ? userTags.split(",").map((tag) => tag.trim())
      : [];
    const allKeywords = [
      ...imageAnalysis.keywords,
      ...userTagsList,
      title?.toLowerCase(),
    ].filter(Boolean);

    const enrichedDescription = [
      title,
      imageAnalysis.description,
      ...allKeywords,
      ...imageAnalysis.topics,
    ].join(". ");

    console.log(
      "📄 Enriched description:",
      enrichedDescription.substring(0, 200)
    );

    // Create AI analysis
    const aiAnalysis = {
      summary: imageAnalysis.description,
      keywords: [...new Set(allKeywords)], // Remove duplicates
      topics: imageAnalysis.topics,
      sentiment: { label: "neutral", score: 0.5 },
      entities: [],
      category: imageAnalysis.category || "image",
      importance: "medium",
    };

    // Store image-specific analysis
    item.imageAnalysis = {
      description: imageAnalysis.description,
      objects: imageAnalysis.objects || [],
      textDetected: imageAnalysis.textDetected,
      tags: imageAnalysis.keywords,
    };

    // Generate embeddings from enriched description
    const embeddings = await aiService.generateEmbedding(enrichedDescription);

    item.aiAnalysis = aiAnalysis;
    item.embeddings = embeddings;
    item.content = enrichedDescription; // Store for search
    await item.save();

    console.log("✅ Image item created with AI analysis");

    // Find connections
    const existingItems = await Item.find({
      userId: req.userId,
      _id: { $ne: item._id },
    });

    const connections = await aiService.findSimilarContent(
      item,
      existingItems,
      0.25
    );

    console.log(`🔗 Found ${connections.length} connections`);

    if (connections.length > 0) {
      item.connections = connections.map((conn) => ({
        itemId: conn.itemId,
        strength: conn.similarity,
        reason: conn.reason,
        type: "embedding_similarity",
      }));
      await item.save();
    }

    await recommendationService.logUserInteraction(
      req.userId,
      item._id,
      "create",
      2
    );

    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": 1,
        "stats.itemsByType.image": 1,
      },
    });

    res.status(201).json({
      success: true,
      message: "Image uploaded and analyzed successfully",
      item,
      analysis: imageAnalysis,
    });
  } catch (error) {
    console.error("❌ Image upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload image",
      error: error.message,
    });
  }
});

// Upload document (PDF)
router.post("/document", auth, upload.single("document"), async (req, res) => {
  try {
    const { title, userTags } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No document file provided",
      });
    }

    console.log("📄 Creating document item:", title);

    const item = new Item({
      title: title || "Untitled Document",
      type: "document",
      filePath: req.file.path,
      fileUrl: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userTags: userTags ? userTags.split(",").map((tag) => tag.trim()) : [],
      userId: req.userId,
      embeddings: [],
    });

    let extractedText = "";
    let aiAnalysis;
    let embeddings;

    // ✅ EXTRACT TEXT FROM PDF
    if (req.file.mimetype === "application/pdf") {
      try {
        console.log("📖 Extracting text from PDF...");
        const dataBuffer = await fs.readFile(req.file.path);
        const pdfData = await pdfParse(dataBuffer);
        extractedText = pdfData.text;

        console.log(`✅ Extracted ${extractedText.length} characters from PDF`);
        console.log(`📊 Pages: ${pdfData.numpages}`);

        if (extractedText.length > 0) {
          // Use meaningful portion of text for analysis
          const textForAnalysis = extractedText.substring(0, 3000);
          const textForEmbedding = extractedText.substring(0, 1500);

          console.log("🔍 Analyzing extracted PDF content...");

          [aiAnalysis, embeddings] = await Promise.all([
            aiService.analyzeText(textForAnalysis),
            aiService.generateEmbedding(textForEmbedding),
          ]);

          // Add user tags to keywords
          const userTagsList = userTags
            ? userTags.split(",").map((tag) => tag.trim())
            : [];

          aiAnalysis.keywords = [
            ...new Set([...aiAnalysis.keywords, ...userTagsList]),
          ];

          item.content = extractedText.substring(0, 10000); // Store first 10k chars
          console.log("✅ PDF content analyzed successfully");
        } else {
          throw new Error("No text extracted from PDF");
        }
      } catch (pdfError) {
        console.error("❌ PDF parsing failed:", pdfError.message);
        extractedText = "";
      }
    }

    // ✅ FALLBACK FOR FAILED PDF OR NON-PDF FILES
    if (!extractedText || extractedText.length === 0) {
      console.warn("⚠️ Using fallback analysis (no text extracted)");

      const userTagsList = userTags
        ? userTags.split(",").map((tag) => tag.trim())
        : [];

      const fallbackText = [
        title || "document",
        ...userTagsList,
        "document content",
      ].join(" ");

      [aiAnalysis, embeddings] = await Promise.all([
        aiService.analyzeText(fallbackText),
        aiService.generateEmbedding(fallbackText),
      ]);

      item.content = `Document: ${title}. Tags: ${userTagsList.join(", ")}`;
    }

    item.aiAnalysis = aiAnalysis;
    item.embeddings = embeddings;
    await item.save();

    console.log("✅ Document item created");

    // ✅ FIND CONNECTIONS WITH LOWER THRESHOLD
    const existingItems = await Item.find({
      userId: req.userId,
      _id: { $ne: item._id },
    });

    const connections = await aiService.findSimilarContent(
      item,
      existingItems,
      0.25 // ✅ Lower threshold for better matching
    );

    console.log(`🔗 Found ${connections.length} connections`);

    if (connections.length > 0) {
      item.connections = connections.map((conn) => ({
        itemId: conn.itemId,
        strength: conn.similarity,
        reason: conn.reason,
        type: "embedding_similarity",
      }));
      await item.save();
    }

    await recommendationService.logUserInteraction(
      req.userId,
      item._id,
      "create",
      2
    );

    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": 1,
        "stats.itemsByType.document": 1,
      },
    });

    res.status(201).json({
      success: true,
      message: "Document uploaded successfully",
      item,
      extracted: {
        textLength: extractedText.length,
        pages: extractedText ? "extracted" : "failed",
      },
    });
  } catch (error) {
    console.error("❌ Document upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload document",
      error: error.message,
    });
  }
});

// Upload voice note
router.post("/voice", auth, upload.single("audio"), async (req, res) => {
  try {
    // ✅ Get transcription sent from frontend
    const { title, userTags, transcription } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No audio file provided",
      });
    }

    console.log("🎤 Creating voice note:", title);
    console.log("📝 Transcription received:", transcription?.substring(0, 100));

    const item = new Item({
      title: title || "Untitled Voice Note",
      type: "audio",
      filePath: req.file.path,
      fileUrl: `/uploads/${req.file.filename}`,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      userTags: userTags ? userTags.split(",").map((tag) => tag.trim()) : [],
      userId: req.userId,
      embeddings: [],
      content: transcription || "Voice note recorded", // ✅ Use the actual transcription!
    });

    // ✅ Analyze spoken content
    const [aiAnalysis, embeddings] = await Promise.all([
      aiService.analyzeText(transcription || title),
      aiService.generateEmbedding(transcription || title),
    ]);

    item.aiAnalysis = aiAnalysis;
    item.embeddings = embeddings;
    await item.save();

    // ✅ Find connections based on the transcribed text!
    const existingItems = await Item.find({
      userId: req.userId,
      _id: { $ne: item._id },
    });

    const connections = await aiService.findSimilarContent(
      item,
      existingItems,
      0.3
    );

    if (connections.length > 0) {
      item.connections = connections.map((conn) => ({
        itemId: conn.itemId,
        strength: conn.similarity,
        reason: conn.reason,
        type: "embedding_similarity",
      }));
      await item.save();
    }

    console.log(`✅ Voice note created with ${connections.length} connections`);
    await recommendationService.logUserInteraction(
      req.userId,
      item._id,
      "create",
      2
    );

    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": 1,
        "stats.itemsByType.audio": 1,
      },
    });

    res.status(201).json({
      success: true,
      message: "Voice note uploaded successfully",
      item,
    });
  } catch (error) {
    console.error("❌ Voice note upload error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to upload voice note",
      error: error.message,
    });
  }
});

// Create web clip
router.post("/web-clip", auth, async (req, res) => {
  try {
    const { title, content, url } = req.body;

    if (!title || !content || !url) {
      return res.status(400).json({
        success: false,
        message: "Title, content, and URL are required",
      });
    }

    console.log("🌐 Creating web clip:", title);

    // Extract domain from URL
    let domain = "";
    try {
      domain = new URL(url).hostname;
    } catch (e) {
      domain = "unknown";
    }

    const item = new Item({
      title,
      content,
      type: "web_clip",
      source: { url, domain },
      userId: req.userId,
    });

    // Generate AI analysis and embeddings
    const [aiAnalysis, embeddings] = await Promise.all([
      aiService.analyzeText(content),
      aiService.generateEmbedding(content),
    ]);

    item.aiAnalysis = aiAnalysis;
    item.embeddings = embeddings;

    await item.save();

    // Find similar content
    const existingItems = await Item.find({
      userId: req.userId,
      _id: { $ne: item._id },
      embeddings: { $exists: true },
    });

    const connections = await aiService.findSimilarContent(item, existingItems);
    item.connections = connections;
    await item.save();

    // Update user stats
    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": 1,
        "stats.itemsByType.web_clip": 1,
      },
    });

    res.status(201).json({
      success: true,
      message: "Web clip created successfully",
      item: await item.populate("connections.itemId", "title type"),
    });
  } catch (error) {
    console.error("❌ Error creating web clip:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create web clip",
    });
  }
});

// ===== READ ITEMS =====

// Get all items with filtering and pagination
router.get("/", auth, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type,
      category,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter query
    const filter = { userId: req.userId };

    if (type) filter.type = type;
    if (category) filter["aiAnalysis.category"] = category;

    // Text search
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { content: { $regex: search, $options: "i" } },
        { "aiAnalysis.keywords": { $in: [new RegExp(search, "i")] } },
      ];
    }

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = { [sortBy]: sortOrder === "desc" ? -1 : 1 };

    const [items, totalItems] = await Promise.all([
      Item.find(filter)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit))
        .populate("connections.itemId", "title type")
        .lean(),
      Item.countDocuments(filter),
    ]);

    res.json({
      success: true,
      items,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalItems / parseInt(limit)),
        totalItems,
        itemsPerPage: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("❌ Error fetching items:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch items",
    });
  }
});

// Get single item by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.userId,
    }).populate("connections.itemId", "title type createdAt");

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    res.json({
      success: true,
      item,
    });
  } catch (error) {
    console.error("❌ Error fetching item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch item",
    });
  }
});

// Semantic search endpoint
router.get("/search/semantic", auth, async (req, res) => {
  try {
    const { query, limit = 10 } = req.query;

    if (!query) {
      return res.status(400).json({
        success: false,
        message: "Search query is required",
      });
    }

    console.log("🔍 Performing semantic search for:", query);

    // Generate embedding for search query
    const queryEmbedding = await aiService.generateEmbedding(query);

    // Get all user's items with embeddings
    const items = await Item.find({
      userId: req.userId,
      embeddings: { $exists: true },
    }).populate("connections.itemId", "title type");

    // Calculate similarities and sort
    const results = items
      .map((item) => ({
        ...item.toObject(),
        similarity: aiService.cosineSimilarity(queryEmbedding, item.embeddings),
      }))
      .filter((item) => item.similarity > 0.3) // Minimum relevance threshold
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      query,
      results,
      totalFound: results.length,
    });
  } catch (error) {
    console.error("❌ Error in semantic search:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform semantic search",
    });
  }
});

// ===== UPDATE ITEMS =====

// Update item
router.put("/:id", auth, async (req, res) => {
  try {
    const { title, content, userTags } = req.body;

    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Update basic fields
    if (title) item.title = title;
    if (content) item.content = content;
    if (userTags) item.userTags = userTags;

    // Re-analyze if content changed
    if (content && content !== item.content) {
      const [aiAnalysis, embeddings] = await Promise.all([
        aiService.analyzeText(content),
        aiService.generateEmbedding(content),
      ]);

      item.aiAnalysis = aiAnalysis;
      item.embeddings = embeddings;

      // Recalculate connections
      const existingItems = await Item.find({
        userId: req.userId,
        _id: { $ne: item._id },
        embeddings: { $exists: true },
      });

      const connections = await aiService.findSimilarContent(
        item,
        existingItems
      );
      item.connections = connections;
    }

    item.updatedAt = new Date();
    await item.save();

    res.json({
      success: true,
      message: "Item updated successfully",
      item: await item.populate("connections.itemId", "title type"),
    });
  } catch (error) {
    console.error("❌ Error updating item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update item",
    });
  }
});

// ===== DELETE ITEMS =====

// Delete item
router.delete("/:id", auth, async (req, res) => {
  try {
    const item = await Item.findOne({
      _id: req.params.id,
      userId: req.userId,
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: "Item not found",
      });
    }

    // Delete associated file if exists
    if (item.filePath) {
      try {
        await fs.unlink(item.filePath);
      } catch (fileError) {
        console.warn("Could not delete file:", fileError.message);
      }
    }

    // Remove connections to this item from other items
    await Item.updateMany(
      { userId: req.userId },
      { $pull: { connections: { itemId: item._id } } }
    );

    await Item.findByIdAndDelete(item._id);

    // Update user stats
    await User.findByIdAndUpdate(req.userId, {
      $inc: {
        "stats.totalItems": -1,
        [`stats.itemsByType.${item.type}`]: -1,
      },
    });

    res.json({
      success: true,
      message: "Item deleted successfully",
    });
  } catch (error) {
    console.error("❌ Error deleting item:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete item",
    });
  }
});

// Serve uploaded files
router.get("/files/:filename", auth, (req, res) => {
  const filePath = path.join(__dirname, "../uploads", req.params.filename);
  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(404).json({
        success: false,
        message: "File not found",
      });
    }
  });
});

// GET /recommendations/external?userId=xxx OR ?itemId=xxx
router.get("/recommendations/external", async (req, res) => {
  try {
    console.log("🌐 External recommendations route hit");
    console.log("UserId:", req.query.userId);

    let keywords = "";
    if (req.query.itemId) {
      const item = await Item.findById(req.query.itemId);
      keywords = item?.aiAnalysis?.keywords?.join(" ") || item?.title || "";
      console.log("Keywords from itemId:", keywords);
    } else if (req.query.userId) {
      const item = await Item.findOne({ userId: req.query.userId }).sort({
        createdAt: -1,
      });
      keywords = item?.aiAnalysis?.keywords?.join(" ") || item?.title || "";
      console.log("Keywords from userId:", keywords);
    }

    if (!keywords.trim()) {
      keywords = "machine learning artificial intelligence";
      console.log("Using fallback keywords:", keywords);
    }

    console.log("Calling aiService.getExternalRecommendations with:", keywords);
    const recommendations = await aiService.getExternalRecommendations(
      keywords
    );

    console.log("External recommendations count:", recommendations.length);
    res.json({ recommendations });
  } catch (err) {
    console.error("❌ External recommendation error:", err);
    res.status(500).json({
      error: "External recommendation fetch failed",
      details: err.message,
    });
  }
});

// Get recommendations for user
router.get("/recommendations/:type?", auth, async (req, res) => {
  try {
    const { type = "hybrid" } = req.params;
    const { itemId, limit = 8 } = req.query;

    let recommendations = [];

    switch (type) {
      case "content":
        if (itemId) {
          recommendations =
            await recommendationService.getContentBasedRecommendations(
              req.userId,
              itemId,
              parseInt(limit)
            );
        }
        break;
      case "collaborative":
        recommendations =
          await recommendationService.getCollaborativeRecommendations(
            req.userId,
            parseInt(limit)
          );
        break;
      case "trending":
        recommendations =
          await recommendationService.getTrendingRecommendations(
            req.userId,
            parseInt(limit)
          );
        break;
      case "hybrid":
      default:
        recommendations = await recommendationService.getHybridRecommendations(
          req.userId,
          itemId,
          parseInt(limit)
        );
        break;
    }

    res.json({
      success: true,
      type,
      recommendations: recommendations.map((rec) => ({
        item: rec.item,
        score: Math.round(rec.score * 1000) / 1000, // Round to 3 decimal places
        reason: rec.reason,
        type: rec.type,
      })),
    });
  } catch (error) {
    console.error("❌ Error getting recommendations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recommendations",
    });
  }
});

// Log user interaction (view, like, etc.)
router.post("/interactions", auth, async (req, res) => {
  try {
    const { itemId, interactionType, weight = 1 } = req.body;

    await recommendationService.logUserInteraction(
      req.userId,
      itemId,
      interactionType,
      weight
    );

    res.json({
      success: true,
      message: "Interaction logged successfully",
    });
  } catch (error) {
    console.error("❌ Error logging interaction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log interaction",
    });
  }
});

module.exports = router;
