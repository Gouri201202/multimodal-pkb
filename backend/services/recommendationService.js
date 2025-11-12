const Item = require("../models/Item");

class RecommendationService {
  constructor() {
    this.userInteractions = new Map(); // Store user interactions in memory
  }

  // Log user interactions (views, likes, creation)
  async logUserInteraction(userId, itemId, interactionType, weight = 1) {
    if (!this.userInteractions.has(userId)) {
      this.userInteractions.set(userId, new Map());
    }

    const userMap = this.userInteractions.get(userId);
    const currentScore = userMap.get(itemId) || 0;
    userMap.set(itemId, currentScore + weight);

    console.log(
      `📊 Logged interaction: User ${userId} -> Item ${itemId} (${interactionType}, weight: ${weight})`
    );
  }

  // Content-based recommendations using AI analysis
  async getContentBasedRecommendations(userId, itemId, limit = 5) {
    try {
      console.log(
        `🎯 Generating content-based recommendations for user ${userId} based on item ${itemId}`
      );

      // Get the source item
      const sourceItem = await Item.findOne({ _id: itemId, userId });
      if (!sourceItem) {
        return [];
      }

      // Find similar items based on AI analysis
      const candidates = await Item.find({
        userId,
        _id: { $ne: itemId },
        "aiAnalysis.keywords": { $exists: true },
      }).select("title aiAnalysis embeddings type createdAt");

      const recommendations = [];

      for (const candidate of candidates) {
        let score = 0;

        // Keyword similarity (40% weight)
        const keywordScore = this.calculateKeywordSimilarity(
          sourceItem.aiAnalysis.keywords || [],
          candidate.aiAnalysis.keywords || []
        );
        score += keywordScore * 0.4;

        // Category match (20% weight)
        if (
          sourceItem.aiAnalysis?.category === candidate.aiAnalysis?.category
        ) {
          score += 0.2;
        }

        // Topic similarity (30% weight)
        const topicScore = this.calculateTopicSimilarity(
          sourceItem.aiAnalysis.topics || [],
          candidate.aiAnalysis.topics || []
        );
        score += topicScore * 0.3;

        // Recency boost (10% weight)
        const recencyScore = this.calculateRecencyScore(candidate.createdAt);
        score += recencyScore * 0.1;

        if (score > 0.15) {
          // Minimum similarity threshold
          recommendations.push({
            item: candidate,
            score: score,
            reason: this.generateRecommendationReason(
              sourceItem,
              candidate,
              keywordScore,
              topicScore
            ),
            type: "content_based",
          });
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("❌ Content-based recommendation error:", error.message);
      return [];
    }
  }

  // Collaborative filtering based on user interactions
  async getCollaborativeRecommendations(userId, limit = 5) {
    try {
      console.log(
        `🤝 Generating collaborative recommendations for user ${userId}`
      );

      const userInteractions = this.userInteractions.get(userId);
      if (!userInteractions || userInteractions.size === 0) {
        return [];
      }

      // Find users with similar interaction patterns
      const similarUsers = this.findSimilarUsers(userId);
      if (similarUsers.length === 0) {
        return [];
      }

      // Get recommendations based on similar users' preferences
      const recommendedItems = new Map();

      for (const [similarUserId, similarity] of similarUsers) {
        const similarUserInteractions =
          this.userInteractions.get(similarUserId);
        if (similarUserInteractions) {
          for (const [itemId, score] of similarUserInteractions) {
            if (!userInteractions.has(itemId)) {
              // Don't recommend items user already interacted with
              const currentScore = recommendedItems.get(itemId) || 0;
              recommendedItems.set(itemId, currentScore + score * similarity);
            }
          }
        }
      }

      // Convert to array and get item details
      const recommendations = [];
      for (const [itemId, score] of recommendedItems) {
        try {
          const item = await Item.findById(itemId).select(
            "title type aiAnalysis createdAt"
          );
          if (item) {
            recommendations.push({
              item,
              score: score,
              reason: `Recommended based on users with similar interests`,
              type: "collaborative",
            });
          }
        } catch (err) {
          continue; // Skip invalid items
        }
      }

      return recommendations.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (error) {
      console.error("❌ Collaborative recommendation error:", error.message);
      return [];
    }
  }
  // Hybrid recommendations combining both approaches
  async getHybridRecommendations(userId, itemId = null, limit = 8) {
    try {
      console.log(`🔥 Generating hybrid recommendations for user ${userId}`);

      // Get content-based if itemId exists
      const contentBased = itemId
        ? await this.getContentBasedRecommendations(userId, itemId, limit)
        : [];

      // Get collaborative
      const collaborative = await this.getCollaborativeRecommendations(
        userId,
        limit
      );

      // Combine and deduplicate
      const combinedMap = new Map();

      contentBased.forEach((rec) => {
        combinedMap.set(rec.item._id.toString(), {
          ...rec,
          score: rec.score * 0.7, // 70% weight
        });
      });

      collaborative.forEach((rec) => {
        const itemIdStr = rec.item._id.toString();
        if (combinedMap.has(itemIdStr)) {
          const existing = combinedMap.get(itemIdStr);
          existing.score = existing.score + rec.score * 0.3;
          existing.reason += ` and similar user preferences`;
        } else {
          combinedMap.set(itemIdStr, {
            ...rec,
            score: rec.score * 0.3, // 30% weight
          });
        }
      });

      let recommendations = Array.from(combinedMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      // -------- FALLBACK: Always show something --------
      if (recommendations.length === 0) {
        console.log("⚠️ No recommendations found, using fallback...");
        const allUserItems = await Item.find({ userId })
          .sort({ createdAt: -1 })
          .limit(limit);

        recommendations = allUserItems.map((item) => ({
          item,
          score: 0.5 + (item.connections?.length || 0) * 0.1,
          reason:
            item.connections?.length > 0
              ? `Connected to ${item.connections.length} items`
              : "Recent item",
          type: "fallback",
        }));
      }

      console.log(
        `✅ Returning ${recommendations.length} hybrid recommendations`
      );
      return recommendations;
    } catch (error) {
      console.error("❌ Hybrid recommendation error:", error.message);
      return [];
    }
  }

  // Trending/Popular items for new users
  async getTrendingRecommendations(userId, limit = 5) {
    try {
      const recentItems = await Item.find({
        userId: { $ne: userId }, // Exclude user's own items
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
      })
        .sort({ createdAt: -1 })
        .limit(limit * 2)
        .select("title type aiAnalysis createdAt");

      return recentItems.slice(0, limit).map((item) => ({
        item,
        score: this.calculateRecencyScore(item.createdAt),
        reason: "Trending content from other users",
        type: "trending",
      }));
    } catch (error) {
      console.error("❌ Trending recommendation error:", error.message);
      return [];
    }
  }

  // Helper methods
  calculateKeywordSimilarity(keywords1, keywords2) {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1.map((k) => k.toLowerCase()));
    const set2 = new Set(keywords2.map((k) => k.toLowerCase()));
    const intersection = new Set([...set1].filter((k) => set2.has(k)));

    return intersection.size / Math.max(set1.size, set2.size);
  }

  calculateTopicSimilarity(topics1, topics2) {
    if (topics1.length === 0 || topics2.length === 0) return 0;

    const set1 = new Set(topics1.map((t) => t.toLowerCase()));
    const set2 = new Set(topics2.map((t) => t.toLowerCase()));
    const intersection = new Set([...set1].filter((t) => set2.has(t)));

    return intersection.size / Math.max(set1.size, set2.size);
  }

  calculateRecencyScore(createdAt) {
    const ageInDays =
      (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return Math.max(0, 1 - ageInDays / 30); // Decays over 30 days
  }

  findSimilarUsers(userId) {
    const targetUserInteractions = this.userInteractions.get(userId);
    if (!targetUserInteractions) return [];

    const similarities = [];

    for (const [otherUserId, otherInteractions] of this.userInteractions) {
      if (otherUserId === userId) continue;

      const similarity = this.calculateUserSimilarity(
        targetUserInteractions,
        otherInteractions
      );
      if (similarity > 0.3) {
        // Minimum similarity threshold
        similarities.push([otherUserId, similarity]);
      }
    }

    return similarities.sort((a, b) => b[1] - a[1]).slice(0, 5); // Top 5 similar users
  }

  calculateUserSimilarity(interactions1, interactions2) {
    const items1 = new Set(interactions1.keys());
    const items2 = new Set(interactions2.keys());
    const commonItems = new Set([...items1].filter((item) => items2.has(item)));

    if (commonItems.size === 0) return 0;

    // Jaccard similarity
    const union = new Set([...items1, ...items2]);
    return commonItems.size / union.size;
  }

  generateRecommendationReason(
    sourceItem,
    candidateItem,
    keywordScore,
    topicScore
  ) {
    const reasons = [];

    if (keywordScore > 0.5) {
      reasons.push("similar keywords");
    }
    if (topicScore > 0.5) {
      reasons.push("related topics");
    }
    if (
      sourceItem.aiAnalysis?.category === candidateItem.aiAnalysis?.category
    ) {
      reasons.push("same category");
    }

    return reasons.length > 0
      ? `Similar content: ${reasons.join(", ")}`
      : "Related content based on analysis";
  }
}

module.exports = new RecommendationService();
