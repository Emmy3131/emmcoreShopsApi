
const mongoose = require("mongoose");
const User = require("../models/UserModel");
const Order = require("../models/OrderModel");
const AppError = require("../utils/appError");

/*
=====================================================
HELPER: CHECK VALID MONGODB OBJECT ID
=====================================================
*/
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

/*
=====================================================
GET ALL USERS
GET /api/v1/users
=====================================================
*/
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password");

    res.status(200).json({
      status: "success",
      results: users.length,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
GET ONE USER
GET /api/v1/users/:id
=====================================================
*/
exports.getUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    const user = await User.findById(id).select("-password");

    if (!user) {
      return next(new AppError("No user found with that ID.", 404));
    }

    res.status(200).json({
      status: "success",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
CREATE USER
POST /api/v1/users

Expected JSON body:
{
  "firstName": "Emmanuel",
  "lastName": "Nnaemeka",
  "email": "emmanuel@example.com",
  "password": "StrongPass123",
  "passwordConfirm": "StrongPass123",
  "phone": "+2348012345678",
  "country": "Nigeria",
  "address": "Port Harcourt, Rivers State",
  "dateOfBirth": "2000-01-15",
  "gender": "male"
}
=====================================================
*/
exports.createUser = async (req, res, next) => {
  try {
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
    } = req.body;

    // Validate required fields before accessing the database.
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
      return res.status(400).json({
        status: "fail",
        message: "Please provide all required fields.",
        missingFields,
      });
    }

    // Confirm the passwords match.
    if (password !== passwordConfirm) {
      return res.status(400).json({
        status: "fail",
        message: "Password and password confirmation do not match.",
      });
    }

    // Check password length before saving.
    if (password.length < 8) {
      return res.status(400).json({
        status: "fail",
        message: "Password must contain at least 8 characters.",
      });
    }

    // Validate date of birth.
    const dob = new Date(dateOfBirth);

    if (Number.isNaN(dob.getTime()) || dob >= new Date()) {
      return res.status(400).json({
        status: "fail",
        message: "Please provide a valid date of birth in the past.",
      });
    }

    // Check whether email or phone is already registered.
    const existingUser = await User.findOne({
      $or: [
        { email: String(email).trim().toLowerCase() },
        { phone: String(phone).trim() },
      ],
    });

    if (existingUser) {
      const duplicateField =
        existingUser.email === String(email).trim().toLowerCase()
          ? "email"
          : "phone";

      return res.status(409).json({
        status: "fail",
        message: `A user with this ${duplicateField} already exists.`,
      });
    }

    /*
      IMPORTANT:
      Do not hash the password here.
      UserModel's pre-save hook hashes it automatically.
    */
    const newUser = await User.create({
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      passwordConfirm,
      phone: String(phone).trim(),
      country: String(country).trim(),
      address: String(address).trim(),
      dateOfBirth: dob,
      ...(gender ? { gender } : {}),
    });

    // Never return the password or password confirmation.
    const safeUser = await User.findById(newUser._id).select(
      "-password -passwordResetToken -passwordResetExpires"
    );

    return res.status(201).json({
      status: "success",
      message: "User created successfully.",
      data: { user: safeUser },
    });
  } catch (error) {
    // Handle duplicate-key errors caused by concurrent requests.
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || "field";

      return res.status(409).json({
        status: "fail",
        message: `A user with this ${field} already exists.`,
      });
    }

    // Mongoose schema validation errors.
    if (error.name === "ValidationError") {
      return res.status(400).json({
        status: "fail",
        message: error.message,
      });
    }

    next(error);
  }
};

/*
=====================================================
UPDATE USER
PATCH /api/v1/users/:id
=====================================================
*/
exports.updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    // Password changes must go through the password endpoint.
    const forbiddenFields = [
      "password",
      "passwordConfirm",
      "role",
      "referralBonus",
      "walletBalance",
      "bankAccount",
    ];

    for (const field of forbiddenFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        return next(
          new AppError(
            `You cannot update "${field}" through this endpoint.`,
            400
          )
        );
      }
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "email",
      "phone",
      "country",
      "address",
      "dateOfBirth",
      "gender",
      "status",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return next(new AppError("No user found with that ID.", 404));
    }

    res.status(200).json({
      status: "success",
      message: "User updated successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
DELETE USER
DELETE /api/v1/users/:id
=====================================================
*/
exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      return next(new AppError("No user found with that ID.", 404));
    }

    res.status(204).json({
      status: "success",
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
UPDATE MY PROFILE
PATCH /api/v1/users/updateMe
=====================================================
*/
exports.updateMe = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(new AppError("You must be logged in.", 401));
    }

    const forbiddenFields = [
      "password",
      "passwordConfirm",
      "role",
      "referralBonus",
      "walletBalance",
      "bankAccount",
      "status",
    ];

    for (const field of forbiddenFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        return next(
          new AppError(
            `You cannot update "${field}" through this endpoint.`,
            400
          )
        );
      }
    }

    const allowedFields = [
      "firstName",
      "lastName",
      "phone",
      "address",
      "country",
      "dateOfBirth",
      "gender",
    ];

    const updateData = {};

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updateData, {
      new: true,
      runValidators: true,
    }).select("-password");

    if (!user) {
      return next(new AppError("Your user account could not be found.", 404));
    }

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully.",
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
TOGGLE USER STATUS
PATCH /api/v1/users/:id/toggle-status
=====================================================
*/
exports.toggleUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    const user = await User.findById(id);

    if (!user) {
      return next(new AppError("No user found with that ID.", 404));
    }

    user.status = user.status === "active" ? "inactive" : "active";
    await user.save();

    res.status(200).json({
      status: "success",
      message: `User status changed to ${user.status}.`,
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
GET ALL ORDERS FOR A USER
GET /api/v1/users/:id/orders
=====================================================
*/
exports.getAllOrderByAUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return next(new AppError("Invalid user ID.", 400));
    }

    const orders = await Order.find({ user: id });

    res.status(200).json({
      status: "success",
      results: orders.length,
      data: { orders },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
ADDRESS HELPERS
=====================================================
*/
const getAuthenticatedUser = async (req, next) => {
  if (!req.user || !req.user._id) {
    next(new AppError("You must be logged in.", 401));
    return null;
  }

  const user = await User.findById(req.user._id);

  if (!user) {
    next(new AppError("Your user account could not be found.", 404));
    return null;
  }

  return user;
};

/*
=====================================================
GET MY ADDRESSES
GET /api/v1/users/addresses
=====================================================
*/
exports.getMyAddresses = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    res.status(200).json({
      status: "success",
      results: user.addresses.length,
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
ADD ADDRESS
POST /api/v1/users/addresses
=====================================================
*/
exports.addAddress = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    const {
      label,
      fullName,
      phone,
      state,
      city,
      address,
      landmark,
      country,
      postalCode,
      isDefault,
    } = req.body;

    if (!fullName || !phone || !state || !city || !address || !country) {
      return next(
        new AppError(
          "Please provide fullName, phone, state, city, address and country.",
          400
        )
      );
    }

    if (isDefault) {
      user.addresses.forEach((item) => {
        item.isDefault = false;
      });
    }

    user.addresses.push({
      label,
      fullName,
      phone,
      state,
      city,
      address,
      landmark,
      country,
      postalCode,
      isDefault: Boolean(isDefault) || user.addresses.length === 0,
    });

    await user.save();

    res.status(201).json({
      status: "success",
      message: "Address added successfully.",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
UPDATE ADDRESS
PATCH /api/v1/users/addresses/:id
=====================================================
*/
exports.updateAddress = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    const addressItem = user.addresses.id(req.params.id);

    if (!addressItem) {
      return next(new AppError("Address not found.", 404));
    }

    const allowedFields = [
      "label",
      "fullName",
      "phone",
      "state",
      "city",
      "address",
      "landmark",
      "country",
      "postalCode",
    ];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        addressItem[field] = req.body[field];
      }
    }

    if (req.body.isDefault === true) {
      user.addresses.forEach((item) => {
        item.isDefault = item._id.equals(addressItem._id);
      });
    }

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Address updated successfully.",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
SET DEFAULT ADDRESS
PATCH /api/v1/users/addresses/:id/default
=====================================================
*/
exports.setDefaultAddress = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    const addressItem = user.addresses.id(req.params.id);

    if (!addressItem) {
      return next(new AppError("Address not found.", 404));
    }

    user.addresses.forEach((item) => {
      item.isDefault = item._id.equals(addressItem._id);
    });

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Default address updated successfully.",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
GET DEFAULT ADDRESS
GET /api/v1/users/addresses/default
=====================================================
*/
exports.getDefaultAddress = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    const defaultAddress = user.addresses.find((item) => item.isDefault);

    if (!defaultAddress) {
      return next(new AppError("No default address has been set.", 404));
    }

    res.status(200).json({
      status: "success",
      data: { address: defaultAddress },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
DELETE ADDRESS
DELETE /api/v1/users/addresses/:id
=====================================================
*/
exports.deleteAddress = async (req, res, next) => {
  try {
    const user = await getAuthenticatedUser(req, next);
    if (!user) return;

    const addressItem = user.addresses.id(req.params.id);

    if (!addressItem) {
      return next(new AppError("Address not found.", 404));
    }

    const wasDefault = addressItem.isDefault;

    user.addresses.pull({ _id: req.params.id });

    // If the default address was deleted, select another address.
    if (wasDefault && user.addresses.length > 0) {
      user.addresses[0].isDefault = true;
    }

    await user.save();

    res.status(200).json({
      status: "success",
      message: "Address deleted successfully.",
      data: { addresses: user.addresses },
    });
  } catch (error) {
    next(error);
  }
};

/*
=====================================================
UPDATE PASSWORD
PATCH /api/v1/users/updatePassword
=====================================================
*/
exports.updatePassword = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return next(new AppError("You must be logged in.", 401));
    }

    const { currentPassword, password, passwordConfirm } = req.body;

    if (!currentPassword || !password || !passwordConfirm) {
      return next(
        new AppError(
          "Please provide currentPassword, password and passwordConfirm.",
          400
        )
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

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return next(new AppError("Your user account could not be found.", 404));
    }

    const isCorrect = await user.correctPassword(
      currentPassword,
      user.password
    );

    if (!isCorrect) {
      return next(new AppError("Your current password is incorrect.", 401));
    }

    user.password = password;
    user.passwordConfirm = passwordConfirm;

    // UserModel hashes the new password in its pre-save hook.
    await user.save();

    res.status(200).json({
      status: "success",
      message: "Password updated successfully. Please log in again.",
    });
  } catch (error) {
    next(error);
  }
};
