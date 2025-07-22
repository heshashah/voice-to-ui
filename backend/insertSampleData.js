// insertSampleData.js
const db = require('./db');

// Sample data
const sampleEntries = [
  { user_id: 1, mood1: 'happy', mood2: 'calm', mood3: '', timestamp: '2025-07-21 10:00:00' },
  { user_id: 2, mood1: 'sad', mood2: 'anxious', mood3: 'tired', timestamp: '2025-07-20 14:45:00' },
  { user_id: 1, mood1: 'angry', mood2: 'frustrated', mood3: '', timestamp: '2025-07-19 18:15:00' }
];

// Insert each sample entry
sampleEntries.forEach(entry => {
  db.run(
    `INSERT INTO mood_logs (user_id, mood1, mood2, mood3, timestamp) VALUES (?, ?, ?, ?, ?)`,
    [entry.user_id, entry.mood1, entry.mood2, entry.mood3, entry.timestamp],
    function (err) {
      if (err) {
        return console.error('❌ Error inserting:', err.message);
      }
      console.log(`✅ Inserted entry with ID ${this.lastID}`);
    }
  );
});
