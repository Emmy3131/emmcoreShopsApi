
const express = require("express");
const router = express.Router();

const productController = require("../controllers/productsConttroller");
const authController = require("../controllers/authController");

/*
=====================================================
PUBLIC PRODUCT ROUTES
=====================================================
*/

router.get("/", productController.getProducts);
router.get("/search", productController.searchProducts);
router.get("/new-arrivals", productController.getNewArrivals);
router.get("/trending", productController.getTrendingProducts);
router.get("/flash-sale", productController.getFlashSaleProducts);
router.get("/category/:id", productController.getProductsByCategory);
router.get("/related/:id", productController.getRelatedProducts);
router.get("/:id", productController.getProduct);

/*
=====================================================
ADMIN ROUTES
All routes below require admin authentication.
=====================================================
*/

router.use(authController.protect);
router.use(authController.restrictTo("admin"));

// Admin statistics
router.get("/admin/stats", productController.productStats);

// Create, update and delete products
router.post("/", productController.createProduct);
router.patch("/:id", productController.updateProduct);
router.delete("/:id", productController.deleteProduct);

// Product actions
router.patch("/:id/toggle-active", productController.toggleActive);
router.patch("/:id/toggle-featured", productController.toggleFeatured);
router.patch("/:id/toggle-trending", productController.toggleTrending);
router.patch("/:id/toggle-flash-sale", productController.toggleFlashSale);

module.exports = router;
