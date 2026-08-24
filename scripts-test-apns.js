require("dotenv").config();

const Database =
  require("better-sqlite3");

const {
  sendPush,
} = require(
  "./src/services/APNsService"
);

async function main() {
  const db =
    new Database("notia.db");

  try {
    const target =
      db.prepare(`
        SELECT
          device_token
        FROM native_push_tokens
        WHERE platform = 'ios'
        ORDER BY updated_at DESC
        LIMIT 1
      `).get();

    if (!target) {
      throw new Error(
        "Push送信対象端末がありません。"
      );
    }

    await sendPush({
      deviceToken:
        target.device_token,
      title:
        "Notia",
      body:
        "Push通知のテストです。",
    });

    console.log(
      "APNs test push succeeded"
    );
  } finally {
    db.close();
  }
}

main().catch(
  (error) => {
    console.error(
      "APNs test push failed:",
      error.message
    );

    process.exitCode = 1;
  }
);
