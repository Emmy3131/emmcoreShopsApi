const router = require("express").Router();

const authController = require("../controllers/authController");

const referralController = require("../controllers/referralController");

const adminWithdrawalController = require("../controllers/adminWithdrawalController");

/*
=====================================================
PROTECT ALL ADMIN ROUTES
=====================================================
*/

router.use(authController.protect);

router.use(authController.restrictTo("admin"));

/*
=====================================================
REFERRALS
=====================================================
*/

// Get all referrals
router.get("/referrals", referralController.getAllReferrals);

/*
=====================================================
WITHDRAWALS
=====================================================
*/

// Get all withdrawal requests
router.get("/withdrawals", adminWithdrawalController.getAllWithdrawals);

// Approve withdrawal
router.patch(
  "/withdrawals/:id/approve",
  adminWithdrawalController.approveWithdrawal,
);

// Reject withdrawal
router.patch(
  "/withdrawals/:id/reject",
  adminWithdrawalController.rejectWithdrawal,
);

// Mark approved withdrawal as paid
router.patch(
  "/withdrawals/:id/paid",
  adminWithdrawalController.markWithdrawalPaid,
);

module.exports = router;
