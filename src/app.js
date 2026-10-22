const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const productRoutes = require("./routes/productsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");

const app = express();

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
}));
app.use(express.json());

// Use the routes
app.use("/api/products", productRoutes);
app.use("/api/categories", categoryRoutes);

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
