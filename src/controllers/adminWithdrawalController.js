const Withdrawal = require("../models/WithdrawalModel");
const User = require("../models/UserModel");
const WalletTransaction = require("../models/WalletTransactionModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const Email = require("../utils/email");

/*
=====================================================
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
ADMIN APPROVE WITHDRAWAL
=====================================================
*/

exports.approveWithdrawal = catchAsync(async (req, res, next) => {
  /*
  =====================================================
  FIND WITHDRAWAL
  =====================================================
  */

  const withdrawal = await Withdrawal.findById(req.params.id);

  if (!withdrawal) {
    return next(new AppError("Withdrawal not found", 404));
  }

  /*
  =====================================================
  ONLY PENDING WITHDRAWALS CAN BE APPROVED
  =====================================================
  */

  if (withdrawal.status !== "pending") {
    return next(
      new AppError(`Withdrawal is already ${withdrawal.status}`, 400),
    );
  }

  /*
  =====================================================
  GET USER
  =====================================================
  */

  const user = await User.findById(withdrawal.user).select(
    "_id firstName lastName email walletBalance",
  );

  if (!user) {
    return next(new AppError("User associated with withdrawal not found", 404));
  }

  /*
  =====================================================
  CHECK CURRENT WALLET BALANCE
  =====================================================
  */

  const currentBalance = user.walletBalance || 0;

  if (currentBalance < withdrawal.amount) {
    return next(new AppError("User does not have enough wallet balance", 400));
  }

  /*
  =====================================================
  PREVENT DUPLICATE TRANSACTION
  =====================================================
  */

  const transactionReference = `WITHDRAWAL-${withdrawal._id}`;

  const existingTransaction = await WalletTransaction.findOne({
    user: user._id,
    source: "withdrawal",
    reference: transactionReference,
  });

  if (existingTransaction) {
    return next(
      new AppError("This withdrawal has already been processed", 400),
    );
  }

  /*
  =====================================================
  CALCULATE BALANCE
  =====================================================
  */

  const balanceBefore = currentBalance;

  const balanceAfter = balanceBefore - withdrawal.amount;

  /*
  =====================================================
  DEDUCT WALLET
  =====================================================

  IMPORTANT:
  Use findByIdAndUpdate instead of user.save()
  to prevent passwordConfirm validation problems.
  */

  await User.findByIdAndUpdate(
    user._id,
    {
      $inc: {
        walletBalance: -withdrawal.amount,
      },
    },
    {
      new: true,
      runValidators: false,
    },
  );

  /*
  =====================================================
  CREATE WALLET TRANSACTION
  =====================================================
  */

  await WalletTransaction.create({
    user: user._id,

    type: "debit",

    source: "withdrawal",

    title: "Wallet Withdrawal",

    amount: withdrawal.amount,

    balanceBefore,

    balanceAfter,

    reference: transactionReference,

    status: "completed",
  });

  /*
  =====================================================
  UPDATE WITHDRAWAL
  =====================================================
  */

  withdrawal.status = "approved";

  withdrawal.processedAt = new Date();

  /*
  OPTIONAL ADMIN NOTE
  */

  if (req.body.adminNote?.trim()) {
    withdrawal.adminNote = req.body.adminNote.trim();
  }

  await withdrawal.save();

  /*
  =====================================================
  SEND APPROVAL EMAIL
  =====================================================
  */

  try {
    const email = new Email(user);

    const subject = "Your EmmCoreShops Withdrawal Has Been Approved";

    const message = `
Hello ${user.firstName || "Customer"},

Good news! 🎉

Your withdrawal request has been approved.

Withdrawal Details
------------------------------
Amount: ₦${withdrawal.amount.toLocaleString()}
Status: APPROVED
Withdrawal ID: ${withdrawal._id}
Date: ${new Date().toLocaleDateString()}
------------------------------

The withdrawal amount has been deducted from your EmmCoreShops wallet.

Bank Details
------------------------------
Bank: ${withdrawal.bankDetails.bankName}
Account Name: ${withdrawal.bankDetails.accountName}
Account Number: ${withdrawal.bankDetails.accountNumber}
------------------------------

Your withdrawal is now being processed for payment.

You will receive another notification when the withdrawal has been marked as paid.

Thank you for using EmmCoreShops.

EmmCoreShops Team
`;

    await email.send(subject, message);

    console.log("Withdrawal approval email sent to:", user.email);
  } catch (emailError) {
    /*
    IMPORTANT:
    Email failure should NOT cancel the
    successful withdrawal approval.
    */

    console.error("Withdrawal approval email failed:", emailError.message);
  }

  /*
  =====================================================
  RESPONSE
  =====================================================
  */

  res.status(200).json({
    status: "success",

    message: "Withdrawal approved and wallet balance deducted",

    data: withdrawal,
  });
});

/*
=====================================================
ADMIN REJECT WITHDRAWAL
=====================================================
*/

exports.rejectWithdrawal = catchAsync(async (req, res, next) => {
  /*
  =====================================================
  FIND WITHDRAWAL
  =====================================================
  */

  const withdrawal = await Withdrawal.findById(req.params.id);

  if (!withdrawal) {
    return next(new AppError("Withdrawal not found", 404));
  }

  /*
  =====================================================
  ONLY PENDING WITHDRAWALS CAN BE REJECTED
  =====================================================
  */

  if (withdrawal.status !== "pending") {
    return next(
      new AppError(`Withdrawal is already ${withdrawal.status}`, 400),
    );
  }

  /*
  =====================================================
  ADMIN NOTE
  =====================================================
  */

  const adminNote = req.body.adminNote?.trim();

  if (!adminNote) {
    return next(
      new AppError("Please provide a reason for rejecting the withdrawal", 400),
    );
  }

  /*
  =====================================================
  GET USER
  =====================================================
  */

  const user = await User.findById(withdrawal.user).select(
    "_id firstName lastName email walletBalance",
  );

  if (!user) {
    return next(new AppError("User associated with withdrawal not found", 404));
  }

  /*
  =====================================================
  UPDATE WITHDRAWAL
  =====================================================
  */

  withdrawal.status = "rejected";

  withdrawal.adminNote = adminNote;

  withdrawal.processedAt = new Date();

  await withdrawal.save();

  /*
  =====================================================
  SEND REJECTION EMAIL
  =====================================================
  */

  try {
    const email = new Email(user);

    const subject = "Your EmmCoreShops Withdrawal Was Rejected";

    const message = `
Hello ${user.firstName || "Customer"},

We are sorry to inform you that your withdrawal request has been rejected.

Withdrawal Details
------------------------------
Amount: ₦${withdrawal.amount.toLocaleString()}
Status: REJECTED
Withdrawal ID: ${withdrawal._id}
Date: ${new Date().toLocaleDateString()}
------------------------------

Reason for rejection:
${adminNote}

Your wallet balance has NOT been deducted because this withdrawal request was rejected.

If you believe this was a mistake, please contact our support team.

Thank you for using EmmCoreShops.

EmmCoreShops Team
`;

    await email.send(subject, message);

    console.log("Withdrawal rejection email sent to:", user.email);
  } catch (emailError) {
    /*
    IMPORTANT:
    Email failure should NOT cancel
    the rejection.
    */

    console.error("Withdrawal rejection email failed:", emailError.message);
  }

  /*
  =====================================================
  RESPONSE
  =====================================================
  */

  res.status(200).json({
    status: "success",

    message: "Withdrawal rejected successfully",

    data: withdrawal,
  });
});

/*
=====================================================
ADMIN MARK WITHDRAWAL AS PAID
=====================================================
*/

exports.markWithdrawalPaid = catchAsync(async (req, res, next) => {
  /*
    =====================================================
    FIND WITHDRAWAL
    =====================================================
    */

  const withdrawal = await Withdrawal.findById(req.params.id);

  if (!withdrawal) {
    return next(new AppError("Withdrawal not found", 404));
  }

  /*
    =====================================================
    ONLY APPROVED WITHDRAWALS CAN BE MARKED PAID
    =====================================================
    */

  if (withdrawal.status !== "approved") {
    return next(
      new AppError("Only approved withdrawals can be marked as paid", 400),
    );
  }

  /*
    =====================================================
    GET USER
    =====================================================
    */

  const user = await User.findById(withdrawal.user).select(
    "_id firstName lastName email walletBalance",
  );

  if (!user) {
    return next(new AppError("User associated with withdrawal not found", 404));
  }

  /*
    =====================================================
    UPDATE STATUS
    =====================================================
    */

  withdrawal.status = "paid";

  withdrawal.processedAt = new Date();

  await withdrawal.save();

  /*
    =====================================================
    SEND PAYMENT COMPLETED EMAIL
    =====================================================
    */

  try {
    const email = new Email(user);

    const subject = "Your EmmCoreShops Withdrawal Has Been Paid";

    const message = `
Hello ${user.firstName || "Customer"},

Your EmmCoreShops withdrawal has been successfully paid. 🎉

Withdrawal Details
------------------------------
Amount: ₦${withdrawal.amount.toLocaleString()}
Status: PAID
Withdrawal ID: ${withdrawal._id}
Date: ${new Date().toLocaleDateString()}
------------------------------

Payment was sent to:

Bank: ${withdrawal.bankDetails.bankName}
Account Name: ${withdrawal.bankDetails.accountName}
Account Number: ${withdrawal.bankDetails.accountNumber}

Thank you for using EmmCoreShops.

We appreciate your business.

EmmCoreShops Team
`;

    await email.send(subject, message);

    console.log("Withdrawal paid email sent to:", user.email);
  } catch (emailError) {
    /*
      IMPORTANT:
      Email failure should NOT cancel
      the paid status.
      */

    console.error("Withdrawal paid email failed:", emailError.message);
  }

  /*
    =====================================================
    RESPONSE
    =====================================================
    */

  res.status(200).json({
    status: "success",

    message: "Withdrawal marked as paid",

    data: withdrawal,
  });
});
