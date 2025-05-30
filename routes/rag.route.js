const express = require("express");
const {
  indexDocument,
  chatWithAssistant,
} = require("../controllers/rag.controller");
const upload = require("../configs/multer");

const router = express.Router();

router.post("/index", upload.single("file"), indexDocument);
router.post("/chat", chatWithAssistant);

module.exports = router;
