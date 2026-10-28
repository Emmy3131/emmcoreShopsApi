const express = require("express");
const router = express.Router();
const HeroBannerController = require("../controllers/heroBannerController");
const authController = require("../controllers/authController");

/*
================================
PUBLIC HERO BANNER
================================
*/

// Homepage slider
router.get("/", HeroBannerController.getHeroBanner);

/*
================================
ADMIN HERO BANNER
================================
*/

// Get all banners for admin
router.get(
  "/admin",
  authController.protect,
  authController.restrictTo("admin"),
  HeroBannerController.getHeroBanners,
);

// Create banner

router.post(
  "/",
  authController.protect,
  authController.restrictTo("admin"),
  HeroBannerController.createHeroBanner,
);

// Get single banner

router.get(
  "/:id",
  authController.protect,
  authController.restrictTo("admin"),
  HeroBannerController.getSingleHeroBanner,
);

// Update banner

router.patch(
  "/:id",
  authController.protect,
  authController.restrictTo("admin"),
  HeroBannerController.updateHeroBanner,
);

// Delete banner

router.delete(
  "/:id",
  authController.protect,
  authController.restrictTo("admin"),
  HeroBannerController.deleteHeroBanner,
);

module.exports = router;
