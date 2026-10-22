const express = require("express");
const router = express.Router();
const CategoryController = require("../controller/CategoryController");
const authController = require("../controller/authController");

//Protect all routes after this middleware
// router.use(authController.protect);

// CREATE + GET
router
  .route("/")
  .post(CategoryController.createCategory)
  .get(CategoryController.getAllCategories);

// GET + UPDATE + DELETE
router
  .route("/:id")
  .get(CategoryController.getCategoryById)
  .patch(CategoryController.updateCategory)
  .delete(CategoryController.deleteCategory);

module.exports = router;