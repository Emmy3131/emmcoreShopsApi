const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { promisify } = require("util");
const crypto = require("crypto");
const Email = require("./../utils/email");
const orderModel = require("../models/OrderModel");
const referralService = require("../services/ReferralServices");

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

const createSendToken = (user, res, req, statusCode) => {
  const token = signToken(user._id);

  const cookieOptions = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000,
    ),

    //secure:true,
    httpOnly: true,
    secure: true, // ✅ ENSURE SECURE IN PRODUCTION
    sameSite: "None", // ✅ ALLOW CROSS-SITE
  };

  if (process.env.NODE_ENV === "production") cookieOptions.secure = true;

  res.cookie("jwt", token, cookieOptions);

  res.status(statusCode).json({
    status: "success",
    token,
    data: user,
  });
};


exports.signup = catchAsync(async (req, res, next) => {
  // Get referral code from signup request
  const { referralCode } = req.body;

  // Create User
  const user = await User.create({
    firstName: req.body.firstName,

    lastName: req.body.lastName,

    email: req.body.email,

    password: req.body.password,

    passwordConfirm: req.body.passwordConfirm,

    phone: req.body.phone,

    country: req.body.country,

    address: req.body.address,

    dateOfBirth: req.body.dateOfBirth,

    gender: req.body.gender,
  });

  /*
  =====================================
  CREATE REFERRAL RECORD
  =====================================
  */

  if (referralCode) {
    await referralService.createReferral({
      referralCode,

      newUserId: user._id,
    });
  }

  // Login user
  createSendToken(user, res, req, 201);
});

exports.login = catchAsync(async (req, res, next) => {
  //1) Check if email and password exist
  const { email, password } = req.body;
  if (!email || !password) {
    return next(
      new AppError("Please provide your email and password", 401, ""),
    );
  }

  //2) Check if user exists and password is correct
  const user = await User.findOne({ email: email }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password", 401, ""));
  }

  //3) If everything is okay, send client token
  createSendToken(user, res, req, 200);
});

exports.forgotPassword = catchAsync(async (req, res, next) => {
  // 1) Get user
  const user = await User.findOne({ email: req.body.email });

  if (!user) {
    return next(
      new AppError("There is no user with that email address.", 404, ""),
    );
  }

  // 2) Generate token
  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // ✅ 3) CREATE RESET LINK
  const resetURL = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
  console.log(resetURL);

  try {
    // ✅ SEND LINK NOT TOKEN
    await new Email(user, resetURL).sendPasswordReset();

    res.status(200).json({
      status: "success",
      message: "Confirm the link sent to your email!",
    });
  } catch (err) {
    console.log(err);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the email. Try again later!",
        500,
        "",
      ),
    );
  }
});

exports.resetPassword = catchAsync(async (req, res, next) => {
  //1) Get user based on the token
  const hashToken = crypto
    .createHash("sha256")
    .update(req.params.token)
    .digest("hex");
  const user = await User.findOne({
    passwordResetToken: hashToken,
    passwordResetExpires: { $gt: Date.now() },
  });
  if (!user) {
    return next(new AppError("Token is invalid or has expired", 400, ""));
  }
  user.password = req.body.password;
  user.passwordConfirm = req.body.passwordConfirm;

  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  await user.save();

  createSendToken(user, res, req, 200);
});

exports.logout = catchAsync(async (req, res, next) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });
  res.status(200).json({
    status: "success",
    message: "Logged out successfully",
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  //1) Getting the token and checking if it there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  if (!token) {
    return next(
      new AppError(
        "You are not logged in! Please login to gain access.",
        401,
        "",
      ),
    );
  }

  //2) Verify token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  //3) Check if user still exist
  const currentUser = await User.findById(decoded.id);
  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token does no longer exist.",
        404,
        "",
      ),
    );
  }

  //4) Check if user change password after token was issue
  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError("User recently changed password. Please log in again.", 401),
    );
  }

  // GRANT ACCESS
  req.user = currentUser;
  next();
});

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have the permission to perform this operation",
          403,
          "",
        ),
      );
    }
    next();
  };
};

exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError("User not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: {
      user,
    },
  });
});
