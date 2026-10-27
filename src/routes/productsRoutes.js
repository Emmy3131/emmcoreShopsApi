const express = require("express");
const router = express.Router();

const productController = require("../controllers/productsConttroller");
const authController = require("../controllers/authController");
const upload = require("../middlewares/uploadMiddlewares");

/*
=====================================================
PUBLIC PRODUCT ROUTES
These routes do not require authentication.
=====================================================
*/

// Get all products
router.get("/", productController.getProducts);

// Search products
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

// Get a single product by ID
// Keep this route after the named routes above.
router.get("/:id", productController.getProduct);

/*
=====================================================
ADMIN AUTHENTICATION
All routes below require an authenticated admin.
=====================================================
*/

router.use(authController.protect);
router.use(authController.restrictTo("admin"));

/*
=====================================================
ADMIN STATISTICS
=====================================================
*/

router.get("/admin/stats", productController.productStats);

/*
=====================================================
CREATE PRODUCT
=====================================================
*/

// Accept a multipart/form-data request with an image field.
// Multer provides the uploaded file as req.file.
router.post("/", upload.single("image"), productController.createProduct);

/*
=====================================================
UPDATE PRODUCT
=====================================================
*/

// The image field is optional when updating a product.
// If supplied, the new image is uploaded to Cloudinary.
router.patch("/:id", upload.single("image"), productController.updateProduct);

/*
=====================================================
DELETE PRODUCT
=====================================================
*/

router.delete("/:id", productController.deleteProduct);

/*
=====================================================
PRODUCT ACTIONS
=====================================================
*/

// Toggle product active status
router.patch("/:id/toggle-active", productController.toggleActive);

// Toggle featured status
router.patch("/:id/toggle-featured", productController.toggleFeatured);

// Toggle trending status
router.patch("/:id/toggle-trending", productController.toggleTrending);

// Toggle flash sale status
router.patch("/:id/toggle-flash-sale", productController.toggleFlashSale);

module.exports = router;
