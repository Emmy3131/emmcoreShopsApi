const mongoose = require("mongoose");

const withdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    amount: {
      type: Number,
      required: true,
    },

    bankDetails: {
      bankName: {
        type: String,
        required: true,
      },

      accountName: {
        type: String,
        required: true,
      },

      accountNumber: {
        type: String,
        required: true,
      },
    },

    status: {
      type: String,

      enum: ["pending", "approved", "rejected", "paid"],

      default: "pending",
    },

    adminNote: {
      type: String,
    },

    processedAt: {
      type: Date,
    },
  },

  {
    timestamps: true,
  },
);

module.exports = mongoose.model("Withdrawal", withdrawalSchema);
