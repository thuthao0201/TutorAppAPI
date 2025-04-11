const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const db = require("./configs/db");
const morgan = require("morgan");
dotenv.config();

db.connect();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(morgan("dev"));

app.use("/uploads", express.static(__dirname + "/uploads"));

app.use("/", require("./routes/index.route"));

app.listen(3000, () => {
  console.log("Server is running at port 3000");
});
