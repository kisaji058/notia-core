function normalizeDigits(value) {
  return String(value || "")
    .replace(/[０-９]/g, (char) =>
      String.fromCharCode(
        char.charCodeAt(0) - 0xfee0
      )
    );
}

function parseMonthNumber(value) {
  const normalized =
    normalizeDigits(value)
      .replace(/\s+/g, "");

  const match =
    normalized.match(
      /^(\d{1,2})月$/
    );

  if (!match) {
    return null;
  }

  const month =
    Number(match[1]);

  if (
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    return null;
  }

  return month;
}

function detectMonthHeaders(
  items,
  pageHeight
) {
  void pageHeight;

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return [];
  }

  const candidates = [];

  // 「9月」のように1要素になっている場合
  for (const item of items) {
    const month =
      parseMonthNumber(
        item.text
      );

    if (month) {
      candidates.push({
        month,
        x: item.x,
        y: item.y,
      });
    }
  }

  // 「９」「月」のように別要素の場合
  for (
    let i = 0;
    i < items.length;
    i++
  ) {
    const numberItem =
      items[i];

    const normalizedNumber =
      normalizeDigits(
        numberItem.text
      ).trim();

    if (
      !/^\d{1,2}$/.test(
        normalizedNumber
      )
    ) {
      continue;
    }

    const month =
      Number(
        normalizedNumber
      );

    if (
      month < 1 ||
      month > 12
    ) {
      continue;
    }

    const monthTextItem =
      items.find(
        (candidate) =>
          candidate !==
            numberItem &&
          candidate.text ===
            "月" &&
          Math.abs(
            candidate.y -
              numberItem.y
          ) <= 2 &&
          candidate.x >
            numberItem.x &&
          candidate.x -
            numberItem.x <
            50
      );

    if (!monthTextItem) {
      continue;
    }

    candidates.push({
      month,
      x:
        numberItem.x,
      y:
        (
          numberItem.y +
          monthTextItem.y
        ) / 2,
    });
  }

  if (
    candidates.length === 0
  ) {
    return [];
  }

  // 同じ高さに並ぶ月候補をグループ化する。
  const rowGroups = [];

  for (
    const candidate of
    candidates
  ) {
    let group =
      rowGroups.find(
        (row) =>
          Math.abs(
            row.y -
              candidate.y
          ) <= 3
      );

    if (!group) {
      group = {
        y:
          candidate.y,
        items: [],
      };

      rowGroups.push(
        group
      );
    }

    group.items.push(
      candidate
    );

    group.y =
      group.items.reduce(
        (sum, item) =>
          sum + item.y,
        0
      ) /
      group.items.length;
  }

  // 月見出しは通常、同じ高さに複数列並ぶ。
  // 候補数が最大の行を採用し、
  // 同数ならページ上側の行を優先する。
  const bestGroup =
    rowGroups
      .filter(
        (group) =>
          group.items.length >= 2
      )
      .sort(
        (a, b) =>
          b.items.length -
            a.items.length ||
          b.y - a.y
      )[0];

  if (!bestGroup) {
    return [];
  }

  const unique = [];

  for (
    const header of
    bestGroup.items.sort(
      (a, b) =>
        a.x - b.x
    )
  ) {
    const duplicate =
      unique.some(
        (existing) =>
          existing.month ===
            header.month &&
          Math.abs(
            existing.x -
              header.x
          ) < 10
      );

    if (!duplicate) {
      unique.push(
        header
      );
    }
  }

  return unique;
}

function buildColumnBoundaries(
  headers,
  pageWidth
) {
  const sorted =
    [...headers].sort(
      (a, b) =>
        a.x - b.x
    );

  return sorted.map(
    (
      header,
      index
    ) => {
      const previous =
        sorted[
          index - 1
        ];

      const next =
        sorted[
          index + 1
        ];

      const left =
        previous
          ? (
              previous.x +
              header.x
            ) / 2
          : 0;

      const right =
        next
          ? (
              header.x +
              next.x
            ) / 2
          : pageWidth;

      return {
        ...header,
        left,
        right,
      };
    }
  );
}

function groupItemsIntoRows(
  items,
  tolerance = 3.5
) {
  const rows = [];

  const sorted =
    [...items].sort(
      (a, b) =>
        b.y - a.y ||
        a.x - b.x
    );

  for (const item of sorted) {
    let row =
      rows.find(
        (candidate) =>
          Math.abs(
            candidate.y -
              item.y
          ) <= tolerance
      );

    if (!row) {
      row = {
        y:
          item.y,
        items: [],
      };

      rows.push(row);
    }

    row.items.push(
      item
    );

    row.y =
      row.items.reduce(
        (
          sum,
          current
        ) =>
          sum +
          current.y,
        0
      ) /
      row.items.length;
  }

  return rows
    .sort(
      (a, b) =>
        b.y - a.y
    )
    .map(
      (row) =>
        row.items
          .sort(
            (a, b) =>
              a.x - b.x
          )
          .map(
            (item) =>
              item.text
          )
          .join(" ")
          .trim()
    )
    .filter(Boolean);
}

function buildDayAnchoredBlocks(
  items,
  column
) {
  const weekdaySet =
    new Set([
      "日",
      "月",
      "火",
      "水",
      "木",
      "金",
      "土",
    ]);

  const anchors =
    items
      .filter(
        (item) => {
          const normalized =
            normalizeDigits(
              item.text
            ).trim();

          if (
            !/^\d{1,2}$/.test(
              normalized
            )
          ) {
            return false;
          }

          const day =
            Number(
              normalized
            );

          if (
            day < 1 ||
            day > 31
          ) {
            return false;
          }

          return (
            item.x >=
              column.left &&
            item.x <
              column.x - 15 &&
            column.x -
              item.x <
              110
          );
        }
      )
      .map(
        (item) => ({
          item,
          day:
            Number(
              normalizeDigits(
                item.text
              ).trim()
            ),
          x:
            item.x,
          y:
            item.y,
        })
      )
      .sort(
        (a, b) =>
          b.y - a.y
      );

  if (
    anchors.length === 0
  ) {
    return [];
  }

  const anchorItems =
    new Set(
      anchors.map(
        (anchor) =>
          anchor.item
      )
    );

  const blocks = [];

  for (
    let index = 0;
    index <
      anchors.length;
    index++
  ) {
    const anchor =
      anchors[index];

    const previous =
      anchors[
        index - 1
      ];

    const next =
      anchors[
        index + 1
      ];

    const upper =
      previous
        ? (
            previous.y +
            anchor.y
          ) / 2
        : Infinity;

    const lower =
      next
        ? (
            anchor.y +
            next.y
          ) / 2
        : previous
          ? anchor.y -
            (
              previous.y -
              anchor.y
            ) / 2
          : anchor.y - 12;

    const bandItems =
      items.filter(
        (item) =>
          item.y <
            upper &&
          item.y >=
            lower
      );

    const weekdayItem =
      bandItems
        .filter(
          (item) =>
            weekdaySet.has(
              item.text
            ) &&
            item.x >
              anchor.x &&
            item.x <
              column.x &&
            Math.abs(
              item.y -
                anchor.y
            ) <= 5
        )
        .sort(
          (a, b) =>
            Math.abs(
              a.y -
                anchor.y
            ) -
            Math.abs(
              b.y -
                anchor.y
            )
        )[0] ||
      null;

    const contentItems =
      bandItems.filter(
        (item) =>
          !anchorItems.has(
            item
          ) &&
          item !==
            weekdayItem
      );

    const contentRows =
      groupItemsIntoRows(
        contentItems
      );

    blocks.push({
      day:
        anchor.day,
      weekday:
        weekdayItem
          ? weekdayItem.text
          : null,
      lines:
        contentRows,
    });
  }

  return blocks;
}

function buildDayAnchoredRows(
  items,
  column
) {
  const blocks =
    buildDayAnchoredBlocks(
      items,
      column
    );

  const rows = [];

  for (
    const block of blocks
  ) {
    const prefix =
      block.weekday
        ? `${block.day} ${block.weekday}`
        : `${block.day}`;

    if (
      block.lines.length >
      0
    ) {
      rows.push(
        `${prefix} ${block.lines[0]}`.trim()
      );

      rows.push(
        ...block.lines.slice(
          1
        )
      );
    } else {
      rows.push(
        prefix
      );
    }
  }

  return rows;
}

function buildPageHeaderText(
  page,
  headers
) {
  if (
    !Array.isArray(headers) ||
    headers.length === 0
  ) {
    return null;
  }

  const headerY =
    Math.max(
      ...headers.map(
        (header) =>
          header.y
      )
    );

  const headerItems =
    page.items.filter(
      (item) =>
        item.y >
          headerY + 2
    );

  if (
    headerItems.length === 0
  ) {
    return null;
  }

  const rows =
    groupItemsIntoRows(
      headerItems,
      4
    );

  if (
    rows.length === 0
  ) {
    return null;
  }

  return [
    "【資料ヘッダー】",
    ...rows,
  ].join("\n");
}

function buildMonthDayBlocks(
  layout
) {
  const blocks = [];

  for (
    const page of
    layout.pages
  ) {
    const headers =
      detectMonthHeaders(
        page.items,
        page.height
      );

    if (
      headers.length < 2
    ) {
      continue;
    }

    const boundaries =
      buildColumnBoundaries(
        headers,
        page.width
      );

    const headerY =
      Math.max(
        ...headers.map(
          (header) =>
            header.y
        )
      );

    for (
      const column of
      boundaries
    ) {
      const columnItems =
        page.items.filter(
          (item) =>
            item.y <
              headerY - 4 &&
            item.x >=
              column.left &&
            item.x <
              column.right
        );

      const dayBlocks =
        buildDayAnchoredBlocks(
          columnItems,
          column
        );

      for (
        const dayBlock of
        dayBlocks
      ) {
        blocks.push({
          pageNumber:
            page.pageNumber,
          month:
            column.month,
          day:
            dayBlock.day,
          weekday:
            dayBlock.weekday,
          lines:
            dayBlock.lines,
        });
      }
    }
  }

  return blocks;
}

function buildMonthStructuredText(
  layout
) {
  const sections = [];

  for (
    const page of
    layout.pages
  ) {
    const headers =
      detectMonthHeaders(
        page.items,
        page.height
      );

    if (
      headers.length <
      2
    ) {
      continue;
    }

    const pageHeaderText =
      buildPageHeaderText(
        page,
        headers
      );

    if (pageHeaderText) {
      sections.push(
        pageHeaderText
      );
    }

    const boundaries =
      buildColumnBoundaries(
        headers,
        page.width
      );

    const headerY =
      Math.max(
        ...headers.map(
          (header) =>
            header.y
        )
      );

    for (
      const column of
      boundaries
    ) {
      const columnItems =
        page.items.filter(
          (item) =>
            item.y <
              headerY - 4 &&
            item.x >=
              column.left &&
            item.x <
              column.right
        );

      let rows =
        buildDayAnchoredRows(
          columnItems,
          column
        );

      if (
        rows.length === 0
      ) {
        rows =
          groupItemsIntoRows(
            columnItems
          );
      }

      if (
        rows.length === 0
      ) {
        continue;
      }

      sections.push(
        [
          `【${column.month}月】`,
          ...rows,
        ].join("\n")
      );
    }
  }

  if (
    sections.length === 0
  ) {
    return null;
  }

  return sections.join(
    "\n\n"
  );
}

async function extractPdfLayoutText(
  buffer
) {
  const pdfjsLib =
    await import(
      "pdfjs-dist/legacy/build/pdf.mjs"
    );

  const data =
    new Uint8Array(
      buffer
    );

  const pdf =
    await pdfjsLib.getDocument({
      data,
    }).promise;

  const pages = [];

  for (
    let pageNumber = 1;
    pageNumber <=
      pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(
        pageNumber
      );

    const viewport =
      page.getViewport({
        scale: 1,
      });

    const textContent =
      await page.getTextContent();

    const items =
      textContent.items
        .filter(
          (item) =>
            item.str &&
            item.str.trim()
        )
        .map(
          (item) => ({
            text:
              item.str.trim(),
            x:
              Number(
                item.transform[4]
              ),
            y:
              Number(
                item.transform[5]
              ),
            width:
              Number(
                item.width || 0
              ),
          })
        );

    pages.push({
      pageNumber,
      width:
        viewport.width,
      height:
        viewport.height,
      items,
    });
  }

  return {
    pageCount:
      pdf.numPages,
    pages,
  };
}

module.exports = {
  extractPdfLayoutText,
  buildMonthStructuredText,
  buildMonthDayBlocks,
  detectMonthHeaders,
};
