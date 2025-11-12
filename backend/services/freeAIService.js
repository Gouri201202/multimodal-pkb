const axios = require("axios");
const sharp = require("sharp");
const fs = require("fs").promises;

class FreeAIService {
  constructor() {
    this.googleApiKey = process.env.GOOGLE_AI_API_KEY;
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.huggingfaceToken = process.env.HUGGINGFACE_API_KEY;
    this.openrouterApiKey = process.env.OPENROUTER_API_KEY;
    this.primaryService = process.env.PRIMARY_AI_SERVICE || "google";

    console.log(
      `🚀 AI Service initialized with primary: ${this.primaryService}`
    );
    console.log(
      `🔑 Google API Key: ${this.googleApiKey ? "✅ Present" : "❌ Missing"}`
    );
    console.log(
      `🔑 HuggingFace Token: ${
        this.huggingfaceToken ? "✅ Present" : "❌ Missing"
      }`
    );
  }

  async analyzeText(text) {
    try {
      console.log("🔍 Analyzing text with AI...");

      if (this.primaryService === "google" && this.googleApiKey) {
        return await this.analyzeWithGemini(text);
      }

      if (this.groqApiKey) {
        return await this.analyzeWithGroq(text);
      }

      if (this.openrouterApiKey) {
        return await this.analyzeWithOpenRouter(text);
      }

      return await this.localTextAnalysis(text);
    } catch (error) {
      console.error("❌ Error in text analysis:", error.message);
      return await this.localTextAnalysis(text);
    }
  }

  async analyzeWithGemini(text) {
    const prompt = `Analyze this text and extract key insights in JSON format:

Text: "${text}"

Please return a JSON object with:
{
  "summary": "Brief summary of the content",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "topics": ["main topic 1", "topic 2"],
  "sentiment": {
    "label": "positive/negative/neutral",
    "score": 0.8
  },
  "entities": [
    {
      "text": "entity name",
      "type": "PERSON/ORGANIZATION/LOCATION/OTHER",
      "relevance": 0.9
    }
  ],
  "category": "work/personal/research/entertainment/other",
  "importance": "high/medium/low"
}`;

    try {
      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.googleApiKey}`,
        {
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      const generatedText = response.data.candidates[0].content.parts[0].text;
      console.log(
        "✅ Gemini raw response:",
        generatedText.substring(0, 200) + "..."
      );

      // Extract JSON - simple and safe
      const startIndex = generatedText.indexOf("{");
      const endIndex = generatedText.lastIndexOf("}");

      if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
        let jsonString = generatedText.substring(startIndex, endIndex + 1);

        // Clean up simple formatting
        jsonString = jsonString.replace("```json", "");
        jsonString = jsonString.replace("```", "");
        jsonString = jsonString.trim();

        try {
          const parsed = JSON.parse(jsonString);
          console.log("✅ Gemini analysis successful!");

          // ✅ BETTER ENTITY VALIDATION AND CLEANING
          if (parsed.entities) {
            // If entities is a string (shouldn't happen but let's handle it)
            if (typeof parsed.entities === "string") {
              try {
                parsed.entities = JSON.parse(parsed.entities);
              } catch (e) {
                console.warn(
                  "⚠️ Could not parse entities string, setting to empty array"
                );
                parsed.entities = [];
              }
            }

            // Ensure entities is an array
            if (!Array.isArray(parsed.entities)) {
              parsed.entities = [];
            }

            // Clean and validate each entity
            parsed.entities = parsed.entities
              .filter(
                (entity) => entity && typeof entity === "object" && entity.text
              )
              .map((entity) => ({
                text: String(entity.text).trim(),
                type: String(entity.type || "OTHER").toUpperCase(),
                relevance: Number(entity.relevance) || 0.5,
              }))
              .slice(0, 10); // Limit to 10 entities max
          } else {
            parsed.entities = [];
          }

          // ✅ LOG THE FINAL ENTITIES FOR DEBUGGING
          console.log(
            "🔍 Final entities structure:",
            JSON.stringify(parsed.entities, null, 2)
          );

          return parsed;
        } catch (parseError) {
          console.error("❌ JSON parse error:", parseError.message);
          throw new Error("Could not parse Gemini JSON response");
        }
      }

      throw new Error("Could not extract JSON from Gemini response");
    } catch (error) {
      console.error("❌ Gemini analysis failed:", error.message);
      if (error.response) {
        console.error("Gemini response status:", error.response.status);
        console.error(
          "Gemini response data:",
          JSON.stringify(error.response.data)
        );
      }
      throw error;
    }
  }

  async analyzeWithGroq(text) {
    const prompt = `Analyze this text and return insights in JSON format: "${text}"`;

    try {
      const response = await axios.post(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          messages: [{ role: "user", content: prompt }],
          model: "llama-3.3-70b-versatile",
          temperature: 0.3,
          max_tokens: 1024,
        },
        {
          headers: {
            Authorization: `Bearer ${this.groqApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices[0].message.content;
      const startIndex = content.indexOf("{");
      const endIndex = content.lastIndexOf("}");

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = content.substring(startIndex, endIndex + 1);
        const parsed = JSON.parse(jsonString);

        if (!Array.isArray(parsed.entities)) {
          parsed.entities = [];
        }

        return parsed;
      }

      throw new Error("Could not parse Groq response");
    } catch (error) {
      console.error("❌ Groq analysis failed:", error.message);
      throw error;
    }
  }

  async analyzeWithOpenRouter(text) {
    const prompt = `Analyze this text and return JSON with insights: "${text}"`;

    try {
      const response = await axios.post(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          model: "deepseek/deepseek-r1:free",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
        },
        {
          headers: {
            Authorization: `Bearer ${this.openrouterApiKey}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const content = response.data.choices[0].message.content;
      const startIndex = content.indexOf("{");
      const endIndex = content.lastIndexOf("}");

      if (startIndex !== -1 && endIndex !== -1) {
        const jsonString = content.substring(startIndex, endIndex + 1);
        const parsed = JSON.parse(jsonString);

        if (!Array.isArray(parsed.entities)) {
          parsed.entities = [];
        }

        return parsed;
      }

      throw new Error("Could not parse OpenRouter response");
    } catch (error) {
      console.error("❌ OpenRouter analysis failed:", error.message);
      throw error;
    }
  }
  async generateEmbedding(text) {
    try {
      console.log(
        "🔢 Generating embeddings for:",
        text.substring(0, 50) + "..."
      );

      if (this.huggingfaceToken) {
        try {
          // ✅ Use the correct HuggingFace endpoint and model
          const response = await axios.post(
            "https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2",
            { inputs: text },
            {
              headers: {
                Authorization: `Bearer ${this.huggingfaceToken}`,
                "Content-Type": "application/json",
              },
              timeout: 30000,
            }
          );

          console.log("✅ HuggingFace embeddings generated successfully");

          // The response is directly an array of numbers
          if (Array.isArray(response.data) && response.data.length > 0) {
            return response.data;
          }

          console.warn(
            "⚠️ Unexpected HuggingFace response format, using fallback"
          );
        } catch (hfError) {
          console.warn(
            "⚠️ HuggingFace API failed:",
            hfError.response?.status || hfError.message
          );
          console.log("↩️ Falling back to local embeddings");
        }
      }

      // Fallback to simple embeddings
      console.log("📊 Using local simple embeddings");
      return this.generateSimpleEmbedding(text);
    } catch (error) {
      console.error("❌ Embedding generation failed:", error.message);
      return this.generateSimpleEmbedding(text);
    }
  }

  // Add this helper method
  generateSimpleEmbedding(text) {
    // Create a simple but consistent embedding based on text characteristics
    const words = text.toLowerCase().split(/\s+/);
    const embedding = new Array(384).fill(0);

    // Generate features based on text properties
    for (let i = 0; i < Math.min(words.length, 100); i++) {
      const word = words[i];
      const wordHash = this.simpleHash(word);
      const index = Math.abs(wordHash) % 384;
      embedding[index] += 0.1;
    }

    // Add text length features
    embedding[0] = Math.min(text.length / 1000, 1.0);
    embedding[1] = Math.min(words.length / 100, 1.0);

    // Normalize
    const magnitude = Math.sqrt(
      embedding.reduce((sum, val) => sum + val * val, 0)
    );
    if (magnitude > 0) {
      for (let i = 0; i < embedding.length; i++) {
        embedding[i] /= magnitude;
      }
    }

    return embedding;
  }

  // Simple hash function
  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  }

  // Analyze image with Gemini Vision
  // Add this method to the FreeAIService class
  async analyzeImage(imagePath) {
    try {
      console.log("🖼️ Analyzing image with Gemini Vision...");

      const imageBuffer = await fs.readFile(imagePath);
      const base64Image = imageBuffer.toString("base64");

      let mimeType = "image/jpeg";
      if (imagePath.toLowerCase().endsWith(".png")) mimeType = "image/png";
      else if (imagePath.toLowerCase().endsWith(".gif")) mimeType = "image/gif";
      else if (imagePath.toLowerCase().endsWith(".webp"))
        mimeType = "image/webp";

      const prompt = `Analyze this image in detail. Describe:
1. Main subject and topic
2. Key concepts, terms, or text visible in the image
3. Type of content (diagram, chart, infographic, photo, etc.)
4. Important keywords related to the content

Provide a comprehensive description focusing on the technical or conceptual content.`;

      const response = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.googleApiKey}`,
        {
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inline_data: {
                    mime_type: mimeType,
                    data: base64Image,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.4,
            topK: 32,
            topP: 1,
            maxOutputTokens: 1024,
          },
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 30000,
        }
      );

      if (!response.data.candidates || response.data.candidates.length === 0) {
        throw new Error("No response from Gemini Vision");
      }

      const result = response.data.candidates[0].content.parts[0].text;
      console.log(
        "✅ Gemini Vision raw response:",
        result.substring(0, 300) + "..."
      );

      // ✅ EXTRACT KEYWORDS - Simple word extraction
      const keywords = result
        .toLowerCase()
        .replace(/[^\w\s]/g, " ")
        .split(/\s+/)
        .filter((word) => word.length > 3)
        .filter(
          (word) =>
            ![
              "this",
              "that",
              "with",
              "from",
              "have",
              "been",
              "were",
              "would",
              "could",
              "should",
              "their",
              "there",
              "where",
              "which",
              "about",
              "these",
              "those",
            ].includes(word)
        )
        .reduce((acc, word) => {
          acc[word] = (acc[word] || 0) + 1;
          return acc;
        }, {});

      const topKeywords = Object.entries(keywords)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([word]) => word);

      // ✅ EXTRACT TOPICS - Look for specific patterns
      const topics = [];
      const topicPatterns = {
        "Machine Learning":
          /machine learning|ml techniques|supervised|unsupervised/i,
        "Artificial Intelligence": /artificial intelligence|ai systems/i,
        "Data Science": /data science|data analysis|analytics/i,
        Algorithms: /algorithm|classification|regression|clustering/i,
        Prediction: /prediction|forecasting|forecast/i,
        Analysis: /analysis|processing|segmentation/i,
      };

      for (const [topic, pattern] of Object.entries(topicPatterns)) {
        if (pattern.test(result)) {
          topics.push(topic);
        }
      }

      // ✅ CATEGORIZE CONTENT
      let category = "other";
      const lowerResult = result.toLowerCase();
      if (
        lowerResult.includes("research") ||
        lowerResult.includes("machine learning") ||
        lowerResult.includes("data science") ||
        lowerResult.includes("algorithm")
      ) {
        category = "research";
      } else if (
        lowerResult.includes("work") ||
        lowerResult.includes("business")
      ) {
        category = "work";
      }

      return {
        description: result,
        keywords: topKeywords,
        topics: topics.length > 0 ? topics : ["Visual Content"],
        category: category,
        objects: [],
        textDetected: result.toLowerCase().includes("text")
          ? "Text detected"
          : null,
      };
    } catch (error) {
      console.error("❌ Image analysis failed:", error.message);
      if (error.response) {
        console.error("Error response:", error.response.data);
      }

      // Fallback
      const filename = imagePath
        .split("/")
        .pop()
        .replace(/\.(jpg|jpeg|png|gif|webp)$/i, "");
      const titleWords = filename
        .replace(/[-_]/g, " ")
        .toLowerCase()
        .split(" ")
        .filter((w) => w.length > 2);

      return {
        description: `Image about ${filename.replace(/[-_]/g, " ")}`,
        keywords: titleWords,
        topics: ["Visual Content"],
        category: "other",
        objects: [],
        textDetected: null,
      };
    }
  }

  // Helper method to categorize content
  categorizeContent(text) {
    const lowerText = text.toLowerCase();
    if (
      lowerText.includes("work") ||
      lowerText.includes("business") ||
      lowerText.includes("office")
    ) {
      return "work";
    }
    if (
      lowerText.includes("research") ||
      lowerText.includes("study") ||
      lowerText.includes("science")
    ) {
      return "research";
    }
    if (
      lowerText.includes("personal") ||
      lowerText.includes("family") ||
      lowerText.includes("home")
    ) {
      return "personal";
    }
    if (
      lowerText.includes("entertainment") ||
      lowerText.includes("fun") ||
      lowerText.includes("game")
    ) {
      return "entertainment";
    }
    return "other";
  }

  // Helper method to extract topics
  extractTopics(text) {
    const topics = [];
    const topicPatterns = [
      /machine learning/gi,
      /artificial intelligence/gi,
      /data science/gi,
      /deep learning/gi,
      /neural network/gi,
      /algorithm/gi,
      /technology/gi,
      /programming/gi,
      /software/gi,
      /education/gi,
    ];

    topicPatterns.forEach((pattern) => {
      const matches = text.match(pattern);
      if (matches) {
        topics.push(matches[0]);
      }
    });

    return [...new Set(topics)]; // Remove duplicates
  }

  // Analyze PDF document
  async analyzePDF(pdfPath) {
    try {
      console.log("📄 Analyzing PDF document...");

      const dataBuffer = await fs.promises.readFile(pdfPath);
      const pdfParse = require("pdf-parse");
      const data = await pdfParse(dataBuffer);

      const text = data.text.substring(0, 5000); // First 5000 chars
      console.log(`📊 Extracted ${data.text.length} characters from PDF`);

      // Analyze extracted text
      return await this.analyzeText(text);
    } catch (error) {
      console.error("❌ PDF analysis error:", error.message);
      throw error;
    }
  }

  async transcribeAudio(audioPath) {
    try {
      console.log("🎵 Transcribing audio...");
      return {
        transcript: "Audio transcription will be implemented here",
        confidence: 0.0,
        language: "en",
      };
    } catch (error) {
      console.error("❌ Audio transcription failed:", error.message);
      return {
        transcript: "",
        confidence: 0.0,
        language: "en",
      };
    }
  }
  async getExternalRecommendations(keywords) {
    console.log(
      "🌐 getExternalRecommendations called with keywords:",
      keywords
    );

    const axios = require("axios");
    const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
    const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;
    const youtubeApiKey = process.env.YOUTUBE_API_KEY;

    console.log("API Keys present:", {
      google: !!googleApiKey,
      cx: !!cx,
      youtube: !!youtubeApiKey,
    });

    try {
      // Google Custom Search
      console.log("Fetching from Google Custom Search...");
      const googleRes = await axios.get(
        "https://www.googleapis.com/customsearch/v1",
        {
          params: { key: googleApiKey, cx: cx, q: keywords, num: 5 },
        }
      );
      const articles =
        googleRes.data.items?.map((item) => ({
          id: item.link,
          title: item.title,
          url: item.link,
          description: item.snippet,
        })) || [];
      console.log("Google results:", articles.length);

      // YouTube Data API
      console.log("Fetching from YouTube...");
      const ytRes = await axios.get(
        "https://www.googleapis.com/youtube/v3/search",
        {
          params: {
            key: youtubeApiKey,
            q: keywords,
            type: "video",
            part: "snippet",
            maxResults: 3,
          },
        }
      );
      const videos =
        ytRes.data.items?.map((item) => ({
          id: item.id.videoId,
          title: item.snippet.title,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
          description: item.snippet.description,
        })) || [];
      console.log("YouTube results:", videos.length);

      const combined = [...articles, ...videos];
      console.log("✅ Total external recommendations:", combined.length);
      return combined;
    } catch (error) {
      console.error("❌ External recommendation error:", error.message);
      if (error.response) {
        console.error("API Error Response:", error.response.data);
      }
      return [];
    }
  }

  cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
      return 0;
    }

    const dotProduct = vecA.reduce((sum, a, idx) => sum + a * vecB[idx], 0);
    const normA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
    const normB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

    if (normA === 0 || normB === 0) return 0;

    return dotProduct / (normA * normB);
  }

  async findSimilarContent(newItem, existingItems, threshold = 0.3) {
    const connections = [];

    console.log("🔍 Finding similar content using semantic embeddings...");
    console.log(
      `📊 New item embeddings: ${
        newItem.embeddings
          ? "Present (" + newItem.embeddings.length + " dims)"
          : "Missing"
      }`
    );
    console.log(`📂 Checking ${existingItems.length} existing items`);

    if (!newItem.embeddings || existingItems.length === 0) {
      console.warn("⚠️ No embeddings or no existing items to compare");
      return connections;
    }

    for (const item of existingItems) {
      if (!item.embeddings || item._id.toString() === newItem._id?.toString()) {
        continue;
      }

      const similarity = this.cosineSimilarity(
        newItem.embeddings,
        item.embeddings
      );

      console.log(
        `  📏 Similarity with "${item.title}": ${similarity.toFixed(3)}`
      );

      if (similarity > threshold) {
        connections.push({
          itemId: item._id,
          title: item.title,
          similarity: Math.round(similarity * 1000) / 1000,
          reason: `${Math.round(similarity * 100)}% semantically similar`,
          type: "embedding_similarity",
        });

        console.log(
          `    ✅ Connection found! (${Math.round(similarity * 100)}%)`
        );
      }
    }

    console.log(`✅ Total connections found: ${connections.length}`);
    return connections.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
  }

  async localTextAnalysis(text) {
    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3);

    const wordCount = {};
    words.forEach((word) => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    const keywords = Object.entries(wordCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map((entry) => entry[0]);

    const positiveWords = [
      "good",
      "great",
      "excellent",
      "amazing",
      "wonderful",
      "fantastic",
      "love",
      "best",
      "awesome",
      "outstanding",
      "brilliant",
      "perfect",
    ];
    const negativeWords = [
      "bad",
      "terrible",
      "awful",
      "horrible",
      "sad",
      "angry",
      "worst",
      "hate",
      "disappointed",
      "frustrating",
      "annoying",
    ];

    let sentiment = 0;
    words.forEach((word) => {
      if (positiveWords.includes(word)) sentiment++;
      if (negativeWords.includes(word)) sentiment--;
    });

    const sentimentLabel =
      sentiment > 0 ? "positive" : sentiment < 0 ? "negative" : "neutral";
    const sentimentScore = Math.min(
      (Math.abs(sentiment) / words.length) * 2,
      1.0
    );

    return {
      summary: text.length > 200 ? text.substring(0, 200) + "..." : text,
      keywords,
      topics: keywords.slice(0, 3),
      sentiment: {
        label: sentimentLabel,
        score: sentimentScore,
      },
      entities: [],
      category: "other",
      importance: "medium",
    };
  }

  getDefaultImageAnalysis() {
    return {
      description: "Image uploaded and stored",
      objects: [],
      scene: "unknown",
      text_detected: "",
      colors: [],
      tags: ["image"],
      category: "photo",
    };
  }

  generateSummary(analysis) {
    if (analysis.summary) {
      return analysis.summary;
    }

    const keywordsText =
      analysis.keywords.length > 0
        ? `Key topics: ${analysis.keywords.slice(0, 3).join(", ")}.`
        : "";

    const sentimentText =
      analysis.sentiment.label !== "neutral"
        ? ` Tone: ${analysis.sentiment.label}.`
        : "";

    return (
      `${keywordsText}${sentimentText}`.trim() || "Content analyzed and stored."
    );
  }
}

module.exports = new FreeAIService();
