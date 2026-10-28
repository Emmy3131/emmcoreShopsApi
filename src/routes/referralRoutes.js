const express = require("express");

const router = express.Router();

const referralController = require("../controllers/referralController");

const authController = require("../controllers/authController");

/*
====================================
PROTECTED USER ROUTES
====================================
*/

router.use(authController.protect);

router.get("/me", referralController.getMyReferralDashboard);

router.get("/history", referralController.getReferralHistory);

/*
====================================
ADMIN ROUTES
====================================
*/

router.use(authController.restrictTo("admin"));

router.get("/", referralController.getAllReferrals);

module.exports = router;
