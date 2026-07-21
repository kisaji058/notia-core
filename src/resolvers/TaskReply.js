const {
  formatScheduleDate,
} = require("../utils/DateUtils");

function build(result) {
  if (!result) {
    return null;
  }

  switch (result.type) {
    case "task_not_found":
      return buildTaskNotFoundReply(
        result
      );

    case "task_found":
      return buildTaskFoundReply(
        result
      );

    default:
      return null;
  }
}

function buildTaskNotFoundReply(
  result
) {
  return `「${result.title}」という予定は見つかりませんでした。`;
}

function buildTaskFoundReply(
  result
) {
  const task = result.task;

  let reply =
    `「${task.title}」`;

  if (task.due_date) {
    reply +=
      `は${formatScheduleDate(task.due_date)}`;
  }

  if (task.due_time) {
    reply +=
      ` ${task.due_time}`;
  }

  reply += "です。";

  return reply;
}

module.exports = {
  build,
};