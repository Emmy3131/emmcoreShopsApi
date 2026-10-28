const ExcelJS = require("exceljs");

exports.exportExcel = async (rows, filename, res) => {
  const workbook = new ExcelJS.Workbook();

  workbook.creator = "EmmCore Shops";

  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Report");

  if (rows.length > 0) {
    sheet.columns = Object.keys(rows[0]).map((key) => ({
      header: key,
      key,
      width: 25,
    }));

    sheet.addRows(rows);

    sheet.getRow(1).font = {
      bold: true,
    };

    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb: "FFD9EAD3",
      },
    };
  }

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.xlsx"`
  );

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  await workbook.xlsx.write(res);

  res.end();
};