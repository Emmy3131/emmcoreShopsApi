const { Parser } = require("json2csv");

exports.exportCSV = (rows, filename, res) => {
  const parser = new Parser();

  const csv = parser.parse(rows);

  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}.csv"`
  );

  res.setHeader("Content-Type", "text/csv");

  res.status(200).send(csv);
};