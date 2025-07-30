const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const dotenv = require("dotenv");
const setupSocket = require("./socketlogic/socket.js");
const connectDB = require("./config/db.js");

dotenv.config();
connectDB();
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
    },
});

const corsOptions = {
    origin: "*",
    credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

setupSocket(io);
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});