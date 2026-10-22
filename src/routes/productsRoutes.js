const express = require("express");

const router = express.Router();

const productController = require("../controller/ProductController");

const authController = require("../controller/authController");

/*
=====================================================
PUBLIC PRODUCT ROUTES
=====================================================
*/

// All products
router.get("/", productController.getProducts);


router.get("/admin/stats", productController.productStats);


// Search
router.get("/search", productController.searchProducts);

// New arrivals
router.get("/new-arrivals", productController.getNewArrivals);

// Trending products
router.get("/trending", productController.getTrendingProducts);

// Flash sale products
router.get("/flash-sale", productController.getFlashSaleProducts);

// Products by category
router.get("/category/:id", productController.getProductsByCategory);

// Related products
router.get("/related/:id", productController.getRelatedProducts);

// Single product
router.get("/:id", productController.getProduct);

/*
=====================================================
ADMIN PRODUCT ROUTES
=====================================================
*/

// Protect everything below

router.use(authController.protect);

router.use(authController.restrictTo("admin"));

// Product statistics



// Create product

router.post("/", productController.createProduct);

// Update product

router.patch("/:id", productController.updateProduct);

// Delete product

router.delete("/:id", productController.deleteProduct);

/*
=====================================================
PRODUCT ACTIONS
=====================================================
*/

// Toggle active status

router.patch("/:id/toggle-active", productController.toggleActive);

// Toggle featured

router.patch("/:id/toggle-featured", productController.toggleFeatured);

// Toggle trending

router.patch("/:id/toggle-trending", productController.toggleTrending);

// Toggle flash sale

router.patch("/:id/toggle-flash-sale", productController.toggleFlashSale);

module.exports = router;
