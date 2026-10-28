const Order = require("../models/OrderModel");
const User = require("../models/UserModel");
const Product = require("../models/ProductsModel");

const catchAsync = require("../utils/catchAsync");

const { exportCSV } = require("../utils/reports/exportsCSV");
const { exportExcel } = require("../utils/reports/exportExcel");
const { exportPDF } = require("../utils/reports/exportPDF");

/*
=====================================================
REPORT SUMMARY
=====================================================
*/

exports.getReportSummary = catchAsync(async (req, res) => {
  const totalOrders = await Order.countDocuments();

  const totalUsers = await User.countDocuments();

  const sales = await Order.aggregate([
    {
      $match: {
        status: {
          $in: ["paid", "completed", "delivered"],
        },
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

  const totalRevenue = sales[0]?.totalRevenue || 0;

  const totalProducts = await Product.countDocuments();

  res.status(200).json({
    status: "success",

    data: {
      totalOrders,

      totalUsers,

      totalProducts,

      totalRevenue,
    },
  });
});

/*
=====================================================
MONTHLY SALES CHART
=====================================================
*/

exports.getSalesReport = catchAsync(async (req, res) => {
  const sales = await Order.aggregate([
    {
      $match: {
        status: {
          $in: ["paid", "completed", "delivered"],
        },
      },
    },

    {
      $group: {
        _id: {
          month: {
            $month: "$createdAt",
          },

          year: {
            $year: "$createdAt",
          },
        },

        revenue: {
          $sum: "$totalPrice",
        },

        orders: {
          $sum: 1,
        },
      },
    },

    {
      $sort: {
        "_id.year": 1,
        "_id.month": 1,
      },
    },
  ]);

  const months = [
    "",
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const formatted = sales.map((item) => ({
    month: months[item._id.month],

    revenue: item.revenue,

    orders: item.orders,
  }));

  res.status(200).json({
    status: "success",

    data: formatted,
  });
});

/*
=====================================================
TOP SELLING PRODUCTS
=====================================================
*/

exports.getTopProducts = catchAsync(async (req, res) => {
  const products = await Order.aggregate([
    {
      $unwind: "$items",
    },

    {
      $group: {
        _id: "$items.product",

        totalSold: {
          $sum: "$items.quantity",
        },
      },
    },

    {
      $sort: {
        totalSold: -1,
      },
    },

    {
      $limit: 10,
    },

    {
      $lookup: {
        from: "products",

        localField: "_id",

        foreignField: "_id",

        as: "product",
      },
    },

    {
      $unwind: "$product",
    },
  ]);

  res.status(200).json({
    status: "success",

    data: products,
  });
});

/*
=====================================================
ORDER STATUS REPORT
=====================================================
*/

exports.getOrderStatusReport = catchAsync(async (req, res) => {
  const report = await Order.aggregate([
    {
      $group: {
        _id: "$status",

        count: {
          $sum: 1,
        },
      },
    },
  ]);

  res.status(200).json({
    status: "success",

    data: report,
  });
});

// exports.downloadReport = async (req, res) => {
//   try {
//     const orders = await Order.find()
//       .populate("user", "name email")
//       .sort("-createdAt");

//     let csv =
//       "Order ID,Customer,Email,Amount,Payment Status,Order Status,Date\n";

//     orders.forEach((order) => {
//       csv +=
//         `${order._id},` +
//         `${order.user?.name || ""},` +
//         `${order.user?.email || ""},` +
//         `${order.totalPrice},` +
//         `${order.paymentStatus},` +
//         `${order.orderStatus},` +
//         `${order.createdAt.toLocaleDateString()}\n`;
//     });

//     res.setHeader(
//       "Content-Disposition",
//       `attachment; filename=report-${Date.now()}.csv`,
//     );

//     res.setHeader("Content-Type", "text/csv");

//     res.status(200).send(csv);
//   } catch (err) {
//     res.status(500).json({
//       status: "error",
//       message: err.message,
//     });
//   }
// };

/*
=====================================================
DOWNLOAD REPORT
=====================================================
*/

exports.downloadReport = catchAsync(async (req, res, next) => {
  const { type = "sales", format = "xlsx", from, to } = req.query;

  let data = [];

  /*
    =========================================
    DATE FILTER
    =========================================
    */

  let dateFilter = {};

  if (from && to) {
    dateFilter.createdAt = {
      $gte: new Date(from),

      $lte: new Date(to),
    };
  }

  /*
    =========================================
    SALES REPORT
    =========================================
    */

  if (type === "sales") {
    const orders = await Order.find({
      ...dateFilter,

      paymentStatus: "paid",
    })

      .select("totalPrice paymentMethod paymentStatus createdAt")

      .lean();

    data = orders.map((order) => ({
      Date: new Date(order.createdAt).toLocaleDateString(),

      Amount: order.totalPrice,

      Payment: order.paymentMethod,

      Status: order.paymentStatus,
    }));
  }

  /*
    =========================================
    ORDERS REPORT
    =========================================
    */

  if (type === "orders") {
    const orders = await Order.find(dateFilter)

      .select("orderNumber totalPrice orderStatus paymentStatus createdAt")

      .lean();

    data = orders.map((order) => ({
      Order: order.orderNumber,

      Amount: order.totalPrice,

      OrderStatus: order.orderStatus,

      PaymentStatus: order.paymentStatus,

      Date: new Date(order.createdAt).toLocaleDateString(),
    }));
  }

  /*
    =========================================
    USERS REPORT
    =========================================
    */

  if (type === "customers") {
    const users = await User.find()

      .select("name email role createdAt")

      .lean();

    data = users.map((user) => ({
      Name: user.name,

      Email: user.email,

      Role: user.role,

      Joined: new Date(user.createdAt).toLocaleDateString(),
    }));
  }

  /*
    =========================================
    PRODUCTS REPORT
    =========================================
    */

  if (type === "products") {
    const products = await Product.find()

      .select("name price stock createdAt")

      .lean();

    data = products.map((product) => ({
      Product: product.name,

      Price: product.price,

      Stock: product.stock,

      Created: new Date(product.createdAt).toLocaleDateString(),
    }));
  }

  /*
    =========================================
    FILE EXPORT
    =========================================
    */

  const filename = `${type}-report-${Date.now()}`;

  if (format === "csv") {
    return exportCSV(data, filename, res);
  }

  if (format === "pdf") {
    return exportPDF(data, filename, res);
  }

  return exportExcel(data, filename, res);
});
