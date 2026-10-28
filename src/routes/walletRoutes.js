const router = require("express").Router();

const walletController = require("../controllers/walletController");

const authController = require("../controllers/authController");

router.use(authController.protect);

router.get("/", walletController.getWallet);

module.exports = router;
