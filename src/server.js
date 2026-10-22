require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

async function handleRequest(req, res) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error("Request startup failed:", error.message);

    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        message: "Server or database connection failed",
      });
    }
  }
}

// Local development: npm run dev
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => {
      app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
        console.log(`Health: http://localhost:${PORT}/api/health`);
      });
    })
    .catch((error) => {
      console.error("Server startup failed:", error.message);
      process.exit(1);
    });
}

// Vercel uses this exported request handler.
module.exports = handleRequest;
