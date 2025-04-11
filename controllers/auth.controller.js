const User = require("../models/user.model");
const {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} = require("../utils/auth.util");
const jwt = require("jsonwebtoken");

const register = async (req, res) => {
  const { name, email, password, phone } = req.body;

  try {
    const userExists = await User.exists({ email });
    if (userExists) {
      return res.status(400).json({
        status: "fail",
        data: { email: "Email already exists" },
      });
    }

    const passwordHash = await hashPassword(password);

    const user = await User.create({
      name,
      email,
      password: passwordHash,
      phone,
    });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(201).json({
      status: "success",
      data: { accessToken, refreshToken, user },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      code: 500,
      data: { error: err.message },
    });
  }
};

const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        status: "fail",
        data: { email: "Email not found" },
      });
    }

    const validPass = await comparePassword(password, user.password);
    if (!validPass) {
      return res.status(400).json({
        status: "fail",
        data: { password: "Password is incorrect" },
      });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    user.refreshToken = refreshToken;
    await user.save();

    res.status(200).json({
      status: "success",
      data: { accessToken, refreshToken, user },
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Internal Server Error",
      code: 500,
      data: { error: err.message },
    });
  }
};

const refreshToken = async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({
      status: "fail",
      data: { message: "Access Denied" },
    });
  }

  try {
    const verified = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(verified._id);

    if (!user || user.refreshToken !== refreshToken) {
      return res.status(403).json({
        status: "fail",
        data: { message: "Invalid refresh token" },
      });
    }
    const newAccessToken = generateAccessToken(user);
    res.json({
      status: "success",
      data: { accessToken: newAccessToken },
    });
  } catch (err) {
    res.status(400).json({
      status: "fail",
      data: { message: "Invalid refresh token" },
    });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
};
