const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },

    lastName: {
      type: String,
      required: [true, "Last name is required"],
      trim: true,
    },

    role: {
      type: String,
      enum: {
        values: ["user", "admin", "vendor"],
        message: "Role must be user, admin, or vendor.",
      },
      default: "user",
    },

    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },

    gender: {
      type: String,
      enum: ["male", "female", "other"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value) => validator.isEmail(value),
        message: "Please provide a valid email",
      },
    },

    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
    },

    // Used by signup and password-change operations.

    passwordConfirm: {
      type: String,
      select: false,
      validate: {
        validator: function (value) {
          // Existing users only need confirmation when changing a password.
          if (!this.isNew && !this.isModified("password")) {
            return true;
          }

          return (
            typeof value === "string" &&
            value.length > 0 &&
            value === this.password
          );
        },
        message: "Passwords do not match or confirmation is missing.",
      },
    },

    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
      trim: true,
    },

    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
    },

    // Keep this spelling consistent with authController.
    passwordChangedAt: Date,

    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },

    addresses: [
      {
        label: {
          type: String,
          enum: ["Home", "Office", "Family", "Other"],
          default: "Home",
        },

        fullName: {
          type: String,
          required: true,
          trim: true,
        },

        phone: {
          type: String,
          required: true,
          trim: true,
        },

        state: {
          type: String,
          required: true,
          trim: true,
        },

        city: {
          type: String,
          required: true,
          trim: true,
        },

        address: {
          type: String,
          required: true,
          trim: true,
        },

        landmark: String,

        country: {
          type: String,
          default: "Nigeria",
        },

        postalCode: String,

        isDefault: {
          type: Boolean,
          default: false,
        },
      },
    ],

    passwordResetToken: String,
    passwordResetExpires: Date,

    isOnline: {
      type: Boolean,
      default: false,
    },

    lastSeen: Date,

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    referralCode: {
      type: String,
      unique: true,
      index: true,
    },

    referralBonus: {
      type: Number,
      default: 0,
      min: 0,
    },

    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },

    bankAccount: {
      bankName: String,
      accountName: String,
      accountNumber: String,
    },
  },
  {
    timestamps: true,
  },
);

// Generate a referral code for new users.
userSchema.pre("save", function () {
  if (!this.referralCode) {
    this.referralCode =
      "EMM" + crypto.randomBytes(4).toString("hex").toUpperCase();
  }
});

// Hash the password only when it changes.
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(this.password, 12);

  // Remove confirmation before MongoDB validation/persistence.
  this.passwordConfirm = undefined;

  if (!this.isNew) {
    this.passwordChangedAt = new Date(Date.now() - 1000);
  }
});

// Compare a login candidate against the stored password hash.
userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return bcrypt.compare(candidatePassword, userPassword);
};

// Check whether the password changed after a JWT was issued.
userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (!this.passwordChangedAt) return false;

  const changedTimestamp = Math.floor(this.passwordChangedAt.getTime() / 1000);

  return JWTTimestamp < changedTimestamp;
};

// Create a hashed password-reset token.
userSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");

  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

  return resetToken;
};

module.exports = mongoose.model("User", userSchema);
