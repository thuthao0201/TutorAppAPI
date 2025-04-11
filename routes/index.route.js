const express = require("express");
const router = express.Router();
const protectedRoute = require("../routes/protected.route");
const authRoute = require("../routes/auth.route");
const { verifyToken } = require("../middlewares/auth.middleware");

router.use("/api", verifyToken, protectedRoute);
router.use("/auth", authRoute);

module.exports = router;
