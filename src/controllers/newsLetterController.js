const NewsletterModel = require("../models/NewsLetterModel");
const { countDocuments } = require("../models/ProductsModel");
const AppError = require("../utils/appError");

exports.subscribeNewsletter = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return next(new AppError("Email is required", 400));
    }

    const existingSubscription =
      await NewsletterModel.findOne({ email });

    if (existingSubscription) {
      return next(
        new AppError(
          "This email is already subscribed",
          400
        )
      );
    }

    const newSubscription =
      await NewsletterModel.create({ email });

    res.status(201).json({
      status: "success",
      data: newSubscription,
      message: "You have successfully subscribed to the newsletter",
    });
  } catch (error) {
    next(error);
  }
};


exports.getAllSubscribers = async (req, res) => {
  try {
    const subscribers = await NewsletterModel
      .find()
      .sort({ createdAt: -1 });

    res.status(200).json({
      status: "success",
      count: subscribers.length,
      subscribers,
    });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};

exports.deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;
    const subscriber = await NewsletterModel.findByIdAndDelete(id);

    if (!subscriber) {  
      return res.status(404).json({
        status: "fail",
        message: "Subscriber not found",
      });
    }
    res.status(200).json({
      status: "success",
      message: "Subscriber deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};

exports.getSubscriberCount = async (req, res) => {
  try {
    const count = await NewsletterModel.countDocuments();

    res.status(200).json({
      status: "success",
      count,
    });
  }catch (error) {
    res.status(500).json({
      status: "fail",
      message: error.message,
    });
  }
};
