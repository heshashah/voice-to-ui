// db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create or open the database
const dbPath = path.join(__dirname, 'moodLogs.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('❌ Error opening database', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

// Create the mood_logs table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS mood_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      mood1 TEXT,
      mood2 TEXT,
      mood3 TEXT,
      timestamp TEXT NOT NULL
    )
  `, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err.message);
    } else {
      console.log('✅ mood_logs table created or already exists');
    }
  });
});

module.exports = db;
