const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
  try {
    const token = req.header("Authorization").replace("Bearer ", "");
    if (!token) return res.status(401).send("Access Denied");

    const verified = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).send("Invalid Token");
  }
};

module.exports = { verifyToken };
