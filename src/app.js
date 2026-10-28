const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/globalErrorController");

const userRoutes = require("./routes/userRoutes");
const productRoutes = require("./routes/productsRoutes");
const orderRouter = require("./routes/orderRoutes");
const cartRouter = require("./routes/cartRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const statsRoutes = require("./routes/statsRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const heroBannerRoutes = require("./routes/heroBannerRoutes");
const pageRoutes = require("./routes/pageRoutes");
const reportRouter = require("./routes/reportRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const wishListRoutes = require("./routes/wishListRoutes");
const referralRoutes = require("./routes/referralRoutes");
const walletRoutes = require("./routes/walletRoutes");
const withdrawalRoutes = require("./routes/withdrawalRoutes");
const adminReferralRoutes = require("./routes/adminRoutes");

const app = express();

/* =====================================================
   TRUST PROXY
   Required when running behind Vercel or another proxy.
===================================================== */

app.set("trust proxy", 1);
app.set("query parser", "extended");

/* =====================================================
   SECURITY HEADERS
===================================================== */

app.use(
  helmet({
    crossOriginResourcePolicy: false,
  }),
);

/* =====================================================
   CORS CONFIGURATION
===================================================== */

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
  "https://emm-core-shops.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow requests without Origin, such as server-to-server calls.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    console.warn(`CORS rejected origin: ${origin}`);

    return callback(new AppError("Origin not allowed by CORS", 403));
  },

  credentials: true,

  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],

  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],

  optionsSuccessStatus: 204,
};

// Register CORS before rate limiting and API routes.
// This also handles browser preflight OPTIONS requests.
app.use(cors(corsOptions));

/* =====================================================
   BODY PARSING AND COOKIES
===================================================== */

app.use(cookieParser());

app.use(express.json({ limit: "1mb" }));

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);

/* =====================================================
   HTTP PARAMETER POLLUTION PROTECTION
===================================================== */

app.use(hpp());

/* =====================================================
   API RATE LIMITING
===================================================== */

const limiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,

  // Do not rate-limit CORS preflight requests.
  skip: (req) => req.method === "OPTIONS",
});

app.use("/api", limiter);

/* =====================================================
   HEALTH CHECK
===================================================== */

// app.get("/api/health", (req, res) => {
//   res.status(200).json({
//     status: "success",
//     message: "EmmCoreShops API is running",
//   });
// });

/* =====================================================
   ROOT ROUTE
===================================================== */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to EmmCoreShops API",
  });
});

/* =====================================================
   API ROUTES
===================================================== */

app.use("/api/v1/users", userRoutes);

app.use("/api/v1/products", productRoutes);

app.use("/api/v1/reports", reportRouter);

app.use("/api/v1/orders", orderRouter);

app.use("/api/v1/referrals", referralRoutes);

app.use("/api/v1/wallet", walletRoutes);

app.use("/api/v1/cart", cartRouter);

app.use("/api/v1/categories", categoryRoutes);

app.use("/api/v1/stats", statsRoutes);

app.use("/api/v1/newsletter", newsletterRoutes);

app.use("/api/v1/hero-banners", heroBannerRoutes);

app.use("/api/v1/pages", pageRoutes);

// app.use("/api/v1/vendors", vendorRoutes);

app.use("/api/v1/reviews", reviewRoutes);

app.use("/api/v1/wishlist", wishListRoutes);

app.use("/api/v1/withdrawal", withdrawalRoutes);

app.use("/api/v1/admin", adminReferralRoutes);

/* =====================================================
   NOT FOUND
===================================================== */

app.use((req, res, next) => {
  next(new AppError(`Cannot find ${req.originalUrl} on this server`, 404));
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(globalErrorHandler);

module.exports = app;
