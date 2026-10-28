const Referral = require("../models/RefferalModel");
const catchAsync = require("../utils/catchAsync");

/*
=====================================================
GET ALL REFERRALS
=====================================================
*/

exports.getAllReferrals = catchAsync(async (req, res, next) => {
  const referrals = await Referral.find()

    .populate("referrer", "firstName lastName email referralCode")

    .populate("referredUser", "firstName lastName email")

    .sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: referrals.length,

    data: referrals,
  });
});
