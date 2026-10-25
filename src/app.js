
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const hpp = require("hpp");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");

const AppError = require("./utils/appError");
const globalErrorHandler = require("./controllers/globalErrorController");

const productRoutes = require("./routes/productsRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const userRoutes = require("./routes/userRoutes");

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
  })
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

    return callback(
      new AppError("Origin not allowed by CORS", 403)
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
  ],

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
  })
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

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "EmmCoreShops API is running",
  });
});

/* =====================================================
   ROOT ROUTE
===================================================== */

app.get("/", (req, res) => {
  res.status(200).json({
    status: "success",
    message: "Welcome to EmmCoreShops API",
    health: "/api/health",
  });
});

/* =====================================================
   API ROUTES
===================================================== */

app.use("/api/v1/products", productRoutes);
app.use("/api/v1/categories", categoryRoutes);
app.use("/api/v1/users", userRoutes);

/* =====================================================
   NOT FOUND
===================================================== */

app.use((req, res, next) => {
  next(
    new AppError(
      `Cannot find ${req.originalUrl} on this server`,
      404
    )
  );
});

/* =====================================================
   GLOBAL ERROR HANDLER
===================================================== */

app.use(globalErrorHandler);

module.exports = app;
