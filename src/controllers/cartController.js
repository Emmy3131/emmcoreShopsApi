
const Cart = require("../models/CartModel");
const Product = require("../models/ProductsModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/*
=====================================================
GET PRODUCT ID SAFELY
=====================================================

Handles:
- Normal MongoDB ObjectId references
- Populated product documents
- Null product references
=====================================================
*/

const getProductId = (item) => {
  if (!item || !item.product) {
    return null;
  }

  const productId = item.product._id || item.product;

  if (!productId) {
    return null;
  }

  return productId.toString();
};

/*
=====================================================
GET CURRENT PRODUCT PRICE
=====================================================
*/

const getCurrentProductPrice = (product) => {
  const flashSaleEnd =
    product.flashSaleEndAt || product.flashSaleEnd;

  const isFlashSaleActive =
    product.isFlashSale === true &&
    Number(product.flashSalePrice) > 0 &&
    flashSaleEnd &&
    new Date(flashSaleEnd) > new Date();

  return Number(
    isFlashSaleActive ? product.flashSalePrice : product.price
  );
};

/*
=====================================================
CALCULATE CART TOTALS
=====================================================
*/

const calculateCartTotals = (cart) => {
  cart.totalItems = 0;
  cart.totalPrice = 0;

  for (const item of cart.items) {
    const quantity = Number(item.quantity) || 0;
    const price = Number(item.price) || 0;

    cart.totalItems += quantity;
    cart.totalPrice += quantity * price;
  }

  cart.totalPrice = Number(cart.totalPrice.toFixed(2));
};

/*
=====================================================
SYNC CART PRICES
=====================================================

1. Remove null product references.
2. Find all existing products.
3. Remove deleted products.
4. Update product information.
5. Recalculate cart totals.
=====================================================
*/

const syncCartPrices = async (cart) => {
  if (!cart || !Array.isArray(cart.items)) {
    return;
  }

  /*
  =====================================
  REMOVE INVALID REFERENCES
  =====================================
  */

  cart.items = cart.items.filter((item) => {
    return Boolean(getProductId(item));
  });

  if (cart.items.length === 0) {
    calculateCartTotals(cart);
    return;
  }

  /*
  =====================================
  COLLECT PRODUCT IDS
  =====================================
  */

  const productIds = [
    ...new Set(
      cart.items.map((item) => getProductId(item))
    ),
  ];

  /*
  =====================================
  FETCH PRODUCTS
  =====================================
  */

  const products = await Product.find({
    _id: { $in: productIds },
  });

  /*
  =====================================
  CREATE PRODUCT MAP
  =====================================
  */

  const productMap = new Map(
    products.map((product) => [
      product._id.toString(),
      product,
    ])
  );

  /*
  =====================================
  UPDATE CART ITEMS
  =====================================
  */

  const validItems = [];

  for (const item of cart.items) {
    const productId = getProductId(item);

    const product = productMap.get(productId);

    // Product may have been deleted.
    if (!product) {
      continue;
    }

    // Product must still be active.
    if (product.isActive === false || product.active === false) {
      continue;
    }

    const currentPrice = getCurrentProductPrice(product);

    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
      continue;
    }

    item.name = product.name;
    item.image = product.image;
    item.price = currentPrice;

    validItems.push(item);
  }

  /*
  =====================================
  SAVE ONLY VALID ITEMS
  =====================================
  */

  cart.items = validItems;

  /*
  =====================================
  RECALCULATE TOTALS
  =====================================
  */

  calculateCartTotals(cart);
};

/*
=====================================================
ADD TO CART
=====================================================
*/

exports.addToCart = catchAsync(async (req, res, next) => {
  const { productId, quantity = 1 } = req.body;

  const userId = req.user._id;

  if (
    !productId ||
    !Number.isInteger(quantity) ||
    quantity < 1
  ) {
    return next(
      new AppError("Product and valid quantity required", 400)
    );
  }

  /*
  =====================================
  FIND PRODUCT
  =====================================
  */

  const product = await Product.findById(productId);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  if (
    product.isActive === false ||
    product.active === false
  ) {
    return next(new AppError("This product is unavailable", 400));
  }

  if (product.stock < quantity) {
    return next(
      new AppError(
        `Only ${product.stock} item(s) available`,
        400
      )
    );
  }

  /*
  =====================================
  FIND OR CREATE CART
  =====================================
  */

  let cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [],
    });
  }

  /*
  =====================================
  FIND EXISTING ITEM SAFELY
  =====================================
  */

  const existingItem = cart.items.find(
    (item) => getProductId(item) === productId.toString()
  );

  const currentPrice = getCurrentProductPrice(product);

  /*
  =====================================
  UPDATE EXISTING ITEM
  =====================================
  */

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > product.stock) {
      return next(
        new AppError(
          `Only ${product.stock} item(s) available`,
          400
        )
      );
    }

    existingItem.quantity = newQuantity;
    existingItem.price = currentPrice;
  } else {
    /*
    =====================================
    ADD NEW ITEM
    =====================================
    */

    cart.items.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: currentPrice,
      quantity,
    });
  }

  await syncCartPrices(cart);

  await cart.save();

  return res.status(200).json({
    status: "success",
    message: "Product added to cart",
    data: cart,
  });
});

/*
=====================================================
GET CART
=====================================================
*/

exports.getCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return res.status(200).json({
      status: "success",
      data: {
        items: [],
        totalItems: 0,
        totalPrice: 0,
      },
    });
  }

  await syncCartPrices(cart);

  await cart.save();

  return res.status(200).json({
    status: "success",
    data: cart,
  });
});

/*
=====================================================
UPDATE CART ITEM
=====================================================

quantity is treated as an adjustment:
positive = increase
negative = decrease
zero = invalid
=====================================================
*/

exports.updateCartItem = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (
    !productId ||
    !Number.isInteger(quantity) ||
    quantity === 0
  ) {
    return next(
      new AppError("Invalid product or quantity", 400)
    );
  }

  /*
  =====================================
  FIND CART
  =====================================
  */

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  /*
  =====================================
  FIND ITEM SAFELY
  =====================================
  */

  const item = cart.items.find(
    (cartItem) => getProductId(cartItem) === productId
  );

  if (!item) {
    return next(new AppError("Item not in cart", 404));
  }

  /*
  =====================================
  FIND PRODUCT
  =====================================
  */

  const product = await Product.findById(productId);

  if (!product) {
    cart.items = cart.items.filter(
      (cartItem) => getProductId(cartItem) !== productId
    );

    await syncCartPrices(cart);
    await cart.save();

    return next(
      new AppError(
        "This product no longer exists and has been removed from your cart",
        404
      )
    );
  }

  /*
  =====================================
  CALCULATE NEW QUANTITY
  =====================================
  */

  const newQuantity = item.quantity + quantity;

  /*
  =====================================
  REMOVE ITEM IF QUANTITY IS ZERO OR LESS
  =====================================
  */

  if (newQuantity < 1) {
    cart.items = cart.items.filter(
      (cartItem) => getProductId(cartItem) !== productId
    );
  } else {
    /*
    =====================================
    CHECK STOCK
    =====================================
    */

    if (newQuantity > product.stock) {
      return next(
        new AppError(
          `Only ${product.stock} item(s) available`,
          400
        )
      );
    }

    item.quantity = newQuantity;
    item.price = getCurrentProductPrice(product);
  }

  await syncCartPrices(cart);

  await cart.save();

  return res.status(200).json({
    status: "success",
    message: "Cart updated",
    data: cart,
  });
});

/*
=====================================================
REMOVE FROM CART
=====================================================
*/

exports.removeFromCart = catchAsync(async (req, res, next) => {
  const productId = req.params.id;

  if (!productId) {
    return next(new AppError("Product ID is required", 400));
  }

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  /*
  =====================================
  REMOVE ITEM SAFELY
  =====================================
  */

  cart.items = cart.items.filter(
    (item) => getProductId(item) !== productId
  );

  await syncCartPrices(cart);

  await cart.save();

  return res.status(200).json({
    status: "success",
    message: "Item removed",
    data: cart,
  });
});

/*
=====================================================
CLEAR CART
=====================================================
*/

exports.clearCart = catchAsync(async (req, res, next) => {
  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return res.status(200).json({
      status: "success",
      message: "Cart already empty",
    });
  }

  cart.items = [];
  cart.totalItems = 0;
  cart.totalPrice = 0;

  await cart.save();

  return res.status(200).json({
    status: "success",
    message: "Cart cleared",
  });
});
