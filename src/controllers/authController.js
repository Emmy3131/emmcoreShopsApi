const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const User = require("../models/UserModel");
const jwt = require("jsonwebtoken");
const { promisify } = require("util");
const crypto = require("crypto");
const Email = require("../utils/email");
const ReferralService = require("../services/ReferralServices");

/*
=====================================================
CREATE JWT TOKEN
=====================================================
*/
const signToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from your .env file.");
  }

  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "90d",
  });
};

/*
=====================================================
SEND TOKEN AND SET COOKIE
=====================================================
IMPORTANT:
Arguments are (user, statusCode, res).
=====================================================
*/
const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  const cookieDays = Number(
    process.env.JWT_COOKIE_EXPIRES_IN || 90
  );

  if (!Number.isFinite(cookieDays) || cookieDays <= 0) {
    throw new Error(
      "JWT_COOKIE_EXPIRES_IN must be a positive number of days."
    );
  }

  const isProduction = process.env.NODE_ENV === "production";

  const cookieOptions = {
    expires: new Date(
      Date.now() + cookieDays * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  };

  // Express response object must be passed as the third argument.
  res.cookie("jwt", token, cookieOptions);

  // Do not expose password fields in the response.
  const safeUser = user.toObject ? user.toObject() : { ...user };

  delete safeUser.password;
  delete safeUser.passwordConfirm;
  delete safeUser.passwordResetToken;
  delete safeUser.passwordResetExpires;

  return res.status(statusCode).json({
    status: "success",
    token,
    data: {
      user: safeUser,
    },
  });
};

/*
=====================================================
SIGNUP
POST /api/v1/users/signup
=====================================================
*/
exports.signup = catchAsync(async (req, res, next) => {
  const {
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
    phone,
    country,
    address,
    dateOfBirth,
    gender,
    referralCode,
  } = req.body;

  // Validate required fields from UserModel.
  const requiredFields = {
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
    phone,
    country,
    address,
    dateOfBirth,
  };

  const missingFields = Object.entries(requiredFields)
    .filter(([, value]) =>
      value === undefined ||
      value === null ||
      String(value).trim() === ""
    )
    .map(([field]) => field);

  if (missingFields.length > 0) {
    return next(
      new AppError(
        `Missing required fields: ${missingFields.join(", ")}.`,
        400
      )
    );
  }

  if (password !== passwordConfirm) {
    return next(
      new AppError("Password and password confirmation do not match.", 400)
    );
  }

  if (password.length < 8) {
    return next(
      new AppError("Password must contain at least 8 characters.", 400)
    );
  }

  const existingUser = await User.findOne({
    $or: [
      { email: String(email).trim().toLowerCase() },
      { phone: String(phone).trim() },
    ],
  });

  if (existingUser) {
    if (
      existingUser.email === String(email).trim().toLowerCase()
    ) {
      return next(
        new AppError("An account with this email already exists.", 409)
      );
    }

    return next(
      new AppError("An account with this phone number already exists.", 409)
    );
  }

  // UserModel hashes the password in its pre-save hook.
  const user = await User.create({
    firstName,
    lastName,
    email,
    password,
    passwordConfirm,
    phone,
    country,
    address,
    dateOfBirth,
    ...(gender ? { gender } : {}),
  });

  /*
  =====================================
  CREATE REFERRAL RECORD
  =====================================
  */
  if (referralCode) {
    await ReferralService.createReferral({
      referralCode,
      newUserId: user._id,
    });
  }

  // Correct order: user, status code, Express response.
  return createSendToken(user, 201, res);
});

/*
=====================================================
LOGIN
POST /api/v1/users/login
=====================================================
*/
exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return next(
      new AppError("Please provide your email and password.", 400)
    );
  }

  // Password is select:false in UserModel, so explicitly select it.
  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  }).select("+password");

  if (!user || !(await user.correctPassword(password, user.password))) {
    return next(new AppError("Incorrect email or password.", 401));
  }

  if (user.status === "inactive") {
    return next(
      new AppError("This account is inactive. Please contact support.", 403)
    );
  }

  // Correct order: user, status code, Express response.
  return createSendToken(user, 200, res);
});

/*
=====================================================
LOGOUT
POST /api/v1/users/logout
=====================================================
*/
exports.logout = catchAsync(async (req, res, next) => {
  res.cookie("jwt", "loggedout", {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
  });

  res.status(200).json({
    status: "success",
    message: "Logged out successfully.",
  });
});

/*
=====================================================
FORGOT PASSWORD
POST /api/v1/users/forgotPassword
=====================================================
*/
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  if (!email) {
    return next(new AppError("Please provide your email address.", 400));
  }

  const user = await User.findOne({
    email: String(email).trim().toLowerCase(),
  });

  if (!user) {
    return next(
      new AppError("There is no user with that email address.", 404)
    );
  }

  const resetToken = user.createPasswordResetToken();

  await user.save({ validateBeforeSave: false });

  const frontendUrl = process.env.FRONTEND_URL;

  if (!frontendUrl) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(
      new AppError("FRONTEND_URL is not configured on the server.", 500)
    );
  }

  const resetURL =
    `${frontendUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

  try {
    await new Email(user, resetURL).sendPasswordReset();

    return res.status(200).json({
      status: "success",
      message: "Password reset instructions have been sent to your email.",
    });
  } catch (error) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });

    return next(
      new AppError(
        "There was an error sending the password reset email. Please try again later.",
        500
      )
    );
  }
});

/*
=====================================================
RESET PASSWORD
PATCH /api/v1/users/resetPassword/:token
=====================================================
*/
exports.resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password, passwordConfirm } = req.body;

  if (!password || !passwordConfirm) {
    return next(
      new AppError("Please provide password and passwordConfirm.", 400)
    );
  }

  if (password !== passwordConfirm) {
    return next(new AppError("Passwords do not match.", 400));
  }

  if (password.length < 8) {
    return next(
      new AppError("Password must contain at least 8 characters.", 400)
    );
  }

  const hashedToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) {
    return next(
      new AppError("The password reset token is invalid or has expired.", 400)
    );
  }

  user.password = password;
  user.passwordConfirm = passwordConfirm;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;

  // UserModel hashes the new password in its pre-save hook.
  await user.save();

  return createSendToken(user, 200, res);
});

/*
=====================================================
AUTHENTICATION MIDDLEWARE
=====================================================
*/
exports.protect = catchAsync(async (req, res, next) => {
  let token;

  // Read Bearer token from Authorization header.
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Optional cookie authentication.
  if (!token && req.cookies && req.cookies.jwt) {
    if (req.cookies.jwt !== "loggedout") {
      token = req.cookies.jwt;
    }
  }

  if (!token) {
    return next(
      new AppError(
        "You are not logged in. Please log in to gain access.",
        401
      )
    );
  }

  const decoded = await promisify(jwt.verify)(
    token,
    process.env.JWT_SECRET
  );

  const currentUser = await User.findById(decoded.id);

  if (!currentUser) {
    return next(
      new AppError(
        "The user belonging to this token no longer exists.",
        401
      )
    );
  }

  if (currentUser.changedPasswordAfter(decoded.iat)) {
    return next(
      new AppError(
        "Your password has changed. Please log in again.",
        401
      )
    );
  }

  if (currentUser.status === "inactive") {
    return next(
      new AppError("This account is inactive.", 403)
    );
  }

  req.user = currentUser;

  next();
});

/*
=====================================================
ROLE AUTHORIZATION
=====================================================
*/
exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new AppError(
          "You do not have permission to perform this operation.",
          403
        )
      );
    }

    next();
  };
};

/*
=====================================================
GET CURRENTLY LOGGED-IN USER
GET /api/v1/users/me
=====================================================
*/
exports.getMe = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    return next(new AppError("User not found.", 404));
  }

  res.status(200).json({
    status: "success",
    data: { user },
  });
});
