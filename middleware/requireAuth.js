const jwt = require("jsonwebtoken");

function requireAuth(req, res, next) {
    const token = req.cookies?.admin_token;

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

        if (decoded.role !== "admin" || decoded.sub !== "admin") {
            return res.status(403).json({
                message: "Administrator access required"
            });
        }
        req.admin = decoded;
        next(); // move to next middleware
    } catch {
        return res.status(401).json({
            message: "Invalid or expired token"
        });
    }
}

module.exports = requireAuth;