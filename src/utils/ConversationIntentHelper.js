class ConversationIntentHelper {
  static normalize(message) {
    if (!message) {
      return "";
    }

    return message
      .trim()
      .toLowerCase()
      .replace(/[！!。．、,]/g, "")
      .replace(/\s+/g, "");
  }

  static isCancel(message) {
    const normalized = this.normalize(message);

    const exactPatterns = [
      "やっぱりなし",
      "やっぱなし",
      "やっぱりいい",
      "やっぱいい",
      "やっぱいいや",
      "もういい",
      "もういいや",
      "今はいい",
      "さっきのなし",
      "それなし",
      "これなし",
    ];

    if (exactPatterns.includes(normalized)) {
      return true;
    }

    const cancelKeywords = [
      "やめ",
      "取り消",
      "取消",
      "キャンセル",
      "取り下げ",
      "登録しない",
      "登録しなくていい",
      "タスクにしない",
      "忘れて",
    ];

    return cancelKeywords.some((keyword) =>
      normalized.includes(keyword)
    );
  }

  static isNoDueDate(message) {
    const normalized = this.normalize(message);

    return (
      normalized.includes("期限なし") ||
      normalized.includes("期限はなし") ||
      normalized === "未定"
    );
  }

  static isNoDueTime(message) {
  const normalized = this.normalize(message);

  return (
    normalized.includes("未定") ||
    normalized.includes("決まってない") ||
    normalized.includes("決まっていない") ||
    normalized.includes("時間なし") ||
    normalized.includes("時間はなし")
  );
}

  static isYes(message) {
    const normalized = this.normalize(message);

    const patterns = [
      "はい",
      "うん",
      "ok",
      "okay",
      "お願いします",
      "お願い",
      "いいよ",
      "それで",
      "そうして",
    ];

    return patterns.some((pattern) =>
      normalized.includes(pattern)
    );
  }

  static isNo(message) {
    const normalized = this.normalize(message);

    const patterns = [
      "いいえ",
      "いや",
      "違う",
      "違います",
      "なし",
    ];

    return patterns.some((pattern) =>
      normalized.includes(pattern)
    );
  }
}

module.exports = ConversationIntentHelper;