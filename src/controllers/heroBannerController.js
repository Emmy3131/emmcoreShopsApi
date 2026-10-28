const HeroBannerModel = require("../models/HeroModel");
const AppError = require("../utils/appError");

/*
====================================
PUBLIC HERO BANNERS
====================================
*/

exports.getHeroBanner = async (req, res) => {
  try {
    const banners = await HeroBannerModel.find({
      active: true,
    }).sort("order");

    res.status(200).json({
      status: "success",

      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",

      message: error.message,
    });
  }
};

/*
====================================
CREATE HERO BANNER
====================================
*/

exports.createHeroBanner = async (req, res) => {
  try {
    const banner = await HeroBannerModel.create(req.body);

    res.status(201).json({
      status: "success",

      data: banner,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",

      message: error.message,
    });
  }
};

/*
====================================
ADMIN GET ALL
====================================
*/

exports.getHeroBanners = async (req, res) => {
  try {
    const banners = await HeroBannerModel.find().sort({
      order: 1,
      createdAt: -1,
    });

    res.status(200).json({
      status: "success",

      data: banners,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",

      message: error.message,
    });
  }
};

/*
====================================
GET SINGLE BANNER
====================================
*/

exports.getSingleHeroBanner = async (req, res) => {
  try {
    const banner = await HeroBannerModel.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({
        status: "error",

        message: "Hero banner not found",
      });
    }

    res.status(200).json({
      status: "success",

      data: banner,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",

      message: error.message,
    });
  }
};

/*
====================================
UPDATE HERO BANNER
====================================
*/

exports.updateHeroBanner = async (req, res) => {
  try {
    const banner = await HeroBannerModel.findByIdAndUpdate(
      req.params.id,

      req.body,

      {
        new: true,
        runValidators: true,
      },
    );

    if (!banner) {
      return res.status(404).json({
        status: "error",

        message: "Hero banner not found",
      });
    }

    res.status(200).json({
      status: "success",

      data: banner,
    });
  } catch (error) {
    res.status(400).json({
      status: "error",

      message: error.message,
    });
  }
};

/*
====================================
DELETE HERO BANNER
====================================
*/

exports.deleteHeroBanner = async (req, res) => {
  try {
    const banner = await HeroBannerModel.findByIdAndDelete(req.params.id);

    if (!banner) {
      return res.status(404).json({
        status: "error",

        message: "Hero banner not found",
      });
    }

    res.status(200).json({
      status: "success",

      message: "Hero banner deleted",
    });
  } catch (error) {
    res.status(400).json({
      status: "error",

      message: error.message,
    });
  }
};
