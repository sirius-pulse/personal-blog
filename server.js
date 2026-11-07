require("dotenv").config();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const requireAuth = require("./middleware/requireAuth");

if (
    !process.env.JWT_SECRET ||
    !process.env.ADMIN_USERNAME ||
    !process.env.ADMIN_PASSWORD_HASH
) {
    throw new Error("Missing authentication environment variables");
}

const express = require("express");
const cors = require("cors");


const app = express();
const PORT = 3000;

// dummy data
// Temporary in-memory storage
let articles = [
  {
    id: 1,
    title: "Welcome to My Blog",
    content: "This is my first blog article.",
    publishedAt: "2026-11-06",
    status: "published"
  },
  {
    id: 2,
    title: "Learning Express.js",
    content: "Today I learned about REST APIs.",
    publishedAt: "2026-11-07",
    status: "draft"
  }
];

let nextId = 3;

//define allowed URL to access the backend API
// app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

app.use(cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
}));

// app.use(express.json());
app.use(cookieParser());

// Helpers
function findArticle(id) {
    return articles.find(article => article.id === Number(id));
}

function validateArticle(body) {
    const { title, content, publishedAt, status } = body;

    if (
        typeof title !== "string" ||
        !title.trim() ||
        typeof content !== "string" ||
        !content.trim()
    ) {
        return "Title and content are required.";
    }

    if (
        typeof publishedAt !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ||  // check format YYYY-MM-DD
        Number.isNaN(Date.parse(publishedAt)) ||
        new Date(publishedAt).toISOString().slice(0, 10) !== publishedAt
    ) {
        return "A valid publication date (YYYY-MM-DD) is required.";
    }

    if (!["draft", "published"].includes(status)) {
        return "Status must be draft or published.";
    }

    return null;
}

// Authentication
app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body?? {};
    
    if (
        typeof username !== "string" ||
        typeof password !== "string"
    ) {
        return res.status(400).json({
            message: "Username and password are required"
        });
    }

    const validUsername = username === process.env.ADMIN_USERNAME;

    // password is compared against its bcrypt hash.
    // when credentials match, Express signs a JWT and sends it as an HttpOnly cookie.
    const validPassword = await bcrypt.compare(
        password,
        process.env.ADMIN_PASSWORD_HASH
    );

    if (!validUsername || !validPassword) {
        return res.status(401).json({
            message: "Invalid username or password"
        });
    }

    const token = jwt.sign(
        { role: "admin" },
        process.env.JWT_SECRET,
        {
            algorithm: "HS256",
            subject: "admin",
            issuer: "personal-blog",
            audience: "blog-admin",
            expiresIn: "1h"
        }
    );

    res.cookie("admin_token", token, {
        ...cookieOptions,
        maxAge: 60 * 60 * 1000
    });

    res.json({
        message: "Login successful",
        user: {
            username,
            role: "admin"
        }
    });
});

// determine whether the admin is already logged in when the page reloads
app.get("/auth/me", requireAuth, (req, res) => {
    res.json({
        authenticated: true,
        user: {
            username: process.env.ADMIN_USERNAME,
            role: req.admin.role
        }
    });
});


app.post("/auth/logout", (req, res) => {
  res.clearCookie("admin_token", cookieOptions);

  res.json({
    message: "Logout successful"
  });
});

// Guest Section
// GET /home  --> List published articles
app.get("/home", (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const published = articles   // filter article published before today
        .filter(article => 
            article.status === "published" &&
            article.publishedAt <= today
        )
        .sort((a, b) => 
            b.publishedAt.localeCompare(a.publishedAt)
        );
    
    res.json(published);
});

// GET /article/:pageId
// view a published article
app.get("/article/:pageId", (req, res) => {
    const article = findArticle(req.params.pageId);
    const today = new Date().toISOString().slice(0, 10);

    if (
        !article ||
        article.status !== "published" ||
        article.publishedAt > today
    ) {
        return res.status(404).json({
            message: "Article not found."
        });
    }

    res.json(article);
});

// Admin management

// =======================
// authentication middleware
// =======================
// Reject cross-origin state-changing requests.
// Helps protect cookie-authenticated routes from CSRF.
app.use((req, res, next) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
        if (req.get("Origin") !== process.env.FRONTEND_URL) {
            return res.status(403).json({
                message: "Request origin not allowed"
            });
        }
    }
    next();
});

const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/"
};

// GET /admin
// List all articles, including drafts
app.get("/admin", requireAuth, (req, res) => {
    res.json(articles); // for now, we directly render the dummy data. In next update, we need to render from file or DB.
});

// GET /new
// // Optional metadata for new article form
// app.get("/new", requireAuth, (req, res) => {
//     res.json({
//         fields: ["title", "content", "publishedAt", "status"],
//         statuses: ["draft", "published"]
//     });
// });

// POST /new
// Create an article
app.post("/new", requireAuth, (req, res) => {
    const error = validateArticle(req.body);
    if (error) {
        return res.status(400).json({ message: error });
    }

    const { title, content, publishedAt, status } = req.body;

    const newArticle = {
        id: nextId++,
        title: title.trim(),
        content: content.trim(),
        publishedAt,
        status
    };

    articles.push(newArticle);

    res.status(201).json({
        message: "Article created successfully.",
        article: newArticle
    });
});

// GET /edit/:pageId
// Retrieve article for editing
app.get("/edit/:pageId", requireAuth, (req, res) => {
    // const id = req.params.pageId;
    // res.send(`Edit ID requested: ${id}`);
    const article = findArticle(req.params.pageId);
    if (!article) {
        return res.status(404).json({
            message: "Article not found."
        });
    }
    res.json(article);
});

// PUT /edit/:pageId
// update an existing article
app.put("/edit/:pageId", requireAuth, (req, res) => {
    const article = findArticle(req.params.pageId);

    if (!article) {
        return res.status(404).json({
            message: "Article not found."
        });
    }

    const updatedData = {
        title: req.body.title,
        content: req.body.content,
        publishedAt: req.body.publishedAt,
        status: req.body.status
    };

    const error = validateArticle(updatedData);

    if (error) {
        return res.status(400).json({ message: error });
    }

    article.title = updatedData.title.trim();
    article.content = updatedData.content.trim();
    article.publishedAt = updatedData.publishedAt;
    article.status = updatedData.status;

    res.json({
        message: "Article updated successfully.",
        article
    });
});

// DELETE /article/:pageId
// Delete an article
app.delete("/article/:pageId", requireAuth, (req, res) => {
    const article = findArticle(req.params.pageId);
    if (!article) {
        return res.status(404).json({
            message: "Article not found."
        });
    }

    articles = articles.filter(
        item => item.id !== article.id
    );

    res.json({
        message: "Article deleted successfully."
    });
});

// Unknown API route
app.use((req, res) => {
    res.status(404).json({
        message: "Enedpoint not found."
    });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Backend running on port ${PORT}`);
});