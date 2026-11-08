const jwt = require("jsonwebtoken");
const db = require("../db/database");

function requireAuth(req, res, next) {
    const token = req.cookies?.admin_token; 

    if (!token) {
        return res.status(401).json({
            message: "Authentication required"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(
            token,
            process.env.JWT_SECRET,
            {
                algorithms: ["HS256"],
                issuer: "personal-blog",
                audience: "blog-admin"
            }
        );
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }

    const userId = Number(decoded.sub);

    if (!Number.isSafeInteger(userId) || userId <= 0) {
        return res.status(401).json({
            message: "Invalid token subject"
        });
    }

    try {
        // Retrieve user from SQLite
        const user = db.prepare(`
            SELECT id, username, role
            FROM users
            WHERE id = ?    
        `).get(userId);

        if (!user) {
            return res.status(401).json({
                message: "User no existed."
            });
        }

        // Attach authenticated user to request
        req.user = user;
        next();
    } catch (error) {
        console.error("Authentication database error: ", error);

        return res.status(500).json({
            message: "Internal server error"
        });
    }
}

module.exports = requireAuth;