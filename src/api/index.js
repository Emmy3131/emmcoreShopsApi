const app = require("./app");
const connectDB = require("./Data/DB");

module.exports = async (req, res) => {
    await connectDB();
    return app(req, res);
}