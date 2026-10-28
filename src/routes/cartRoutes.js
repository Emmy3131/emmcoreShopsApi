const express = require("express");
const router = express.Router();
const CartController = require("../controllers/cartController");
const authController = require("../controllers/authController");

//Protect all routes after this middleware
router.use(authController.protect);



// CREATE + GET
router
  .route("/")
  .get(CartController.getCart)
  .post(CartController.addToCart)
  .delete(CartController.clearCart);
// UPDATE + DELETE
router
  .route("/:id")
  // .patch(CartController.updateCartItem)
  .delete(CartController.removeFromCart);

router.patch("/update", CartController.updateCartItem);



module.exports = router;