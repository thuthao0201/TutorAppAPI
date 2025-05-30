const express = require("express");
const router = express.Router();
const {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  changeAvatar,
  changeInformation,
  changePassword,
  getInformation,
  getStudentStats,
} = require("../controllers/user.controller");
const { isAdmin, isOwnerOrAdmin } = require("../middlewares/role.middleware");
const upload = require("../configs/multer");

router.get("/stats", getStudentStats);
router.post("/", isAdmin, createUser);
router.get("/information", getInformation);
router.get("/:id", isOwnerOrAdmin, getUser);
router.get("/", isAdmin, getUsers);
router.patch("/avatar", isOwnerOrAdmin, upload.single("avatar"), changeAvatar);
router.patch("/information", isOwnerOrAdmin, changeInformation);
router.patch("/password", isOwnerOrAdmin, changePassword);
router.patch("/:id", isOwnerOrAdmin, updateUser);
router.delete("/:id", isAdmin, deleteUser);

module.exports = router;
