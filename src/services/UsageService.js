const {
  reserveDocumentPages,
  commitDocumentPages,
  releaseDocumentPages,
} = require("../../database");

const {
  getDocumentPageLimit,
} = require("./EntitlementService");

function getJstMonthlyPeriod(
  now = new Date()
) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
      }
    );

  const parts =
    formatter.formatToParts(now);

  const year = Number(
    parts.find(
      (part) =>
        part.type === "year"
    ).value
  );

  const month = Number(
    parts.find(
      (part) =>
        part.type === "month"
    ).value
  );

  const nextYear =
    month === 12
      ? year + 1
      : year;

  const nextMonth =
    month === 12
      ? 1
      : month + 1;

  const pad = (value) =>
    String(value).padStart(2, "0");

  return {
    periodStart:
      `${year}-${pad(month)}-01T00:00:00+09:00`,

    periodEnd:
      `${nextYear}-${pad(nextMonth)}-01T00:00:00+09:00`,
  };
}

function reserveDocumentUsage({
  userId,
  pageCount,
}) {
  const pageLimit =
    getDocumentPageLimit(
      userId
    );

  if (pageLimit === null) {
    return {
      success: true,
      unlimited: true,
      reservation: null,
    };
  }

  const {
    periodStart,
    periodEnd,
  } = getJstMonthlyPeriod();

  const result =
    reserveDocumentPages({
      userId,
      periodStart,
      periodEnd,
      requestedPages:
        pageCount,
      pageLimit,
    });

  return {
    ...result,
    unlimited: false,
    reservation: {
      periodStart,
      periodEnd,
      pageCount,
    },
  };
}

function commitDocumentUsage({
  userId,
  reservation,
}) {
  if (!reservation) {
    return;
  }

  return commitDocumentPages({
    userId,
    periodStart:
      reservation.periodStart,
    periodEnd:
      reservation.periodEnd,
    pageCount:
      reservation.pageCount,
  });
}

function releaseDocumentUsage({
  userId,
  reservation,
}) {
  if (!reservation) {
    return;
  }

  return releaseDocumentPages({
    userId,
    periodStart:
      reservation.periodStart,
    periodEnd:
      reservation.periodEnd,
    pageCount:
      reservation.pageCount,
  });
}

module.exports = {
  getJstMonthlyPeriod,
  reserveDocumentUsage,
  commitDocumentUsage,
  releaseDocumentUsage,
};
