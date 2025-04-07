const User = require("../models/user");
const Listing = require("../models/listing");
const Transaction = require("../models/transaction");

async function generateAIInsight(region) {
  const insights = [];
  const match = region ? { location: region } : {};

  // 1. Top Listing Density
  const listingCount = await Listing.countDocuments(match);
  if (listingCount > 100) {
    insights.push(`📈 High listing volume detected in ${region || "this region"} – over 100 active listings.`);
  } else if (listingCount < 10) {
    insights.push(`🌱 Low market activity in ${region || "this region"}. Consider broadcasting market needs.`);
  }

  // 2. Top Sellers Reputation
  const topUsers = await User.find(match).sort({ reputationScore: -1 }).limit(3);
  if (topUsers.length > 0) {
    const names = topUsers.map(u => u.name || u.email).join(", ");
    insights.push(`🏆 Top rated producers this week: ${names}`);
  }

  // 3. PING Health
  const slowPings = await Transaction.countDocuments({ pingCount: { $gt: 5 }, ...match });
  if (slowPings > 10) {
    insights.push("⚠️ Several transactions are experiencing delays. Encourage producers to respond to PINGs promptly.");
  } else {
    insights.push("✅ Average transaction health is good. PING responsiveness is within expected limits.");
  }

  return insights;
}

module.exports = { generateAIInsight };
