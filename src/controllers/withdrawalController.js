const Withdrawal = require("../models/WithdrawalModel");
const BankAccount = require("../models/BankDetailsModel");
const User = require("../models/UserModel");
const WalletTransaction = require("../models/WalletTransactionModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/*
=====================================================
MINIMUM WITHDRAWAL
=====================================================
*/

const MINIMUM_WITHDRAWAL = 5000;

/*
=====================================================
GET SAVED BANK ACCOUNT
=====================================================
*/

exports.getMyBankAccount = catchAsync(async (req, res, next) => {
  const account = await BankAccount.findOne({
    user: req.user._id,
  });

  res.status(200).json({
    status: "success",
    data: account,
  });
});

/*
=====================================================
SAVE / UPDATE BANK ACCOUNT
=====================================================
*/

exports.saveBankAccount = catchAsync(async (req, res, next) => {
  const { bankName, accountName, accountNumber } = req.body;

  if (!bankName || !accountName || !accountNumber) {
    return next(
      new AppError(
        "Bank name, account name and account number are required",
        400,
      ),
    );
  }

  if (!/^\d{10}$/.test(accountNumber)) {
    return next(
      new AppError("Account number must contain exactly 10 digits", 400),
    );
  }

  const account = await BankAccount.findOneAndUpdate(
    {
      user: req.user._id,
    },
    {
      user: req.user._id,
      bankName,
      accountName,
      accountNumber,
      isVerified: false,
    },
    {
      new: true,
      upsert: true,
      runValidators: true,
    },
  );

  res.status(200).json({
    status: "success",
    message: "Bank account saved successfully",
    data: account,
  });
});

/*
=====================================================
REQUEST WITHDRAWAL
=====================================================
*/

exports.requestWithdrawal = catchAsync(async (req, res, next) => {
  const amount = Number(req.body.amount);

  /*
    =================================================
    VALIDATE AMOUNT
    =================================================
    */

  if (!amount || amount <= 0) {
    return next(new AppError("Please enter a valid withdrawal amount", 400));
  }

  if (amount < MINIMUM_WITHDRAWAL) {
    return next(
      new AppError(
        `Minimum withdrawal is ₦${MINIMUM_WITHDRAWAL.toLocaleString()}`,
        400,
      ),
    );
  }

  /*
    =================================================
    GET USER
    =================================================
    */

  const user = await User.findById(req.user._id).select("_id walletBalance");

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  const walletBalance = user.walletBalance || 0;

  /*
    =================================================
    CHECK BALANCE
    =================================================
    */

  if (amount > walletBalance) {
    return next(new AppError("Insufficient wallet balance", 400));
  }

  /*
    =================================================
    CHECK EXISTING PENDING WITHDRAWAL
    =================================================
    */

  const existingWithdrawal = await Withdrawal.findOne({
    user: user._id,
    status: "pending",
  });

  if (existingWithdrawal) {
    return next(
      new AppError("You already have a pending withdrawal request", 400),
    );
  }

  /*
    =================================================
    GET BANK ACCOUNT
    =================================================
    */

  const bankAccount = await BankAccount.findOne({
    user: user._id,
  });

  if (!bankAccount) {
    return next(
      new AppError("Please add your withdrawal bank account first", 400),
    );
  }

  /*
    =================================================
    CREATE WITHDRAWAL
    =================================================

    IMPORTANT:
    Wallet is NOT deducted here.

    The balance remains available until
    admin approves the withdrawal.
    */

  const withdrawal = await Withdrawal.create({
    user: user._id,

    amount,

    bankDetails: {
      bankName: bankAccount.bankName,
      accountName: bankAccount.accountName,
      accountNumber: bankAccount.accountNumber,
    },

    status: "pending",
  });

  res.status(201).json({
    status: "success",

    message: "Withdrawal request submitted successfully",

    data: withdrawal,
  });
});

/*
=====================================================
GET MY WITHDRAWALS
=====================================================
*/

exports.getMyWithdrawals = catchAsync(async (req, res, next) => {
  const withdrawals = await Withdrawal.find({
    user: req.user._id,
  }).sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: withdrawals.length,

    data: withdrawals,
  });
});

/*
=====================================================
GET SINGLE WITHDRAWAL
=====================================================
*/

exports.getWithdrawal = catchAsync(async (req, res, next) => {
  const withdrawal = await Withdrawal.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!withdrawal) {
    return next(new AppError("Withdrawal not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: withdrawal,
  });
});

/*
=====================================================
ADMIN:
GET ALL WITHDRAWALS
=====================================================
*/

exports.getAllWithdrawals = catchAsync(async (req, res, next) => {
  const withdrawals = await Withdrawal.find()
    .populate("user", "firstName lastName email phone walletBalance")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: withdrawals.length,

    data: withdrawals,
  });
});

/*
=====================================================
ADMIN:
UPDATE WITHDRAWAL
=====================================================

Allowed statuses:

approved
rejected
paid

Important wallet logic:

PENDING
   ↓
APPROVED
   ↓
wallet deducted

REJECTED
   ↓
wallet untouched

PAID
   ↓
payment completed

The wallet is deducted ONLY once.
=====================================================
*/

exports.updateWithdrawal = catchAsync(async (req, res, next) => {
  const { status, adminNote } = req.body;

  /*
    =================================================
    VALIDATE STATUS
    =================================================
    */

  const allowedStatuses = ["approved", "rejected", "paid"];

  if (!allowedStatuses.includes(status)) {
    return next(new AppError("Invalid withdrawal status", 400));
  }

  /*
    =================================================
    GET WITHDRAWAL
    =================================================
    */

  const withdrawal = await Withdrawal.findById(req.params.id);

  if (!withdrawal) {
    return next(new AppError("Withdrawal not found", 404));
  }

  /*
    =================================================
    PREVENT DUPLICATE PROCESSING
    =================================================
    */

  if (withdrawal.status === "rejected") {
    return next(new AppError("This withdrawal has already been rejected", 400));
  }

  if (withdrawal.status === "paid") {
    return next(new AppError("This withdrawal has already been paid", 400));
  }

  /*
    =================================================
    REJECT WITHDRAWAL
    =================================================

    Wallet remains untouched.
    */

  if (status === "rejected") {
    withdrawal.status = "rejected";

    withdrawal.adminNote = adminNote || "";

    withdrawal.processedAt = Date.now();

    await withdrawal.save();

    return res.status(200).json({
      status: "success",

      message: "Withdrawal rejected successfully",

      data: withdrawal,
    });
  }

  /*
    =================================================
    APPROVE WITHDRAWAL
    =================================================
    */

  if (status === "approved") {
    const user = await User.findById(withdrawal.user).select(
      "_id walletBalance",
    );

    if (!user) {
      return next(new AppError("Withdrawal user not found", 404));
    }

    const currentBalance = user.walletBalance || 0;

    /*
      ===============================================
      CHECK BALANCE AGAIN
      ===============================================

      This is important because the user could
      potentially spend the wallet after submitting
      the withdrawal request.
      */

    if (withdrawal.amount > currentBalance) {
      return next(
        new AppError("User no longer has enough wallet balance", 400),
      );
    }

    const balanceBefore = currentBalance;

    const balanceAfter = currentBalance - withdrawal.amount;

    /*
      ===============================================
      DEDUCT WALLET
      ===============================================
      */

    user.walletBalance = balanceAfter;

    await user.save();

    /*
      ===============================================
      CREATE WALLET TRANSACTION
      ===============================================
      */

    await WalletTransaction.create({
      user: user._id,

      type: "debit",

      source: "withdrawal",

      title: "Withdrawal",

      amount: withdrawal.amount,

      balanceBefore,

      balanceAfter,

      reference: `WD-${withdrawal._id}`,

      status: "completed",
    });

    /*
      ===============================================
      UPDATE WITHDRAWAL
      ===============================================
      */

    withdrawal.status = "approved";

    withdrawal.adminNote = adminNote || "";

    withdrawal.processedAt = Date.now();

    await withdrawal.save();

    return res.status(200).json({
      status: "success",

      message: "Withdrawal approved and wallet deducted successfully",

      data: withdrawal,
    });
  }

  /*
    =================================================
    MARK AS PAID
    =================================================

    Admin should use this AFTER the actual bank
    transfer has been made.

    Wallet has already been deducted when approved.
    */

  if (status === "paid") {
    if (withdrawal.status !== "approved") {
      return next(
        new AppError("Only approved withdrawals can be marked as paid", 400),
      );
    }

    withdrawal.status = "paid";

    withdrawal.adminNote = adminNote || withdrawal.adminNote || "";

    withdrawal.processedAt = Date.now();

    await withdrawal.save();

    return res.status(200).json({
      status: "success",

      message: "Withdrawal marked as paid",

      data: withdrawal,
    });
  }
});
