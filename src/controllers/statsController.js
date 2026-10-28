const User = require("../models/UserModel");
const Product = require("../models/ProductsModel");
const Order = require("../models/OrderModel");
const catchAsync = require("../utils/catchAsync");

/*
|--------------------------------------------------------------------------
| GET DASHBOARD STATS
|--------------------------------------------------------------------------
*/
exports.getStats = async (req, res) => {
  try {
    // ================= COUNTS =================
    const totalUsers = await User.countDocuments();
    const totalProducts = await Product.countDocuments();
    const totalOrders = await Order.countDocuments();

    // ================= ORDER STATUS =================
    const pendingOrders = await Order.countDocuments({
      orderStatus: "pending",
    });

    const processingOrders = await Order.countDocuments({
      orderStatus: "processing",
    });

    const shippedOrders = await Order.countDocuments({
      orderStatus: "shipped",
    });

    const deliveredOrders = await Order.countDocuments({
      orderStatus: "delivered",
    });

    const cancelledOrders = await Order.countDocuments({
      orderStatus: "cancelled",
    });

    // ================= PAYMENT STATUS =================
    const paidOrders = await Order.countDocuments({
      paymentStatus: "paid",
    });

    const failedPayments = await Order.countDocuments({
      paymentStatus: "failed",
    });

    // ================= REVENUE =================
    const revenue = await Order.aggregate([
      {
        $match: {
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: {
            $sum: "$totalPrice",
          },
        },
      },
    ]);

    const totalRevenue =
      revenue.length > 0 ? revenue[0].totalRevenue : 0;

    res.status(200).json({
      status: "success",
      stats: {
        totalUsers,
        totalProducts,
        totalOrders,

        pendingOrders,
        processingOrders,
        shippedOrders,
        deliveredOrders,
        cancelledOrders,

        paidOrders,
        failedPayments,

        totalRevenue,
      },
    });
  } catch (error) {
    console.error("STATS ERROR:", error);

    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};

exports.getSalesOverview = catchAsync(async (req, res) => {
  const sales = await Order.aggregate([
    {
      $match: {
        paymentStatus: "paid",
      },
    },

    {
      $group: {
        _id: {
          $dateToString: {
            format: "%Y-%m-%d",
            date: "$createdAt",
            timezone: "Africa/Lagos", // ✅ FIXED (important for Nigeria)
          },
        },
        totalSales: { $sum: "$totalPrice" },
        totalOrders: { $sum: 1 },
      },
    },

    {
      $sort: { _id: 1 },
    },
  ]);

  res.status(200).json({
    status: "success",
    results: sales.length,
    data: sales.map((item) => ({
      date: item._id,          // ✅ cleaner for frontend
      totalSales: item.totalSales,
      totalOrders: item.totalOrders,
    })),
  });
});
