const Wishlist = require("../models/WishListModel");
const Product = require("../models/ProductsModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/* =====================================================
   GET MY WISHLIST
===================================================== */

exports.getMyWishlist = catchAsync(
  async (req, res, next) => {
    const wishlist = await Wishlist.findOne({
      user: req.user._id,
    }).populate({
      path: "products",
      populate: {
        path: "category",
      },
    });

    if (!wishlist) {
      return res.status(200).json({
        status: "success",
        results: 0,
        data: [],
      });
    }

    res.status(200).json({
      status: "success",
      results: wishlist.products.length,
      data: wishlist.products,
    });
  },
);

/* =====================================================
   ADD PRODUCT TO WISHLIST
===================================================== */

exports.addToWishlist = catchAsync(
  async (req, res, next) => {
    const { productId } = req.body;

    if (!productId) {
      return next(
        new AppError(
          "Product ID is required",
          400,
        ),
      );
    }

    const product = await Product.findById(
      productId,
    );

    if (!product) {
      return next(
        new AppError(
          "Product not found",
          404,
        ),
      );
    }

    let wishlist = await Wishlist.findOne({
      user: req.user._id,
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user._id,
        products: [productId],
      });
    } else {
      const alreadyExists =
        wishlist.products.some(
          (id) =>
            id.toString() ===
            productId.toString(),
        );

      if (alreadyExists) {
        return res.status(200).json({
          status: "success",
          message:
            "Product is already in your wishlist",
          data: wishlist,
        });
      }

      wishlist.products.push(productId);

      await wishlist.save();
    }

    res.status(201).json({
      status: "success",
      message:
        "Product added to wishlist",
      data: wishlist,
    });
  },
);

/* =====================================================
   REMOVE PRODUCT FROM WISHLIST
===================================================== */

exports.removeFromWishlist = catchAsync(
  async (req, res, next) => {
    const { productId } = req.params;

    const wishlist =
      await Wishlist.findOne({
        user: req.user._id,
      });

    if (!wishlist) {
      return next(
        new AppError(
          "Wishlist not found",
          404,
        ),
      );
    }

    wishlist.products =
      wishlist.products.filter(
        (id) =>
          id.toString() !==
          productId.toString(),
      );

    await wishlist.save();

    res.status(200).json({
      status: "success",
      message:
        "Product removed from wishlist",
      data: wishlist,
    });
  },
);

/* =====================================================
   TOGGLE WISHLIST
===================================================== */

exports.toggleWishlist = catchAsync(
  async (req, res, next) => {
    const { productId } = req.body;

    const product = await Product.findById(
      productId,
    );

    if (!product) {
      return next(
        new AppError(
          "Product not found",
          404,
        ),
      );
    }

    let wishlist =
      await Wishlist.findOne({
        user: req.user._id,
      });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        user: req.user._id,
        products: [productId],
      });

      return res.status(200).json({
        status: "success",
        isSaved: true,
        message:
          "Product added to wishlist",
      });
    }

    const productIndex =
      wishlist.products.findIndex(
        (id) =>
          id.toString() ===
          productId.toString(),
      );

    if (productIndex !== -1) {
      wishlist.products.splice(
        productIndex,
        1,
      );

      await wishlist.save();

      return res.status(200).json({
        status: "success",
        isSaved: false,
        message:
          "Product removed from wishlist",
      });
    }

    wishlist.products.push(productId);

    await wishlist.save();

    res.status(200).json({
      status: "success",
      isSaved: true,
      message:
        "Product added to wishlist",
    });
  },
);

/* =====================================================
   CHECK IF PRODUCT IS SAVED
===================================================== */

exports.checkWishlist = catchAsync(
  async (req, res, next) => {
    const { productId } = req.params;

    const wishlist =
      await Wishlist.findOne({
        user: req.user._id,
      });

    const isSaved =
      wishlist?.products.some(
        (id) =>
          id.toString() ===
          productId.toString(),
      ) || false;

    res.status(200).json({
      status: "success",
      isSaved,
    });
  },
);