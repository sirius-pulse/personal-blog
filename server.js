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
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

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
// TODO: Add authentication middleware
// =======================

// GET /admin
// List all articles, including drafts
app.get("/admin", (req, res) => {
    res.json(articles); // for now, we directly render the dummy data. In next update, we need to render from file or DB.
});

// GET /new
// Optional metadata for new article form
app.get("/new", (req, res) => {
    res.json({
        fields: ["title", "content", "publishedAt", "status"],
        statuses: ["draft", "published"]
    });
});

// POST /new
// Create an article
app.post("/new", (req, res) => {
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
app.get("/edit/:pageId", (req, res) => {
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
app.put("/edit/:pageId", (req, res) => {
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
app.delete("/article/:pageId", (req, res) => {
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