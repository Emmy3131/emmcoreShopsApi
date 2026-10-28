const PDFDocument = require("pdfkit");

exports.exportPDF = (rows, filename, res) => {
  const doc = new PDFDocument({
    margin: 40,
    size: "A4",
  });

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.pdf"`
  );

  res.setHeader("Content-Type", "application/pdf");

  doc.pipe(res);

  doc
    .fontSize(22)
    .text("EmmCore Shops", {
      align: "center",
    });

  doc.moveDown();

  doc
    .fontSize(14)
    .text("Sales Report", {
      align: "center",
    });

  doc.moveDown(2);

  rows.forEach((row, index) => {
    doc
      .fontSize(11)
      .text(`${index + 1}.`);

    Object.entries(row).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`);
    });

    doc.moveDown();
  });

  doc.end();
};