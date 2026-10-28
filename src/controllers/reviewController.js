const mongoose = require("mongoose");

const Product = require("../models/ProductsModel");
const Review = require("../models/ReviewModel");

const ApiFeatures = require("../utils/ApiFeatures");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/*
====================================
UPDATE PRODUCT RATINGS
====================================
*/

const updateProductRatings = async (productId) => {
  const stats = await Review.aggregate([
    {
      $match: {
        product: new mongoose.Types.ObjectId(productId),
        status: "approved",
      },
    },
    {
      $group: {
        _id: "$product",
        averageRating: {
          $avg: "$rating",
        },
        totalReviews: {
          $sum: 1,
        },
      },
    },
  ]);

  if (stats.length > 0) {
    await Product.findByIdAndUpdate(productId, {
      ratingsAverage: Number(stats[0].averageRating.toFixed(1)),
      ratingsQuantity: stats[0].totalReviews,
    });
  } else {
    await Product.findByIdAndUpdate(productId, {
      ratingsAverage: 0,
      ratingsQuantity: 0,
    });
  }
};

/*
====================================
CREATE REVIEW
====================================
*/

exports.createReview = catchAsync(async (req, res, next) => {
  const alreadyReviewed = await Review.findOne({
    product: req.params.productId,
    user: req.user.id,
  });

  if (alreadyReviewed) {
    return next(new AppError("You have already reviewed this product.", 400));
  }

  const review = await Review.create({
    product: req.params.productId,
    user: req.user.id,
    rating: req.body.rating,
    comment: req.body.comment,
  });

  await updateProductRatings(req.params.productId);

  res.status(201).json({
    status: "success",
    data: review,
  });
});

/*
====================================
GET PRODUCT REVIEWS
====================================
*/

exports.getProductReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({
    product: req.params.productId,
    status: "approved",
  })
    .populate("user", "firstName lastName image")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: reviews,
  });
});

/*
====================================
GET ALL REVIEWS (ADMIN)
====================================
*/

exports.getAllReviews = catchAsync(async (req, res) => {
  const features = new ApiFeatures(
    Review.find()
      .populate("user", "firstName lastName email")
      .populate("product", "name images"),
    req.query,
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();

  const reviews = await features.query;

  res.status(200).json({
    status: "success",
    results: reviews.length,
    data: reviews,
  });
});

/*
====================================
UPDATE REVIEW
====================================
*/

exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findOne({
    _id: req.params.id,
    user: req.user.id,
  });

  if (!review) {
    return next(new AppError("Review not found.", 404));
  }

  review.rating = req.body.rating || review.rating;

  review.comment = req.body.comment || review.comment;

  review.status = "pending";

  await review.save();

  await updateProductRatings(review.product);

  res.status(200).json({
    status: "success",
    data: review,
  });
});

/*
====================================
APPROVE REVIEW
====================================
*/

exports.approveReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    {
      status: "approved",
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!review) {
    return next(new AppError("Review not found.", 404));
  }

  await updateProductRatings(review.product);

  res.status(200).json({
    status: "success",
    data: review,
  });
});

/*
====================================
REJECT REVIEW
====================================
*/

exports.rejectReview = catchAsync(async (req, res, next) => {
  const review = await Review.findByIdAndUpdate(
    req.params.id,
    {
      status: "rejected",
    },
    {
      new: true,
    },
  );

  if (!review) {
    return next(new AppError("Review not found.", 404));
  }

  await updateProductRatings(review.product);

  res.status(200).json({
    status: "success",
    data: review,
  });
});

/*
====================================
DELETE REVIEW
====================================
*/

exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);

  if (!review) {
    return next(new AppError("Review not found.", 404));
  }

  await Review.findByIdAndDelete(req.params.id);

  await updateProductRatings(review.product);

  res.status(204).json({
    status: "success",
    data: null,
  });
});
