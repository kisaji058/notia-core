const { saveOrUpdateMemory } = require("../../database");

function processMemory(analysis) {
  if (!analysis) return;

  const memories = analysis.memories;

  if (!Array.isArray(memories) || memories.length === 0) {
    return;
  }

  const results = [];

  for (const memory of memories) {
    if (!memory.category || !memory.key || !memory.value) {
      continue;
    }

    const result = saveOrUpdateMemory(
      memory.category,
      memory.key,
      memory.value
    );

    results.push(result);
  }

  return results;
}

module.exports = {
  processMemory,
};