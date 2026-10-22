const mongoose = require("mongoose");

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,

      enum: ["credit", "debit"],

      required: true,
    },

    source: {
      type: String,

      enum: ["referral", "wallet_funding", "withdrawal", "refund", "bonus"],

      required: true,
    },

    title: {
      type: String,
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    balanceBefore: {
      type: Number,
      default: 0,
    },

    balanceAfter: {
      type: Number,
      default: 0,
    },

    reference: {
      type: String,
    },

    status: {
      type: String,

      enum: ["completed", "pending", "failed"],

      default: "completed",
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("WalletTransaction", walletTransactionSchema);
