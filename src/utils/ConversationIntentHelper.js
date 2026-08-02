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

  const exactPatterns = [
    "なし",
    "ない",
    "特になし",
    "指定なし",
    "設定なし",
  ];

  const partialPatterns = [
    "未定",
    "決まってない",
    "決まっていない",
    "決めてない",
    "決めていない",
    "時間なし",
    "時間はなし",
    "時間指定なし",
    "時間指定はなし",
    "指定しない",
    "設定しない",
    "時間はいらない",
    "時間は不要",
    "時間不要",
    "後で決める",
    "あとで決める",
  ];

  return (
    exactPatterns.includes(normalized) ||
    partialPatterns.some((pattern) =>
      normalized.includes(pattern)
    )
  );
  }

  static parseDueTime(message) {
    const normalized = this
      .normalize(message)
      .replace(/[０-９]/g, (character) =>
        String.fromCharCode(
          character.charCodeAt(0) - 0xfee0
        )
      )
      .replace(/：/g, ":");

    const colonMatch = normalized.match(
      /(午前|午後)?(\d{1,2}):(\d{1,2})/
    );

    const japaneseMatch = normalized.match(
      /(午前|午後)?(\d{1,2})時(?:(\d{1,2})分?|(半))?/
    );

    const match =
      colonMatch || japaneseMatch;

    if (!match) {
      return null;
    }

    const period = match[1] || null;
    let hour = Number(match[2]);
    const minute = match[4]
      ? 30
      : Number(match[3] || 0);

    if (period === "午後" && hour < 12) {
      hour += 12;
    }

    if (period === "午前" && hour === 12) {
      hour = 0;
    }

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      return null;
    }

    return [
      String(hour).padStart(2, "0"),
      String(minute).padStart(2, "0"),
    ].join(":");
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