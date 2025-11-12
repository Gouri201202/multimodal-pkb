const mongoose = require("mongoose");

const ItemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    content: {
      type: String,
      required: false,
      maxlength: 10000,
    },

    type: {
      type: String,
      required: true,
      enum: ["text", "image", "audio", "web_clip", "document"],
      index: true,
    },

    filePath: String,
    fileUrl: String,
    fileName: String,
    fileSize: Number,
    mimeType: String,

    aiAnalysis: {
      summary: String,
      keywords: [String],
      topics: [String],
      sentiment: {
        label: {
          type: String,
          enum: ["positive", "negative", "neutral"],
        },
        score: Number,
      },
      entities: [
        {
          text: {
            type: String,
            required: true,
          },
          type: {
            type: String,
            required: true,
          },
          relevance: {
            type: Number,
            required: true,
          },
        },
      ],

      category: {
        type: String,
        enum: [
          "work",
          "personal",
          "research",
          "entertainment",
          "text",
          "image",
          "audio",
          "document",
          "other",
        ],
        default: "other",
      },
      importance: {
        type: String,
        enum: ["high", "medium", "low"],
        default: "medium",
      },
    },

    imageAnalysis: {
      description: String,
      objects: [String],
      scene: String,
      textDetected: String,
      colors: [String],
      tags: [String],
    },

    embeddings: {
      type: [Number],
      index: false,
    },

    userTags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],

    connections: [
      {
        itemId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Item",
        },
        strength: {
          type: Number,
          min: 0,
          max: 1,
        },
        reason: String,
        type: {
          type: String,
          enum: [
            "embedding_similarity",
            "keyword_match",
            "user_defined",
            "temporal",
          ],
        },
      },
    ],

    source: {
      url: String,
      domain: String,
    },

    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },

    lastAccessed: {
      type: Date,
      default: Date.now,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient searching
ItemSchema.index({
  title: "text",
  content: "text",
  "aiAnalysis.keywords": "text",
});
ItemSchema.index({ type: 1, userId: 1 });
ItemSchema.index({ "aiAnalysis.category": 1, userId: 1 });
ItemSchema.index({ createdAt: -1, userId: 1 });

// ❌ REMOVED THE PROBLEMATIC POST-HOOK - NO MORE ERRORS!

module.exports = mongoose.model("Item", ItemSchema);
