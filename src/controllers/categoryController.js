const Category = require("../models/CategoryModel");
const Product = require("../models/ProductsModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

// CREATE CATEGORY
exports.createCategory = catchAsync(async (req, res, next) => {
  const { name, description = "", image = "" } = req.body;

  if (typeof name !== "string" || !name.trim()) {
    return next(new AppError("Category name is required", 400));
  }

  if (typeof description !== "string" || typeof image !== "string") {
    return next(
      new AppError("Description and image must be text values", 400)
    );
  }

  const category = await Category.create({
    name: name.trim(),
    description: description.trim(),
    image: image.trim(),
  });

  res.status(201).json({
    status: "success",
    data: category,
  });
});

// GET ALL CATEGORIES
exports.getAllCategories = catchAsync(async (req, res) => {
  const categories = await Category.find().sort({ name: 1 });

  res.status(200).json({
    status: "success",
    results: categories.length,
    data: categories,
  });
});

// GET CATEGORY BY ID
exports.getCategoryById = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError("Category not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: category,
  });
});

// UPDATE CATEGORY
exports.updateCategory = catchAsync(async (req, res, next) => {
  const { name, description, image } = req.body;

  if (
    name !== undefined &&
    (typeof name !== "string" || !name.trim())
  ) {
    return next(new AppError("Category name cannot be empty", 400));
  }

  if (
    description !== undefined &&
    typeof description !== "string"
  ) {
    return next(new AppError("Description must be text", 400));
  }

  if (image !== undefined && typeof image !== "string") {
    return next(new AppError("Image must be a text value", 400));
  }

  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError("Category not found", 404));
  }

  if (name !== undefined) category.name = name.trim();
  if (description !== undefined) category.description = description.trim();
  if (image !== undefined) category.image = image.trim();

  // Runs schema validation and the category pre-save slug hook.
  await category.save();

  res.status(200).json({
    status: "success",
    data: category,
  });
});

// DELETE CATEGORY
exports.deleteCategory = catchAsync(async (req, res, next) => {
  const category = await Category.findById(req.params.id);

  if (!category) {
    return next(new AppError("Category not found", 404));
  }

  const productsUsingCategory = await Product.countDocuments({
    category: category._id,
  });

  if (productsUsingCategory > 0) {
    return next(
      new AppError(
        "Cannot delete this category while products are assigned to it",
        400
      )
    );
  }

  await category.deleteOne();

  res.status(204).send();
});
