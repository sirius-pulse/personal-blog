
const db = require("./database");

// Insert a sample user.
// This is a database-only test; not a usable login account.
const username = `test_${Date.now()}`;
const now = new Date().toISOString();

const insertUser = db.prepare(`
  INSERT INTO users (
    username,
    password_hash,
    role,
    created_at,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?)
`);

const result = insertUser.run(
  username,
  "not-a-real-password-hash",
  "user",
  now,
  now
);

// Retrieve users without exposing password hashes
const users = db.prepare(`
  SELECT id, username, role, created_at
  FROM users
`).all();