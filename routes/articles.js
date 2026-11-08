
const express = require("express");
const db = require("../db/database");

const requireAuth = require("../middleware/requireAuth");
const requireAdmin = require("../middleware/requireAdmin");

const router = express.Router();

// SQLite snake_case -> React camelCase
const articleFields = `
    a.id,
    a.title,
    a.content,
    a.status,
    a.published_at AS publishedAt,
    a.created_at AS createdAt,
    a.updated_at AS updatedAt,
    a.author_id AS authorId,
    u.username AS authorName
`;

function validateArticle(body) {
    const { title, content, publishedAt, status } = body ?? {};

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
        !/^\d{4}-\d{2}-\d{2}$/.test(publishedAt) ||
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

function parseArticleId(value) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
        return null;
    }

    return id;
}

function getArticle(id) {
    return db.prepare(`
        SELECT ${articleFields}
        FROM articles a
        JOIN users u ON u.id = a.author_id
        WHERE a.id = ?
    `).get(id);
}

// ========================================
// GET /home
// Public: list published articles
// ========================================
router.get("/home", (req, res) => {
    try {
        const today = new Date().toISOString().slice(0, 10);

        const articles = db.prepare(`
            SELECT ${articleFields}
            FROM articles a
            JOIN users u ON u.id = a.author_id
            WHERE a.status = 'published'
              AND a.published_at <= ?
            ORDER BY a.published_at DESC, a.id DESC
        `).all(today);

        return res.json(articles);
    } catch (error) {
        console.error("List articles error:", error);
        return res.status(500).json({
            message: "Failed to retrieve articles"
        });
    }
});

// ========================================
// GET /article/:pageId
// Public: view published article
// ========================================
router.get("/article/:pageId", (req, res) => {
    const id = parseArticleId(req.params.pageId);

    if (!id) {
        return res.status(404).json({
            message: "Article not found"
        });
    }

    try {
        const today = new Date().toISOString().slice(0, 10);

        const article = db.prepare(`
            SELECT ${articleFields}
            FROM articles a
            JOIN users u ON u.id = a.author_id
            WHERE a.id = ?
              AND a.status = 'published'
              AND a.published_at <= ?
        `).get(id, today);

        if (!article) {
            return res.status(404).json({
                message: "Article not found"
            });
        }

        return res.json(article);
    } catch (error) {
        console.error("Get article error:", error);
        return res.status(500).json({
            message: "Failed to retrieve article"
        });
    }
});

// ========================================
// GET /admin
// Admin: list all articles
// ========================================
router.get("/admin", requireAuth, requireAdmin, (req, res) => {
    try {
        const articles = db.prepare(`
            SELECT ${articleFields}
            FROM articles a
            JOIN users u ON u.id = a.author_id
            ORDER BY a.created_at DESC, a.id DESC
        `).all();

        return res.json(articles);
    } catch (error) {
        console.error("Admin articles error:", error);
        return res.status(500).json({
            message: "Failed to retrieve articles"
        });
    }
});

// ========================================
// POST /new
// Admin: create article
// ========================================
router.post("/new", requireAuth, (req, res) => {
    const error = validateArticle(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const { title, content, publishedAt, status } = req.body;

        const now = new Date().toISOString();

        const result = db.prepare(`
            INSERT INTO articles (
                title,
                content,
                status,
                published_at,
                created_at,
                updated_at,
                author_id
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(
            title.trim(),
            content.trim(),
            status,
            publishedAt,
            now,
            now,
            req.user.id
        );

        const article = getArticle(result.lastInsertRowid);

        return res.status(201).json({
            message: "Article created successfully.",
            article
        });
    } catch (error) {
        console.error("Create article error:", error);
        return res.status(500).json({
            message: "Failed to create article"
        });
    }
});

// ========================================
// GET /edit/:pageId
// Admin: retrieve article for editing
// ========================================
router.get("/edit/:pageId", requireAuth, requireAdmin, (req, res) => {
    const id = parseArticleId(req.params.pageId);
    console.log(`ID: ${id}`);
    if (!id) {
        return res.status(404).json({
            message: "Article not found"
        });
    }

    try {
        const article = getArticle(id);
        console.log(`Article: ${article}`);
        if (!article) {
            return res.status(404).json({
                message: "Article not found"
            });
        }

        return res.json(article);
    } catch (error) {
        console.error("Edit article retrieval error:", error);
        return res.status(500).json({
            message: "Failed to retrieve article"
        });
    }
});

// ========================================
// PUT /edit/:pageId
// Admin: update article
// ========================================
router.put("/edit/:pageId", requireAuth, requireAdmin, (req, res) => {
    const id = parseArticleId(req.params.pageId);

    if (!id) {
        return res.status(404).json({
            message: "Article not found"
        });
    }

    const error = validateArticle(req.body);

    if (error) {
        return res.status(400).json({ message: error });
    }

    try {
        const { title, content, publishedAt, status } = req.body;

        const result = db.prepare(`
            UPDATE articles
            SET title = ?,
                content = ?,
                status = ?,
                published_at = ?,
                updated_at = ?
            WHERE id = ?
        `).run(
            title.trim(),
            content.trim(),
            status,
            publishedAt,
            new Date().toISOString(),
            id
        );

        if (result.changes === 0) {
            return res.status(404).json({
                message: "Article not found"
            });
        }

        return res.json({
            message: "Article updated successfully.",
            article: getArticle(id)
        });
    } catch (error) {
        console.error("Update article error:", error);
        return res.status(500).json({
            message: "Failed to update article"
        });
    }
});

// ========================================
// DELETE /article/:pageId
// Admin: delete article
// ========================================
router.delete("/article/:pageId", requireAuth, requireAdmin, (req, res) => {
    const id = parseArticleId(req.params.pageId);

    if (!id) {
        return res.status(404).json({
            message: "Article not found"
        });
    }

    try {
        const result = db.prepare(`
            DELETE FROM articles
            WHERE id = ?
        `).run(id);

        if (result.changes === 0) {
            return res.status(404).json({
                message: "Article not found"
            });
        }

        return res.json({
            message: "Article deleted successfully."
        });
    } catch (error) {
        console.error("Delete article error:", error);
        return res.status(500).json({
            message: "Failed to delete article"
        });
    }
});

module.exports = router;
