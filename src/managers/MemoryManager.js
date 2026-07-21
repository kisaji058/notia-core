const scheduleResolver =
  require("../resolvers/ScheduleResolver");

const routineResolver =
  require("../resolvers/RoutineResolver");

const taskResolver =
  require("../resolvers/TaskResolver");

function resolve(_message, context) {
  const analysis = context?.analysis;

  if (!analysis?.intent) {
    return createUnhandledResult();
  }

  if (
    analysis.intent === "routine_create"
  ) {
    return routineResolver.resolve(
      analysis,
      context
    );
  }

  if (
    analysis.intent !== "schedule_query"
  ) {
    return createUnhandledResult();
  }

  switch (
    analysis.scheduleQuery?.target
  ) {
    case "task":
      if (
        !analysis.scheduleQuery?.title
      ) {
        return createUnhandledResult();
      }

      return taskResolver.resolve(
        analysis,
        context
      );

    case "routine":
      return routineResolver.resolve(
        analysis,
        context
      );

    default:
      return scheduleResolver.resolve(
        analysis,
        context
      );
  }
}

function createUnhandledResult() {
  return {
    handled: false,
    reply: null,
    result: null,
  };
}

function processMemory(_analysis) {
  // 現時点では何もしない
}

module.exports = {
  processMemory,
  resolve,
};