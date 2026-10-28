const Cart = require("../models/CartModel");
const Product = require("../models/ProductsModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");

/*
=====================================================
GET CURRENT PRODUCT PRICE
=====================================================
*/

const getCurrentProductPrice = (product) => {
  const isFlashSaleActive =
    product.isFlashSale &&
    product.flashSalePrice &&
    product.flashSaleEndAt &&
    new Date(product.flashSaleEndAt) > new Date();

  return isFlashSaleActive ? product.flashSalePrice : product.price;
};

/*
=====================================================
CALCULATE CART TOTALS
=====================================================
*/

const calculateCartTotals = (cart) => {
  cart.totalItems = 0;
  cart.totalPrice = 0;

  cart.items.forEach((item) => {
    cart.totalItems += item.quantity;

    cart.totalPrice += item.quantity * item.price;
  });
};

/*
=====================================================
SYNC CART PRICES
=====================================================
*/

const syncCartPrices = async (cart) => {
  const productIds = cart.items.map((item) => item.product);

  const products = await Product.find({
    _id: { $in: productIds },
  });

  const productMap = new Map(
    products.map((product) => [product._id.toString(), product]),
  );

  for (const item of cart.items) {
    const product = productMap.get(item.product.toString());

    if (!product) continue;

    item.name = product.name;
    item.image = product.image;
    item.price = getCurrentProductPrice(product);
  }

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

  if (!productId || !Number.isInteger(quantity) || quantity < 1) {
    return next(new AppError("Product and valid quantity required", 400));
  }

  const product = await Product.findById(productId);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  if (product.stock < quantity) {
    return next(new AppError(`Only ${product.stock} item(s) available`, 400));
  }

  let cart = await Cart.findOne({
    user: userId,
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      items: [],
    });
  }

  const existingItem = cart.items.find(
    (item) => item.product.toString() === productId,
  );

  const currentPrice = getCurrentProductPrice(product);

  if (existingItem) {
    const newQuantity = existingItem.quantity + quantity;

    if (newQuantity > product.stock) {
      return next(new AppError(`Only ${product.stock} item(s) available`, 400));
    }

    existingItem.quantity = newQuantity;

    existingItem.price = currentPrice;
  } else {
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

  res.status(200).json({
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
  }).populate("items.product");

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

  res.status(200).json({
    status: "success",
    data: cart,
  });
});

/*
=====================================================
UPDATE CART ITEM
=====================================================
*/

exports.updateCartItem = catchAsync(async (req, res, next) => {
  const { productId, quantity } = req.body;

  if (!productId || !Number.isInteger(quantity)) {
    return next(new AppError("Invalid product or quantity", 400));
  }

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  const item = cart.items.find((item) => item.product.toString() === productId);

  if (!item) {
    return next(new AppError("Item not in cart", 404));
  }

  const product = await Product.findById(productId);

  if (!product) {
    return next(new AppError("Product not found", 404));
  }

  const newQuantity = item.quantity + quantity;

  if (newQuantity > product.stock) {
    return next(new AppError(`Only ${product.stock} item(s) available`, 400));
  }

  if (newQuantity < 1) {
    cart.items = cart.items.filter(
      (cartItem) => cartItem.product.toString() !== productId,
    );
  } else {
    item.quantity = newQuantity;

    item.price = getCurrentProductPrice(product);
  }

  await syncCartPrices(cart);

  await cart.save();

  res.status(200).json({
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

  const cart = await Cart.findOne({
    user: req.user._id,
  });

  if (!cart) {
    return next(new AppError("Cart not found", 404));
  }

  cart.items = cart.items.filter(
    (item) => item.product.toString() !== productId,
  );

  await syncCartPrices(cart);

  await cart.save();

  res.status(200).json({
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

  res.status(200).json({
    status: "success",
    message: "Cart cleared",
  });
});
