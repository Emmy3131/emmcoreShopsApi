const express = require("express");
const router = express.Router();

const orderController = require("../controllers/orderController");
const authController = require("../controllers/authController");

router.post(
  "/webhook",
  express.raw({ type: "application/json" }), orderController.handlePayStackWebhook,
);

/* ================= VERIFY PAYMENT ================= */
router.get("/verify-payment", orderController.verifyPayment,);

/* ================= CHECKOUT ================= */
router.post(
  "/checkout",
  authController.protect,
  orderController.getCheckoutSession,
);

/* ================= PAYSTACK WEBHOOK ================= */

/* NO AUTH HERE */

/* ================= ORDERS ================= */
router.route("/").get(authController.protect, orderController.getAllOrders);

router.get("/my-orders", authController.protect, orderController.getMyOrders);

router
  .route("/:id")
  .get(authController.protect, orderController.getOrder)
  .delete(authController.protect, orderController.deleteOrder)
  .patch(authController.protect, orderController.updateOrderStatus);

module.exports = router;
