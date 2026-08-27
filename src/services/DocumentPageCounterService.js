const {
  PDFDocument,
} = require("pdf-lib");

async function countDocumentPages({
  buffer,
  mimeType,
}) {
  if (
    mimeType === "image/png" ||
    mimeType === "image/jpeg"
  ) {
    return 1;
  }

  if (
    mimeType === "application/pdf"
  ) {
    const pdf =
      await PDFDocument.load(
        buffer,
        {
          ignoreEncryption: false,
        }
      );

    return pdf.getPageCount();
  }

  throw new Error(
    "Unsupported document type"
  );
}

module.exports = {
  countDocumentPages,
};
