const express = require("express");

const WithdrawalController = require("../controllers/withdrawalController");
const authController = require("../controllers/authController");

const router = express.Router();

/*
=====================================================
PROTECT ALL ROUTES
=====================================================
*/

router.use(authController.protect);

/*
=====================================================
USER BANK ACCOUNT
=====================================================
*/

router
  .route("/bank-account")
  .get(WithdrawalController.getMyBankAccount)
  .post(WithdrawalController.saveBankAccount);

/*
=====================================================
USER WITHDRAWALS
=====================================================
*/

router
  .route("/")
  .get(WithdrawalController.getMyWithdrawals)
  .post(WithdrawalController.requestWithdrawal);

/*
=====================================================
ADMIN WITHDRAWALS
=====================================================
*/

/*
GET ALL WITHDRAWALS
GET /api/v1/withdrawals/admin/all
*/

router.get(
  "/admin/all",
  authController.restrictTo("admin"),
  WithdrawalController.getAllWithdrawals,
);

/*
APPROVE / REJECT / MARK PAID
PATCH /api/v1/withdrawals/admin/:id
*/

router.patch(
  "/admin/:id",
  authController.restrictTo("admin"),
  WithdrawalController.updateWithdrawal,
);

/*
=====================================================
SINGLE USER WITHDRAWAL
=====================================================
*/

router.get("/:id", WithdrawalController.getWithdrawal);

module.exports = router;
