const {
  getRelevantMemories,
  formatMemoriesForPrompt,
} = require("../memory/MemoryRetriever");

class PromptBuilder {
  createSystemHint(message, result = {}) {
    const relevantMemories = getRelevantMemories(message);
    const memoryHint = formatMemoriesForPrompt(relevantMemories);

    const today = new Date().toLocaleDateString("sv-SE", {
      timeZone: "Asia/Tokyo",
    });

    return `
現在日時: ${today} (Asia/Tokyo)

ルール:
- 今日・明日・今週などの日付表現は、必ず現在日時を基準に答える。
- 日付を推測で作らない。

${result.systemHint || ""}

${memoryHint}
`;
  }

  build({ context = {}, systemHint = "" }) {
    return `
${systemHint}

## 最近の会話
${context.history || "なし"}
`;
  }
}

module.exports = new PromptBuilder();