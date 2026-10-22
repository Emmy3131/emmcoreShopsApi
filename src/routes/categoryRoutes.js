const express = require("express");
const router = express.Router();

const CategoryController = require("../controllers/categoryController");
const authController = require("../controllers/authController");

/*
=====================================================
PUBLIC CATEGORY ROUTES
=====================================================
*/

router.get("/", CategoryController.getAllCategories);
router.get("/:id", CategoryController.getCategoryById);

/*
=====================================================
ADMIN CATEGORY ROUTES
=====================================================
*/

router.use(authController.protect);
router.use(authController.restrictTo("admin"));

router.post("/", CategoryController.createCategory);
router.patch("/:id", CategoryController.updateCategory);
router.delete("/:id", CategoryController.deleteCategory);

module.exports = router;
