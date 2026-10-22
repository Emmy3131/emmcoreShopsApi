
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "EmmCoreShops API is running",
  });
});

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to EmmCoreShops API",
    health: "/api/health",
  });
});

module.exports = app;
