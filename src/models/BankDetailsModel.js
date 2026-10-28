const mongoose = require("mongoose");

const bankAccountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    bankName: {
      type: String,
      required: [true, "Bank name is required"],
      trim: true,
    },

    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },

    accountNumber: {
      type: String,
      required: [true, "Account number is required"],
      trim: true,
    },

    isVerified: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model("BankAccount", bankAccountSchema);
