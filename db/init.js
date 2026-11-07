
const fs = require("fs");
const path = require("path");

const db = require("./database");

function initializeDatabase() {
  const schemaPath = path.join(__dirname, "schema.sql");

  const schema = fs.readFileSync(schemaPath, "utf8");

  db.exec(schema);

  console.log("Database tables initialized successfully.");
}

initializeDatabase();
