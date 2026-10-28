const Cart = require("../models/CartModel");
const Product = require("../models/ProductsModel");
const Order = require("../models/OrderModel");

const catchAsync = require("../utils/catchAsync");
const AppError = require("../utils/appError");
const prepareOrderData = require("../utils/prepareOrderData");
const Email = require("../utils/email");
const referralServices = require("../services/ReferralServices");

const crypto = require("crypto");

/*
=====================================================
COMPLETE SUCCESSFUL PAYMENT
=====================================================

This helper is used by:

1. Paystack Webhook
2. Manual Payment Verification

It prevents duplicated payment processing.
*/

const completeSuccessfulPayment = async (reference) => {
  /*
  =====================================================
  FIND ORDER
  =====================================================
  */

  const order = await Order.findOne({
    "paymentResult.reference": reference,
  });

  if (!order) {
    throw new Error(`Order not found for reference: ${reference}`);
  }

  /*
  =====================================================
  PREVENT DUPLICATE PROCESSING
  =====================================================
  */

  if (order.paymentStatus === "paid") {
    return {
      order,
      alreadyProcessed: true,
    };
  }

  /*
  =====================================================
  CHECK STOCK
  =====================================================
  */

  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);

    if (!product) {
      throw new Error(`Product not found: ${item.name}`);
    }

    if (product.stock < item.quantity) {
      throw new Error(`${product.name} does not have enough stock`);
    }
  }

  /*
  =====================================================
  REDUCE STOCK
  =====================================================
  */

  for (const item of order.orderItems) {
    const product = await Product.findById(item.product);

    product.stock -= item.quantity;

    await product.save();
  }

  /*
  =====================================================
  MARK ORDER AS PAID
  =====================================================
  */

  order.paymentStatus = "paid";

  order.orderStatus = "processing";

  order.isPaid = true;

  order.paidAt = Date.now();

  await order.save();

  console.log("ORDER MARKED AS PAID:", order._id.toString());

  /*
  =====================================================
  PROCESS REFERRAL BONUS
  =====================================================

  IMPORTANT:

  This happens only after successful payment.

  The referral service checks:

  1. Is there a referral?
  2. Is the order amount high enough?
  3. Has the bonus already been paid?
  4. Credit the referrer's wallet.
  =====================================================
  */

  try {
    const referral = await referralServices.processOrderReferral({
      userId: order.user,
      orderId: order._id,
      orderAmount: order.totalPrice,
    });

    if (referral) {
      console.log("REFERRAL BONUS PROCESSED:", referral._id.toString());
    } else {
      console.log("NO REFERRAL BONUS WAS PROCESSED FOR THIS ORDER.");
    }
  } catch (error) {
    /*
    =====================================================
    IMPORTANT
    =====================================================

    Do not make a successful customer payment appear
    failed because referral processing failed.

    Log the error so it can be fixed/reprocessed.
    =====================================================
    */

    console.error("REFERRAL BONUS PROCESSING FAILED:", error);
  }

  /*
  =====================================================
  CLEAR CART
  =====================================================
  */

  await Cart.deleteMany({
    user: order.user,
  });

  console.log("PAYMENT COMPLETED SUCCESSFULLY:", reference);

  console.log("CART CLEARED FOR USER:", order.user);

  /*
  =====================================================
  RETURN
  =====================================================
  */

  return {
    order,
    alreadyProcessed: false,
  };
};

/*
=====================================================
GET ALL ORDERS
=====================================================
*/

exports.getAllOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find()
    .populate("user", "firstName lastName email")
    .populate("orderItems.product")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",
    results: orders.length,
    data: orders,
  });
});

/*
=====================================================
GET SINGLE ORDER
=====================================================
*/

exports.getOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id)
    .populate("user", "firstName lastName email")
    .populate("orderItems.product");

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.status(200).json({
    status: "success",
    data: order,
  });
});

/*
=====================================================
CREATE PAYSTACK CHECKOUT SESSION
=====================================================
*/

exports.getCheckoutSession = catchAsync(async (req, res, next) => {
  const userId = req.user._id;

  /*
  =====================================================
  GET CART
  =====================================================
  */

  const cart = await Cart.findOne({
    user: userId,
  });

  if (!cart || cart.items.length === 0) {
    return next(new AppError("Cart is empty", 400));
  }

  /*
  =====================================================
  PREPARE ORDER DATA
  =====================================================
  */

  const { orderItems, totalPrice } = await prepareOrderData(cart);

  /*
  =====================================================
  PAYSTACK PAYLOAD
  =====================================================
  */

  const payload = {
    email: req.user.email,

    amount: Math.round(totalPrice * 100),

    callback_url: `${process.env.FRONTEND_URL}/payment-success`,

    metadata: {
      userId: userId.toString(),

      orderItems,

      shippingAddress: req.body.shippingAddress,

      totalPrice,
    },
  };

  /*
  =====================================================
  INITIALIZE PAYSTACK
  =====================================================
  */

  const response = await fetch(
    "https://api.paystack.co/transaction/initialize",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",

        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY_TEST}`,
      },

      body: JSON.stringify(payload),
    },
  );

  const data = await response.json();

  if (!response.ok || !data.status) {
    return next(
      new AppError(
        data.message || "Payment initialization failed",

        500,
      ),
    );
  }

  /*
  =====================================================
  CREATE PENDING ORDER
  =====================================================
  */

  await Order.create({
    user: userId,

    orderItems,

    shippingAddress: req.body.shippingAddress,

    paymentMethod: "paystack",

    paymentStatus: "pending",

    orderStatus: "pending",

    itemsPrice: totalPrice,

    taxPrice: 0,

    shippingPrice: 0,

    totalPrice,

    paymentResult: {
      reference: data.data.reference,
    },
  });

  /*
  =====================================================
  SEND PAYMENT URL
  =====================================================
  */

  res.status(200).json({
    status: "success",

    data: {
      authorizationUrl: data.data.authorization_url,

      accessCode: data.data.access_code,

      reference: data.data.reference,
    },
  });
});

/*
=====================================================
PAYSTACK WEBHOOK
=====================================================
*/

exports.handlePayStackWebhook = async (req, res) => {
  try {
    const signature = req.headers["x-paystack-signature"];

    /*
    =====================================================
    BODY MUST BE BUFFER
    =====================================================
    */

    const rawBody = req.body;

    if (!Buffer.isBuffer(rawBody)) {
      console.error("Paystack webhook body is not a Buffer");

      return res.sendStatus(400);
    }

    /*
    =====================================================
    VERIFY SIGNATURE
    =====================================================
    */

    const hash = crypto
      .createHmac(
        "sha512",

        process.env.PAYSTACK_SECRET_KEY_TEST,
      )
      .update(rawBody)
      .digest("hex");

    if (hash !== signature) {
      console.error("Invalid Paystack webhook signature");

      return res.sendStatus(401);
    }

    /*
    =====================================================
    PARSE EVENT
    =====================================================
    */

    const event = JSON.parse(rawBody.toString());

    /*
    =====================================================
    SUCCESSFUL PAYMENT
    =====================================================
    */

    if (event.event === "charge.success") {
      const reference = event.data.reference;

      await completeSuccessfulPayment(reference);

      return res.sendStatus(200);
    }

    /*
    =====================================================
    FAILED PAYMENT
    =====================================================
    */

    if (event.event === "charge.failed") {
      const reference = event.data.reference;

      await Order.findOneAndUpdate(
        {
          "paymentResult.reference": reference,
        },

        {
          paymentStatus: "failed",
        },
      );

      return res.sendStatus(200);
    }

    return res.sendStatus(200);
  } catch (error) {
    console.error("Paystack webhook error:", error);

    /*
    IMPORTANT:
    Always respond to Paystack.
    */

    return res.sendStatus(200);
  }
};

/*
=====================================================
VERIFY PAYMENT
=====================================================
*/

exports.verifyPayment = catchAsync(async (req, res, next) => {
  const { reference } = req.query;

  if (!reference) {
    return next(new AppError("Payment reference missing", 400));
  }

  /*
    =====================================================
    VERIFY WITH PAYSTACK
    =====================================================
    */

  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,

    {
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY_TEST}`,
      },
    },
  );

  const data = await response.json();
  console.log("Paystack Verify Response");

  console.log(data);

  if (!response.ok || !data.status) {
    return next(new AppError("Payment verification failed", 400));
  }

  /*
    =====================================================
    ONLY COMPLETE PAYMENT IF SUCCESSFUL
    =====================================================
    */

  if (data.data.status === "success") {
    console.log("Completing order...");
    await completeSuccessfulPayment(reference);
  }
  console.log("Order completed");

  /*
    =====================================================
    RESPONSE
    =====================================================
    */

  res.status(200).json({
    status: "success",

    data: {
      ...data.data,

      paymentCompleted: data.data.status === "success",
    },
  });
});

/*
=====================================================
UPDATE ORDER STATUS
=====================================================
*/

exports.updateOrderStatus = catchAsync(async (req, res, next) => {
  const order = await Order.findById(req.params.id).populate(
    "user",

    "firstName lastName email",
  );

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  const newStatus = req.body.orderStatus;

  if (!newStatus) {
    return next(new AppError("Order status is required", 400));
  }

  /*
    =====================================================
    UPDATE STATUS
    =====================================================
    */

  order.orderStatus = newStatus;

  /*
    =====================================================
    DELIVERED
    =====================================================
    */

  if (newStatus === "delivered") {
    order.isDelivered = true;

    order.deliveredAt = Date.now();
  }

  /*
    =====================================================
    CANCELLED
    =====================================================
    */

  if (newStatus === "cancelled") {
    order.isDelivered = false;
  }

  await order.save();

  /*
    =====================================================
    EMAIL DETAILS
    =====================================================
    */

  let subject = "Order Status Updated";

  let message = `
Hello ${order.user.firstName},

Your order status has been updated.

Order ID: ${order._id}

Current Status: ${newStatus}

Thank you for shopping with us.
`;

  /*
    =====================================================
    PROCESSING
    =====================================================
    */

  if (newStatus === "processing") {
    subject = "Your Order is Being Processed";

    message = `
Hello ${order.user.firstName},

Great news! 🎉

We've started preparing your order.

Order ID: ${order._id}

Current Status: Processing

We'll notify you again once your order has been shipped.

Thank you for shopping with us.
`;
  }

  /*
    =====================================================
    SHIPPED
    =====================================================
    */

  if (newStatus === "shipped") {
    subject = "Your Order Has Been Shipped";

    message = `
Hello ${order.user.firstName},

Your order has been shipped and is on its way.

Order ID: ${order._id}

Current Status: Shipped

Please keep an eye on your phone and email for delivery updates.

Thank you for shopping with us.
`;
  }

  /*
    =====================================================
    DELIVERED
    =====================================================
    */

  if (newStatus === "delivered") {
    subject = "Order Delivered";

    message = `
Hello ${order.user.firstName},

Your order has been delivered successfully.

Order ID: ${order._id}

We hope you enjoy your purchase.

Thank you for choosing our store. ❤️
`;
  }

  /*
    =====================================================
    CANCELLED
    =====================================================
    */

  if (newStatus === "cancelled") {
    subject = "Order Cancelled";

    message = `
Hello ${order.user.firstName},

Your order has been cancelled.

Order ID: ${order._id}

If you did not request this cancellation, please contact our support team.

Thank you.
`;
  }

  /*
    =====================================================
    SEND EMAIL
    =====================================================
    */

  try {
    const email = new Email(order.user);

    await email.send(subject, message);

    console.log("Order status email sent");
  } catch (error) {
    console.error("Email sending failed:", error);
  }

  res.status(200).json({
    status: "success",

    data: order,
  });
});

/*
=====================================================
DELETE ORDER
=====================================================
*/

exports.deleteOrder = catchAsync(async (req, res, next) => {
  const order = await Order.findByIdAndDelete(req.params.id);

  if (!order) {
    return next(new AppError("Order not found", 404));
  }

  res.status(200).json({
    status: "success",

    message: "Order deleted successfully",
  });
});

/*
=====================================================
GET MY ORDERS
=====================================================
*/

exports.getMyOrders = catchAsync(async (req, res, next) => {
  const orders = await Order.find({
    user: req.user._id,
  })
    .populate("orderItems.product")
    .sort("-createdAt");

  res.status(200).json({
    status: "success",

    results: orders.length,

    data: orders,
  });
});
