const { getAllMemories } = require("../../database");

function getRelevantMemories(message) {
  const memories = getAllMemories();

  if (!message || !memories.length) {
    return [];
  }

  const normalizedMessage = message.toLowerCase();

  return memories.filter((memory) => {
    return (
      normalizedMessage.includes(memory.memory_key.toLowerCase()) ||
      normalizedMessage.includes(memory.memory_value.toLowerCase()) ||
      normalizedMessage.includes(memory.category.toLowerCase())
    );
  });
}

function formatMemoriesForPrompt(memories) {
  if (!Array.isArray(memories) || memories.length === 0) {
    return "";
  }

  const lines = memories.map((memory) => {
    return `- ${memory.category}.${memory.memory_key}: ${memory.memory_value}`;
  });

  return `
ユーザーに関する記憶:
${lines.join("\n")}
`;
}

module.exports = {
  getRelevantMemories,
  formatMemoriesForPrompt,
};