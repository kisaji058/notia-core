const sessionManager = require("./sessionManager");

console.log("初期状態");
console.log(sessionManager.get("user1"));

console.log("期限確認待ちに変更");
sessionManager.set("user1", {
  mode: "waiting_due_date",
  pendingTask: {
    title: "成績処理",
    description: "成績を処理する",
  },
});

console.log(sessionManager.get("user1"));

console.log("リセット");
sessionManager.clear("user1");

console.log(sessionManager.get("user1"));