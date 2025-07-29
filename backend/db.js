// db.js
const mysql = require('mysql2');
require('dotenv').config(); // Load MySQL credentials from .env

// Create a connection pool
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'voice_control_app'
});

// Test connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Error connecting to MySQL:', err.message);
  } else {
    console.log('✅ Connected to MySQL');
    connection.release();
  }
});

// Create the mood_logs table if it doesn't exist
db.query(`
  CREATE TABLE IF NOT EXISTS mood_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mood VARCHAR(100) NOT NULL,
    date DATE NOT NULL
  )
`, (err) => {
  if (err) {
    console.error('❌ Error creating mood_logs table:', err.message);
  } else {
    console.log('✅ mood_logs table created or already exists');
  }
});

const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
db.query(`INSERT INTO mood_logs (mood, date) VALUES (?, ?)`, [mood, date], (err) => {
    if (err) {
        console.error('❌ Error logging mood:', err);
        socket.emit('feedback', { message: '❌ Error logging mood.' });
    } else {
        socket.emit('feedback', { message: `🧠 Mood logged: "${mood}"` });
    }
});


module.exports = db;
