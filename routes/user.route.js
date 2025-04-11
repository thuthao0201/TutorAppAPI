const express = require("express");
const router = express.Router();
const {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
} = require("../controllers/user.controller");
const { isAdmin, isOwnerOrAdmin } = require("../middlewares/role.middleware");

router.post("/", isAdmin, createUser);
router.get("/:id", isOwnerOrAdmin, getUser);
router.get("/", isAdmin, getUsers);
router.patch("/:id", isOwnerOrAdmin, updateUser);
router.delete("/:id", isAdmin, deleteUser);

module.exports = router;
