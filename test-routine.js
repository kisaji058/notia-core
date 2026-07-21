const {
  createRoutine,
  getActiveRoutines,
} = require("./database");

const routine = createRoutine({
  title: "ジム",
  dayOfWeek: 1,
  routineTime: "18:00",
  category: "private",
  googleCalendarEnabled: false,
});

console.log("登録結果");
console.log(routine);

console.log();

console.log("一覧");
console.log(getActiveRoutines());