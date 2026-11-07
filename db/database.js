const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

require("dotenv").config();

const dbPath = process.env.DB_PATH
    ? path.resolve(process.env.DB_PATH)
    : path.join(__dirname, "blog.db");

fs.mkdirSync(path.dirname(dbPath), {
    recursive: true
});

const db = new Database(dbPath);

// Enable Write-Ahead Logging
db.pragma("journal_mode = WAL");

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// Wait up to 5 seconds if database is busy
db.pragma("busy_timeout = 5000");

console.log(`SQLite database connected: ${dbPath}`);

module.exports = db;