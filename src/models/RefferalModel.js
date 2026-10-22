const mongoose = require("mongoose");


const referralSchema = new mongoose.Schema(
  {

    // User who shared the referral link
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    // User who registered using the link
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },


    // Referral code used
    referralCode: {
      type: String,
      required: true,
    },


    /*
      pending:
      User registered but has not completed requirement

      qualified:
      User completed first order

      rewarded:
      Referrer already received bonus

      cancelled:
      Referral invalid
    */
    status: {
      type: String,
      enum: [
        "pending",
        "qualified",
        "rewarded",
        "cancelled",
      ],
      default: "pending",
    },


    // Amount earned by referrer
    rewardAmount: {
      type: Number,
      default: 5000,
    },


    // Order that qualified this referral
    qualifyingOrder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
    },


    rewardedAt: {
      type: Date,
    },


    createdAt: {
      type: Date,
      default: Date.now,
    },

  },

  {
    timestamps: true,
  }
);


// Prevent duplicate referral records
referralSchema.index(
  {
    referrer: 1,
    referredUser: 1,
  },
  {
    unique: true,
  }
);



module.exports = mongoose.model(
  "Referral",
  referralSchema
);