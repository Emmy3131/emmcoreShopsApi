const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  })
);

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EmmCoreShops API is running",
  });
});

module.exports = app;