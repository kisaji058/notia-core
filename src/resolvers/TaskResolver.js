function resolve(
  analysis,
  context
) {
  if (
    analysis?.intent !==
      "schedule_query" ||
    analysis.scheduleQuery?.target !==
      "task"
  ) {
    return {
      handled: false,
      result: null,
    };
  }

  const title =
  analysis.scheduleQuery?.title?.trim();

  if (!title) {
    return {
      handled: false,
      result: null,
    };
  }

  return resolveTaskByTitle(
    title,
    context
  );
}

function resolveTaskByTitle(
  title,
  context
) {
  const activeTasks =
    context.activeTasks || [];

  const tasks =
  findTasksByTitle(
    title,
    context
  );

  console.log(tasks);

  if (tasks.length === 0) {
    return {
      handled: true,
      result: {
        type: "task_not_found",
        title,
      },
    };
  }

  return {
    handled: true,
    result: {
      type: "task_found",
      task: tasks[0],
    },
  };
}

function findTasksByTitle(
  title,
  context
) {
  console.log(
  "activeTasks:",
  context.activeTasks
);
  const activeTasks =
    context.activeTasks || [];

  return activeTasks
    .filter((task) =>
      task.title.includes(title)
    )
    .sort(compareTasksByDateTime);
}

function compareTasksByDateTime(
  taskA,
  taskB
) {
  const dateA =
    taskA.due_date || "9999-99-99";

  const dateB =
    taskB.due_date || "9999-99-99";

  if (dateA !== dateB) {
    return dateA.localeCompare(dateB);
  }

  const timeA =
    taskA.due_time || "99:99";

  const timeB =
    taskB.due_time || "99:99";

  return timeA.localeCompare(timeB);
}

module.exports = {
  resolve,
};
