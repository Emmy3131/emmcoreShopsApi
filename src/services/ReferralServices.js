const Referral = require("../models/RefferalModel");
const User = require("../models/UserModel");
const WalletTransaction = require("../models/WalletTransactionModel");

const { referralBonus, minimumOrderAmount } = require("../utils/referral");

/*
=====================================================
CREATE REFERRAL AFTER USER SIGNUP
=====================================================
*/

exports.createReferral = async ({ referralCode, newUserId }) => {
  if (!referralCode) {
    return null;
  }

  const normalizedCode = referralCode.trim().toUpperCase();

  /*
  =====================================================
  FIND REFERRER
  =====================================================
  */

  const referrer = await User.findOne({
    referralCode: normalizedCode,
  });

  if (!referrer) {
    return null;
  }

  /*
  =====================================================
  PREVENT SELF REFERRAL
  =====================================================
  */

  if (referrer._id.toString() === newUserId.toString()) {
    return null;
  }

  /*
  =====================================================
  CHECK DUPLICATE
  =====================================================
  */

  const existingReferral = await Referral.findOne({
    referrer: referrer._id,
    referredUser: newUserId,
  });

  if (existingReferral) {
    return existingReferral;
  }

  /*
  =====================================================
  CREATE REFERRAL
  =====================================================
  */

  const referral = await Referral.create({
    referrer: referrer._id,

    referredUser: newUserId,

    referralCode: normalizedCode,

    status: "pending",

    rewardAmount: referralBonus,
  });

  console.log(`Referral created: ${referrer._id} referred ${newUserId}`);

  return referral;
};

/*
=====================================================
PROCESS REFERRAL AFTER SUCCESSFUL PAYMENT
=====================================================

This is the main function that should be called
after a successful qualifying payment.
=====================================================
*/

/*
=====================================================
PROCESS REFERRAL AFTER SUCCESSFUL PAYMENT
=====================================================

Flow:

pending referral
      ↓
successful qualifying payment
      ↓
credit referrer wallet
      ↓
create wallet transaction
      ↓
mark referral rewarded

The operation is protected against duplicate rewards.
=====================================================
*/

exports.processOrderReferral = async ({ userId, orderId, orderAmount }) => {
  try {
    /*
    =====================================================
    CHECK MINIMUM ORDER AMOUNT
    =====================================================
    */

    if (orderAmount < minimumOrderAmount) {
      console.log(`Order ${orderId} does not qualify for referral bonus.`);

      return null;
    }

    /*
    =====================================================
    FIND PENDING REFERRAL
    =====================================================
    */

    const referral = await Referral.findOne({
      referredUser: userId,
      status: "pending",
    });

    if (!referral) {
      console.log(`No pending referral found for user ${userId}.`);

      return null;
    }

    /*
    =====================================================
    FIND REFERRER
    =====================================================
    */

    const referrer = await User.findById(referral.referrer).select(
      "_id walletBalance",
    );

    if (!referrer) {
      console.error(`Referrer not found: ${referral.referrer}`);

      return null;
    }

    /*
    =====================================================
    DUPLICATE PROTECTION
    =====================================================
    
    Check whether this referral bonus has already
    created a wallet transaction.
    */

    const transactionReference = `REF-${referral._id}`;

    const existingTransaction = await WalletTransaction.findOne({
      user: referrer._id,
      source: "referral",
      reference: transactionReference,
    });

    if (existingTransaction) {
      console.log(`Referral bonus already processed: ${referral._id}`);

      /*
      Make sure referral is synchronized.
      */

      if (referral.status !== "rewarded") {
        referral.status = "rewarded";

        referral.qualifyingOrder = orderId;

        referral.rewardedAt = referral.rewardedAt || new Date();

        await referral.save();
      }

      return referral;
    }

    /*
    =====================================================
    GET CURRENT BALANCE
    =====================================================
    */

    const balanceBefore = referrer.walletBalance || 0;

    const balanceAfter = balanceBefore + referral.rewardAmount;

    /*
    =====================================================
    CREDIT WALLET
    =====================================================

    IMPORTANT:

    Do NOT use:

        referrer.save()

    because your User model validates passwordConfirm.

    $inc updates only walletBalance.
    */

    await User.findByIdAndUpdate(
      referrer._id,
      {
        $inc: {
          walletBalance: referral.rewardAmount,
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
      user: referrer._id,

      type: "credit",

      source: "referral",

      title: "Referral Bonus",

      amount: referral.rewardAmount,

      balanceBefore,

      balanceAfter,

      reference: transactionReference,

      status: "completed",
    });

    /*
    =====================================================
    UPDATE REFERRAL
    =====================================================
    */

    referral.status = "rewarded";

    referral.qualifyingOrder = orderId;

    referral.rewardedAt = new Date();

    await referral.save();

    /*
    =====================================================
    SUCCESS LOG
    =====================================================
    */

    console.log("==========================================");

    console.log("REFERRAL BONUS SUCCESSFULLY PROCESSED");

    console.log("Referral:", referral._id.toString());

    console.log("Referrer:", referrer._id.toString());

    console.log("Bonus:", `₦${referral.rewardAmount.toLocaleString()}`);

    console.log("Balance Before:", `₦${balanceBefore.toLocaleString()}`);

    console.log("Balance After:", `₦${balanceAfter.toLocaleString()}`);

    console.log("==========================================");

    return referral;
  } catch (error) {
    console.error("Referral processing error:", error);

    throw error;
  }
};

/*
=====================================================
GET USER REFERRAL STATS
=====================================================
*/

exports.getReferralStats = async (userId) => {
  const referrals = await Referral.find({
    referrer: userId,
  });

  const total = referrals.length;

  const successful = referrals.filter(
    (item) => item.status === "rewarded",
  ).length;

  const pending = referrals.filter((item) => item.status === "pending").length;

  const bonus = referrals
    .filter((item) => item.status === "rewarded")
    .reduce((sum, item) => sum + item.rewardAmount, 0);

  return {
    total,
    successful,
    pending,
    bonus,
    referrals,
  };
};
