const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required"],
    },

    role: {
      type: String,
      enum: {
        values: ["user", "admin", "vendor"],
        message:
          "Role must be either 'user' or 'admin' or 'vendor'. Got '{VALUE}'",
      },
      default: "user",
    },

    dateOfBirth: {
      type: Date,
      required: [true, "Date of birth is required"],
    },
    gender: {
      type: String,
      enum: {
        values: ["male", "female", "other"],
        message:
          "Gender must be either 'male', 'female', or 'other'. Got '{VALUE}'",
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      validate: [validator.isEmail, "Please provide a valid email"],
      unique: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters long"],
      select: false,
    },
    passwordConfirm: {
      type: String,
      required: [true, "Please confirm your password"],
      validate: {
        validator: function (el) {
          return el === this.password;
        },
        message: "Passwords are not the same",
      },
    },
    phone: {
      type: String,
      required: [true, "Phone number is required"],
      unique: true,
    },
    country: {
      type: String,
      required: [true, "Country is required"],
    },
    passwordchangedAt: Date,
    address: {
      type: String,
      required: [true, "Address is required"],
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
        },

        phone: {
          type: String,
          required: true,
        },

        state: {
          type: String,
          required: true,
        },

        city: {
          type: String,
          required: true,
        },

        address: {
          type: String,
          required: true,
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
    },

    walletBalance: {
      type: Number,
      default: 0,
    },

    bankAccount: {
      bankName: String,

      accountName: String,

      accountNumber: String,
    },
  },
  { timestamps: true },
);

// run on refferral code
userSchema.pre("save", function () {
  if (!this.referralCode) {
    this.referralCode =
      "EMM" + crypto.randomBytes(4).toString("hex").toUpperCase();
  }
});

userSchema.pre("save", async function () {
  // Only run if password was modified
  if (!this.isModified("password")) return;

  // Hash password
  this.password = await bcrypt.hash(this.password, 12);

  // Remove confirm password
  this.passwordConfirm = undefined;

  // Set password change time
  if (!this.isNew) {
    this.passwordChangedAt = Date.now() - 1000;
  }
});

userSchema.methods.correctPassword = async function (
  candidatePassword,
  userPassword,
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

userSchema.methods.changedPasswordAfter = function (JWTTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(
      this.passwordChangedAt.getTime() / 1000,
      10,
    );

    // Password changed AFTER token issued
    return JWTTimestamp < changedTimestamp;
  }

  // Password never changed
  return false;
};

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
