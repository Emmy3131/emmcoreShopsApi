const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const authController = require("../controllers/authController");



router.use(authController.protect);

router.use(authController.restrictTo("admin"));

router.get("/summary", reportController.getReportSummary);

router.get("/sales", reportController.getSalesReport);

router.get("/top-products", reportController.getTopProducts);

router.get("/orders", reportController.getOrderStatusReport);

router.get("/download", reportController.downloadReport);

module.exports = router;
