const Product = require("../models/ProductsModel");
const ApiFeatures = require("../utils/ApiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

const { uploadImage, deleteImage } = require("../services/cloudinarServices");

/*
=====================================================
CLOUDINARY CLEANUP HELPER
=====================================================
*/

const safelyDeleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  try {
    await deleteImage(publicId);
  } catch (error) {
    // Do not fail a successful database operation because
    // Cloudinary cleanup failed. Log it for later cleanup.
    console.error("Cloudinary image cleanup failed:", error.message);
  }
};

/*
=====================================================
PRODUCT FIELDS ALLOWED FOR UPDATES
=====================================================
*/

const editableFields = [
  "name",
  "description",
  "price",
  "oldPrice",
  "category",
  "stock",
  "isTrending",
  "isFlashSale",
  "flashSalePrice",
  "flashSaleEndAt",
  "isFeatured",
  "featured",
  "isActive",
  "active",
];

/*
=====================================================
GET ALL PRODUCTS
=====================================================
*/

exports.getProducts = catchAsync(async (req, res) => {
  const features = new ApiFeatures(
    Product.find().populate("category"),
    req.query,
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const products = await features.query;

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
GET SINGLE PRODUCT
=====================================================
*/

exports.getProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id).populate("category");

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: product,
  });
});

/*
=====================================================
CREATE PRODUCT
=====================================================
*/

exports.createProduct = catchAsync(async (req, res, next) => {
  let uploadedImage = null;

  try {
    let image = req.body.image;
    let imagePublicId = "";

    // New uploads come from multer as req.file.
    if (req.file) {
      uploadedImage = await uploadImage(req.file.buffer);

      image = uploadedImage.image;
      imagePublicId = uploadedImage.imagePublicId;
    }

    // Keep accepting existing image URLs or Base64 images
    // for compatibility with your previous frontend.
    if (!image) {
      return next(new AppError("Product image is required", 400));
    }

    const product = await Product.create({
      image,
      imagePublicId,

      name: req.body.name,
      description: req.body.description,
      price: req.body.price,
      oldPrice: req.body.oldPrice,
      category: req.body.category,
      stock: req.body.stock,

      isTrending: req.body.isTrending,
      isFlashSale: req.body.isFlashSale,
      isFeatured: req.body.isFeatured,
      featured: req.body.featured,

      flashSalePrice: req.body.flashSalePrice,
      flashSaleEndAt: req.body.flashSaleEndAt,
    });

    res.status(201).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    // Remove a newly uploaded image if product creation fails.
    if (uploadedImage?.imagePublicId) {
      await safelyDeleteCloudinaryImage(uploadedImage.imagePublicId);
    }

    throw error;
  }
});

/*
=====================================================
UPDATE PRODUCT
=====================================================
*/

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  let uploadedImage = null;
  const previousPublicId = product.imagePublicId;

  try {
    // Update only the permitted product fields.
    for (const field of editableFields) {
      if (req.body[field] !== undefined) {
        product.set(field, req.body[field]);
      }
    }

    if (req.file) {
      // Upload the replacement before changing the database.
      uploadedImage = await uploadImage(req.file.buffer);

      product.image = uploadedImage.image;
      product.imagePublicId = uploadedImage.imagePublicId;
    } else if (typeof req.body.image === "string" && req.body.image.trim()) {
      // Backward compatibility with the old frontend.
      // Do not accept imagePublicId directly from the client.
      product.image = req.body.image.trim();
      product.imagePublicId = "";
    }

    await product.save();

    // Delete the old asset only after the database save succeeds.
    if (previousPublicId && previousPublicId !== product.imagePublicId) {
      await safelyDeleteCloudinaryImage(previousPublicId);
    }

    await product.populate("category");

    res.status(200).json({
      status: "success",
      data: product,
    });
  } catch (error) {
    // If saving fails after a replacement upload, clean up
    // the new asset and preserve the old image in Cloudinary.
    if (uploadedImage?.imagePublicId) {
      await safelyDeleteCloudinaryImage(uploadedImage.imagePublicId);
    }

    throw error;
  }
});

/*
=====================================================
DELETE PRODUCT
=====================================================
*/

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  // Delete the database record first.
  await product.deleteOne();

  // Clean up its Cloudinary asset if it has one.
  // Legacy Base64 images have no Cloudinary public ID.
  await safelyDeleteCloudinaryImage(product.imagePublicId);

  res.status(200).json({
    status: "success",
    message: "Product deleted successfully",
  });
});

/*
=====================================================
PRODUCTS BY CATEGORY
=====================================================
*/

exports.getProductsByCategory = catchAsync(async (req, res) => {
  const products = await Product.find({
    category: req.params.id,
  }).populate("category");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
TRENDING PRODUCTS
=====================================================
*/

exports.getTrendingProducts = catchAsync(async (req, res) => {
  const products = await Product.find({
    isTrending: true,
  }).populate("category");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
FLASH SALE PRODUCTS
=====================================================
*/

exports.getFlashSaleProducts = catchAsync(async (req, res) => {
  const now = new Date();

  const products = await Product.find({
    isFlashSale: true,
    flashSaleEndAt: { $gt: now },
    flashSalePrice: { $gt: 0 },
  }).populate("category");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
NEW ARRIVALS
=====================================================
*/

exports.getNewArrivals = catchAsync(async (req, res) => {
  const products = await Product.find()
    .sort({ createdAt: -1 })
    .limit(8)
    .populate("category");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
SEARCH PRODUCTS
=====================================================
*/

exports.searchProducts = catchAsync(async (req, res) => {
  const keyword = req.query.keyword || "";

  const products = await Product.find({
    name: {
      $regex: keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    },
  }).populate("category");

  res.status(200).json({
    status: "success",
    results: products.length,
    data: products,
  });
});

/*
=====================================================
RELATED PRODUCTS
=====================================================
*/

exports.getRelatedProducts = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  const related = await Product.find({
    category: product.category,
    _id: { $ne: product._id },
  })
    .limit(8)
    .populate("category");

  res.status(200).json({
    status: "success",
    data: related,
  });
});

/*
=====================================================
ADMIN PRODUCT STATISTICS
=====================================================
*/

exports.productStats = catchAsync(async (req, res) => {
  const total = await Product.countDocuments();
  const trending = await Product.countDocuments({
    isTrending: true,
  });
  const flashSale = await Product.countDocuments({
    isFlashSale: true,
  });

  const stock = await Product.aggregate([
    {
      $group: {
        _id: null,
        totalStock: { $sum: "$stock" },
      },
    },
  ]);

  res.status(200).json({
    status: "success",
    data: {
      total,
      trending,
      flashSale,
      totalStock: stock[0]?.totalStock || 0,
    },
  });
});

/*
=====================================================
TOGGLE TRENDING
=====================================================
*/

exports.toggleTrending = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  product.isTrending = !product.isTrending;
  await product.save();

  res.status(200).json({
    status: "success",
    data: product,
  });
});

/*
=====================================================
TOGGLE FLASH SALE
=====================================================
*/

exports.toggleFlashSale = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  product.isFlashSale = !product.isFlashSale;
  await product.save();

  res.status(200).json({
    status: "success",
    data: product,
  });
});

/*
=====================================================
TOGGLE ACTIVE
=====================================================
*/

exports.toggleActive = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  product.active = !product.active;
  await product.save();

  res.status(200).json({
    status: "success",
    data: product,
  });
});

/*
=====================================================
TOGGLE FEATURED
=====================================================
*/

exports.toggleFeatured = catchAsync(async (req, res, next) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  product.isFeatured = !product.isFeatured;
  await product.save();

  res.status(200).json({
    status: "success",
    data: product,
  });
});
