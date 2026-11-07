
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../db/database");

const router = express.Router();

const COOKIE_NAME = "admin_token";

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/"
};

// ================================
// POST /auth/register
// ================================
router.post("/register", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const normalizedUsername = username.trim();

    if (
      normalizedUsername.length < 3 ||
      normalizedUsername.length > 50
    ) {
      return res.status(400).json({
        message: "Username must contain 3–50 characters"
      });
    }

    if (
      password.length < 12 ||
      Buffer.byteLength(password, "utf8") > 72
    ) {
      return res.status(400).json({
        message: "Password must be at least 12 characters and at most 72 UTF-8 bytes"
      });
    }

    const existingUser = db.prepare(`
      SELECT id
      FROM users
      WHERE username = ?
    `).get(normalizedUsername);

    if (existingUser) {
      return res.status(409).json({
        message: "Username already exists"
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();

    const result = db.prepare(`
      INSERT INTO users (
        username,
        password_hash,
        role,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?)
    `).run(
      normalizedUsername,
      passwordHash,
      "user",
      now,
      now
    );

    return res.status(201).json({
      message: "Registration successful",
      user: {
        id: Number(result.lastInsertRowid),
        username: normalizedUsername,
        role: "user"
      }
    });

  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({
        message: "Username already exists"
      });
    }

    console.error("Registration error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// ================================
// POST /auth/login
// ================================
router.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body ?? {};

    if (
      typeof username !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Username and password are required"
      });
    }

    const user = db.prepare(`
      SELECT id, username, password_hash, role
      FROM users
      WHERE username = ?
    `).get(username.trim());

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const passwordValid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordValid) {
      return res.status(401).json({
        message: "Invalid username or password"
      });
    }

    const token = jwt.sign(
      { role: user.role },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        subject: String(user.id),
        issuer: "personal-blog",
        audience: "blog-admin",
        expiresIn: "1h"
      }
    );

    res.cookie(COOKIE_NAME, token, {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 1000
    });

    return res.json({
      message: "Login successful",
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });

  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// ================================
// POST /auth/logout
// ================================
router.post("/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, COOKIE_OPTIONS);

  return res.json({
    message: "Logout successful"
  });
});

// ================================
// GET /auth/me
// ================================
router.get("/me", (req, res) => {
  const token = req.cookies?.[COOKIE_NAME];

  if (!token) {
    return res.status(401).json({
      message: "Authentication required"
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET,
      {
        algorithms: ["HS256"],
        issuer: "personal-blog",
        audience: "blog-admin"
      }
    );

    const userId = Number(decoded.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({
        message: "Invalid token"
      });
    }

    const user = db.prepare(`
      SELECT id, username, role
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(401).json({
        message: "User not found"
      });
    }

    return res.json({
      authenticated: true,
      user
    });

  } catch (error) {
    if (
      error.name === "JsonWebTokenError" ||
      error.name === "TokenExpiredError" ||
      error.name === "NotBeforeError"
    ) {
      return res.status(401).json({
        message: "Invalid or expired token"
      });
    }

    console.error("Session validation error:", error);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

module.exports = router;
