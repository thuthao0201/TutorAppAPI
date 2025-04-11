const express = require("express");
const router = express.Router();

const {
  register,
  login,
  refreshToken,
} = require("../controllers/auth.controller");

router.post("/register", register);
router.post("/login", login);
router.post("/refresh-token", refreshToken);

module.exports = router;
