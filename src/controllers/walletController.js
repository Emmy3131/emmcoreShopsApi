const WalletTransaction = require("../models/WalletTransactionModel");

const catchAsync = require("../utils/catchAsync");

exports.getWallet = catchAsync(async (req, res, next) => {
  const transactions = await WalletTransaction.find({
    user: req.user._id,
  }).sort("-createdAt");

  res.status(200).json({
    status: "success",

    data: {
      balance: req.user.walletBalance || 0,

      transactions,
    },
  });
});
