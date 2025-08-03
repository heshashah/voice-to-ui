require('dotenv').config(); // Load .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const mysql = require('mysql2');
const OpenAI = require('openai');
const bcrypt = require('bcrypt');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/assets', express.static(path.join(__dirname, '..', 'frontend/assets')));
app.use('/games/assets', express.static(path.join(__dirname, '..', 'frontend/games/assets')));

// ✅ MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'voice_control_app'
});

db.connect((err) => {
  if (err) console.error('❌ MySQL connection failed:', err);
  else console.log('✅ Connected to MySQL database');
});

// ✅ Create tables if not exists
db.query(`
  CREATE TABLE IF NOT EXISTS mood_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    mood VARCHAR(100) NOT NULL,
    date DATE NOT NULL
  )
`);
db.query(`
  CREATE TABLE IF NOT EXISTS calendar_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);
db.query(`
  CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE,
    password VARCHAR(255) NOT NULL
  )
`);

const monthMap = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12'
};

function parseEventCommand(command) {
  const match = command.match(/mark\s+([a-zA-Z]+)\s+(\d{1,2})\s+as\s+(.+)/i);
  if (!match) return null;
  const [, monthName, day, title] = match;
  const month = monthMap[monthName.toLowerCase()];
  if (!month) return null;
  const currentYear = new Date().getFullYear();
  return { title: title.trim(), date: `${currentYear}-${month}-${String(day).padStart(2, '0')}` };
}

function parseClearCommand(command) {
  const match = command.match(/clear (\w+)\s+(\d{1,2})/i);
  if (!match) return null;
  const [, monthName, day] = match;
  const month = monthMap[monthName.toLowerCase()];
  if (!month) return null;
  const currentYear = new Date().getFullYear();
  return { date: `${currentYear}-${month}-${String(day).padStart(2, '0')}` };
}

// ===================== SOCKET =====================
io.on('connection', (socket) => {
  console.log('✅ Client connected');

  socket.on('voice-command', (command) => {
    const cmd = command.toLowerCase().trim();

    // === ✅ Mood Logging ===
    const moodMatch = cmd.match(/^i feel (.+)/);
    if (moodMatch) {
      const mood = moodMatch[1];
      const date = new Date().toISOString().split('T')[0];

      db.query(`INSERT INTO mood_logs (mood, date) VALUES (?, ?)`, [mood, date], (err) => {
        if (err) socket.emit('feedback', { message: '❌ Error logging mood.' });
        else socket.emit('feedback', { message: `🧠 Logged your mood: "${mood}" on ${date}` });
      });
      return;
    }

    // 📅 Add Event
    // 📅 Add Event
    if (cmd.startsWith('mark')) {
      const event = parseEventCommand(cmd);
      if (event) {
        db.query(`INSERT INTO calendar_events (title, date) VALUES (?, ?)`, [event.title, event.date], (err) => {
          if (err) {
            console.error('❌ DB Insert Error:', err);
            socket.emit('feedback', { message: '❌ Failed to save event to DB' });
            return;
          }

          // ✅ Notify frontend that the event was added
          socket.emit('execute-action', { type: 'ADD_EVENT', payload: event });
          socket.emit('feedback', { message: `✅ Event "${event.title}" added on ${event.date}` });

          // ✅ 🔥 Fetch all events again and send to frontend to keep it updated
          db.query(`SELECT title, date FROM calendar_events ORDER BY date ASC`, (err, rows) => {
            if (!err) socket.emit('calendar-events', rows);
          });
        });
      } else {
        socket.emit('feedback', { message: `❌ Could not parse event: "${command}"` });
      }
      return;
    }


    // ❌ Clear Calendar Events
    if (cmd.startsWith('clear')) {
      const result = parseClearCommand(cmd);
      if (result) {
        db.query(`DELETE FROM calendar_events WHERE date = ?`, [result.date]);
        socket.emit('execute-action', { type: 'CLEAR_EVENTS', payload: result });
      } else {
        socket.emit('feedback', { message: `❌ Could not understand date to clear: "${command}"` });
      }
      return;
    }

    // 🎵 Music
    if (cmd.startsWith('play')) {
      const songName = cmd.replace('play', '').trim().toLowerCase();
      const songMap = { 'lover': 'games/assets/audio/Lover.mp3' };
      const songPath = songMap[songName];
      if (songPath) socket.emit('execute-action', { type: 'PLAY_SONG', payload: { file: songPath } });
      else socket.emit('feedback', { message: `❌ Song "${songName}" not found.` });
      return;
    }

    // ⚙️ Settings
    if (cmd.includes('enable dark')) {
      socket.emit('execute-action', { type: 'TOGGLE_SETTING', payload: { setting: 'darkmode', state: true } });
      return;
    }
    if (cmd.includes('disable dark') || cmd.includes('light mode')) {
      socket.emit('execute-action', { type: 'TOGGLE_SETTING', payload: { setting: 'darkmode', state: false } });
      return;
    }

    // === REDIRECTIONS ===
    if (cmd.includes('mood history')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'history.html' } }); return; }
    if (cmd.includes('settings')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'settings.html' } }); return; }
    if (cmd.includes('calendar')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'calendar.html' } }); return; }
    if (cmd.includes('songs') || cmd.includes('music')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'songs.html' } }); return; }
    if (cmd.includes('game') || cmd.includes('dino')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'games/dino.html' } }); return; }
    if (cmd.includes('home')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'home.html' } }); return; }

    // ❓ Unknown
    socket.emit('feedback', { message: `❓ Unknown command: "${command}"` });
  });

  // ✅ Get moods for the week
  socket.on('get-week-moods', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const startDate = start.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    db.query(`SELECT mood, date FROM mood_logs WHERE date BETWEEN ? AND ? ORDER BY date DESC`,
      [startDate, endDate],
      (err, rows) => socket.emit('week-moods', err ? [] : rows)
    );
  });

  socket.on('disconnect', () => console.log('❌ Client disconnected'));
});

// ✅ CHATBOT API
app.post('/chat', async (req, res) => {
  try {
    const { prompt } = req.body;
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }]
    });
    res.json({ reply: completion.choices[0].message.content });
  } catch (err) {
    console.error(err);
    res.status(500).json({ reply: 'Sorry, something went wrong.' });
  }
});

// ✅ LOGIN API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, userId: user.id });
  });
});

// ✅ STATIC ROUTE
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'home.html'));
});

server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));