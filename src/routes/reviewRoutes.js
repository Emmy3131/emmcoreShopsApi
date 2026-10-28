const express = require("express");

const router = express.Router();

const ReviewController = require("../controllers/reviewController");
const authController = require("../controllers/authController");

// PUBLIC
router.get("/:productId", ReviewController.getProductReviews);

// USER
router.use(authController.protect);

router.post("/:productId", ReviewController.createReview);

router.patch("/:id", ReviewController.updateReview);

// ADMIN
router.use(authController.restrictTo("admin"));

router.get("/", ReviewController.getAllReviews);

router.patch("/:id/approve", ReviewController.approveReview);

router.patch("/:id/reject", ReviewController.rejectReview);

router.delete("/:id", ReviewController.deleteReview);

module.exports = router;
