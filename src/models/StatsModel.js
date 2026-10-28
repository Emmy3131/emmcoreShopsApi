const mongoose = require("mongoose");

const statsSchema = new mongoose.Schema(
  {
    // USERS
    totalUsers: {
      type: Number,
      default: 0,
    },

    // PRODUCTS
    totalProducts: {
      type: Number,
      default: 0,
    },

    // ORDERS
    totalOrders: {
      type: Number,
      default: 0,
    },

    pendingOrders: {
      type: Number,
      default: 0,
    },

    processingOrders: {
      type: Number,
      default: 0,
    },

    shippedOrders: {
      type: Number,
      default: 0,
    },

    deliveredOrders: {
      type: Number,
      default: 0,
    },

    cancelledOrders: {
      type: Number,
      default: 0,
    },

    // PAYMENT
    paidOrders: {
      type: Number,
      default: 0,
    },

    failedPayments: {
      type: Number,
      default: 0,
    },

    // REVENUE
    totalRevenue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Stats", statsSchema);