const Product = require("../model/ProductModel");

const ApiFeatures = require("../utils/ApiFeatures");

const catchAsync = require("../utils/catchAsync");

const AppError = require("../utils/appError");

/*
=====================================================
GET ALL PRODUCTS
=====================================================
*/

exports.getProducts = catchAsync(async (req, res, next) => {
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
  const product = await Product.create({
    image: req.body.image,

    name: req.body.name,

    description: req.body.description,

    price: req.body.price,

    category: req.body.category,

    stock: req.body.stock,

    isTrending: req.body.isTrending || false,

    isFlashSale: req.body.isFlashSale || false,

    flashSalePrice: req.body.flashSalePrice,

    flashSaleEndAt: req.body.flashSaleEndAt,

    oldPrice: req.body.oldPrice,
  });

  res.status(201).json({
    status: "success",

    data: product,
  });
});

/*
=====================================================
UPDATE PRODUCT
=====================================================
*/

exports.updateProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id,

    req.body,

    {
      new: true,

      runValidators: true,
    },
  ).populate("category");

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
DELETE PRODUCT
=====================================================
*/

exports.deleteProduct = catchAsync(async (req, res, next) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  res.status(200).json({
    status: "success",

    message: "Product deleted successfully",
  });
});

/*
=====================================================
PRODUCT BY CATEGORY
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

  console.log("CURRENT SERVER DATE:", now);

  const allFlashSaleProducts = await Product.find({
    isFlashSale: true,
  });

  console.log(
    "ALL FLASH SALE PRODUCTS:",
    allFlashSaleProducts.map((product) => ({
      name: product.name,
      isFlashSale: product.isFlashSale,
      flashSalePrice: product.flashSalePrice,
      flashSaleEndAt: product.flashSaleEndAt,
    }))
  );

  const products = await Product.find({
    isFlashSale: true,
    flashSaleEndAt: {
      $gt: now,
    },
    flashSalePrice: {
      $exists: true,
      $gt: 0,
    },
  });

  console.log("MATCHED FLASH SALE PRODUCTS:", products.length);

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

    .sort({
      createdAt: -1,
    })

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
      $regex: keyword,
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

    _id: {
      $ne: product._id,
    },
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

        totalStock: {
          $sum: "$stock",
        },
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
