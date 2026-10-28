const Referral = require("../models/RefferalModel");
const User = require("../models/UserModel");
const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/*
=====================================================
GET MY REFERRAL DASHBOARD
=====================================================
*/

exports.getMyReferralDashboard = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  const user = await User.findById(userId).select(
    "firstName lastName referralCode",
  );

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const referrals = await Referral.find({
    referrer: userId,
  })
    .populate("referredUser", "firstName lastName email")
    .sort("-createdAt");

  const totalReferrals = referrals.length;

  const successfulReferrals = referrals.filter(
    (ref) => ref.status === "rewarded",
  ).length;

  const pendingReferrals = referrals.filter(
    (ref) => ref.status === "pending",
  ).length;

  const totalBonus = referrals
    .filter((ref) => ref.status === "rewarded")
    .reduce((sum, ref) => sum + ref.rewardAmount, 0);

  res.status(200).json({
    status: "success",

    data: {
      referralCode: user.referralCode,

      referralLink: `${process.env.FRONTEND_URL}/signup?ref=${user.referralCode}`,

      totalReferrals,

      successfulReferrals,

      pendingReferrals,

      totalBonus,

      referrals,
    },
  });
});

/*
=====================================================
GET REFERRAL HISTORY
=====================================================
*/

exports.getReferralHistory = catchAsync(async (req, res, next) => {
  const referrals = await Referral.find({
    referrer: req.user._id,
  })
    .populate("referredUser", "firstName lastName email")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: referrals.length,

    data: referrals,
  });
});

/*
=====================================================
ADMIN GET ALL REFERRALS
=====================================================
*/

exports.getAllReferrals = catchAsync(async (req, res, next) => {
  const referrals = await Referral.find()

    .populate("referrer", "firstName lastName email")

    .populate("referredUser", "firstName lastName email")

    .sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: referrals.length,

    data: referrals,
  });
});
