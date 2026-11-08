const db = require("./database");

// Prepare the statement and fetch all rows
const stmt = db.prepare('SELECT * FROM users');
const rows = stmt.all();

console.log(rows);
