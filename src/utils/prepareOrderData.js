const Product = require("../model/ProductModel");
const AppError = require("./appError");

/*
=====================================================
PREPARE ORDER DATA
=====================================================
*/

const prepareOrderData = async (cart) => {
  let totalPrice = 0;

  const orderItems = [];

  for (const item of cart.items) {
    const product = await Product.findById(item.product);

    if (!product) {
      throw new AppError(`Product not found: ${item.name}`, 404);
    }

    /*
    =====================================================
    CHECK STOCK
    =====================================================
    */

    if (product.stock < item.quantity) {
      throw new AppError(
        `${product.name} does not have enough stock`,
        400,
      );
    }

    /*
    =====================================================
    DETERMINE PRODUCT PRICE
    =====================================================
    */

    const now = new Date();

    const isFlashSaleActive =
      product.isFlashSale &&
      product.flashSalePrice &&
      product.flashSaleEndAt &&
      new Date(product.flashSaleEndAt) > now;

    const finalPrice = isFlashSaleActive
      ? product.flashSalePrice
      : product.price;

    /*
    =====================================================
    CALCULATE TOTAL
    =====================================================
    */

    const itemTotal = finalPrice * item.quantity;

    totalPrice += itemTotal;

    /*
    =====================================================
    SAVE PRICE AT TIME OF ORDER
    =====================================================
    */

    orderItems.push({
      product: product._id,
      name: product.name,
      image: product.image,
      price: finalPrice,
      quantity: item.quantity,
    });
  }

  return {
    orderItems,
    totalPrice,
  };
};

module.exports = prepareOrderData;