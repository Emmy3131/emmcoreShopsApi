const express = require("express");
const router = express.Router();
const statsController = require("../controllers/statsController");
const authController = require('../controllers/authController')

router.get("/dashboard-stats", statsController.getStats);

router.get(
  "/sales-overview",
  authController.protect,
  statsController.getSalesOverview
);

module.exports = router;