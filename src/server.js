
require("dotenv").config();

const app = require("./app");
const connectDB = require("./config/db");

let dbConnectionPromise;

function ensureDBConnection() {
  if (!dbConnectionPromise) {
    dbConnectionPromise = connectDB().catch((error) => {
      dbConnectionPromise = null;
      throw error;
    });
  }

  return dbConnectionPromise;
}

async function handleRequest(req, res) {
  try {
    await ensureDBConnection();
    return app(req, res);
  } catch (error) {
    console.error("Request startup failed:", error);

    if (!res.headersSent) {
      return res.status(500).json({
        status: "error",
        message: "Server or database connection failed",
      });
    }
  }
}

// Local development
if (require.main === module) {
  const PORT = process.env.PORT || 5000;

  ensureDBConnection()
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

module.exports = handleRequest;
