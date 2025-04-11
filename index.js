const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const db = require("./configs/db");
dotenv.config();

db.connect();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", require("./routes/index.route"));

app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
