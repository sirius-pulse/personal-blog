require("dotenv").config();
// const jwt = require("jsonwebtoken");
// const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
// const requireAuth = require("./middleware/requireAuth");
// const requireAdmin = require("./middleware/requireAdmin");

const authRoutes = require("./routes/auth");
const articleRoutes = require("./routes/articles");

if (!process.env.JWT_SECRET) {
    throw new Error("Missing authentication environment variables");
}

const express = require("express");
const cors = require("cors");


const app = express();
const PORT = 3000;

//define allowed URL to access the backend API
app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

app.use(express.json());
app.use(cookieParser());

// Authentication endpoints
app.use("/auth", authRoutes);

// Article endpoints
app.use("/", articleRoutes);

// Unknown API route
app.use((req, res) => {
    res.status(404).json({
        message: "Endpoint not found."
    });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
});