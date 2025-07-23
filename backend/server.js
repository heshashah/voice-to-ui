require('dotenv').config(); // Load .env file

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');
const db = require('./db'); // SQLite DB connection
const OpenAI = require('openai');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3').verbose();

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

const monthMap = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12'
};

function parseEventCommand(command) {
  const match = command.match(/mark (\w+)\s+(\d{1,2}) as (.+)/i);
  if (!match) return null;
  const [, monthName, day, title] = match;
  const month = monthMap[monthName.toLowerCase()];
  if (!month) return null;

  const currentYear = new Date().getFullYear();
  const date = `${currentYear}-${month}-${String(day).padStart(2, '0')}`;
  return { title: title.trim(), date };
}

function parseClearCommand(command) {
  const match = command.match(/clear (\w+)\s+(\d{1,2})/i);
  if (!match) return null;
  const [, monthName, day] = match;
  const month = monthMap[monthName.toLowerCase()];
  if (!month) return null;

  const currentYear = new Date().getFullYear();
  const date = `${currentYear}-${month}-${String(day).padStart(2, '0')}`;
  return { date };
}

// ===================== SOCKET =====================
io.on('connection', (socket) => {
  console.log('✅ Client connected');

  socket.on('voice-command', (command) => {
    const cmd = command.toLowerCase().trim();

    // === Mood Logging ===
    const moodMatch = cmd.match(/^i feel (.+)/);
    if (moodMatch) {
      const mood = moodMatch[1];
      const timestamp = new Date().toISOString();

      db.run(`INSERT INTO moods (mood, timestamp) VALUES (?, ?)`, [mood, timestamp], (err) => {
        if (err) {
          socket.emit('feedback', { message: '❌ Error logging mood.' });
        } else {
          socket.emit('feedback', {
            message: `🧠 Logged your mood: "${mood}" at ${new Date(timestamp).toLocaleString()}`
          });

          if (['sad', 'anxious'].includes(mood.trim())) {
            const date = timestamp.split('T')[0];
            const title = `Felt ${mood}`;
            db.run(`INSERT INTO calendar_events (title, date, created_at) VALUES (?, ?, ?)`, [title, date, timestamp]);
            socket.emit('execute-action', { type: 'ADD_EVENT', payload: { title, date } });
          }
        }
      });
      return;
    }

    // 📅 Add Event
    if (cmd.startsWith('mark')) {
      const event = parseEventCommand(cmd);
      if (event) {
        db.run(`INSERT INTO calendar_events (title, date, created_at) VALUES (?, ?, ?)`,
          [event.title, event.date, new Date().toISOString()],
          (err) => {
            if (err) console.error('❌ Failed to save calendar event:', err);
          }
        );
        socket.emit('execute-action', {
          type: 'ADD_EVENT',
          payload: event
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
        db.run(`DELETE FROM calendar_events WHERE date = ?`, [result.date], (err) => {
          if (err) console.error('❌ Failed to delete calendar events:', err);
        });
        socket.emit('execute-action', {
          type: 'CLEAR_EVENTS',
          payload: result
        });
      } else {
        socket.emit('feedback', { message: `❌ Could not understand date to clear: "${command}"` });
      }
      return;
    }

    // 🎵 Music
    if (cmd.startsWith('play')) {
      const songName = cmd.replace('play', '').trim().toLowerCase();
      const songMap = {
        'lover': 'games/assets/audio/Lover.mp3'
      };
      const songPath = songMap[songName];
      if (songPath) {
        socket.emit('execute-action', {
          type: 'PLAY_SONG',
          payload: { file: songPath }
        });
      } else {
        socket.emit('feedback', { message: `❌ Song "${songName}" not found.` });
      }
      return;
    }
    else if (command.includes("play song")) {
      const audio = document.getElementById("audio-player");
      if (audio) {
        audio.play();
        outputText.textContent = `Playing song...`;
      } else {
        outputText.textContent = `Audio player not found.`;
      }
    }


    // ⚙️ Settings
    if (cmd.includes('enable dark')) {
      socket.emit('execute-action', {
        type: 'TOGGLE_SETTING',
        payload: { setting: 'darkmode', state: true }
      });
      return;
    }
    if (cmd.includes('disable dark') || cmd.includes('light mode')) {
      socket.emit('execute-action', {
        type: 'TOGGLE_SETTING',
        payload: { setting: 'darkmode', state: false }
      });
      return;
    }
    if (cmd.includes('enable notification')) {
      socket.emit('execute-action', {
        type: 'TOGGLE_SETTING',
        payload: { setting: 'notifications', state: true }
      });
      return;
    }
    if (cmd.includes('disable notification')) {
      socket.emit('execute-action', {
        type: 'TOGGLE_SETTING',
        payload: { setting: 'notifications', state: false }
      });
      return;
    }

    // === REDIRECTIONS ===
    if (cmd.includes('mood history')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'history.html' } });
      return;
    }
    if (cmd.includes('settings')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'settings.html' } });
      return;
    }
    if (cmd.includes('calendar')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'calendar.html' } });
      return;
    }
    if (cmd.includes('songs') || cmd.includes('music')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'songs.html' } });
      return;
    }
    if (cmd.includes('game') || cmd.includes('dino')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'games/dino.html' } });
      return;
    }
    if (cmd.includes('home')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'home.html' } });
      return;
    }
    if (cmd.includes('go back') || cmd.includes('previous page')) {
      socket.emit('execute-action', { type: 'GO_BACK' });
      return;
    }
    if (cmd.includes('play lover')) {
      socket.emit('execute-action', {
        type: 'REDIRECT',
        payload: { url: 'songs/lover.html' } // Or the correct path
      });
      return;
    }

    // ❓ Unknown
    socket.emit('feedback', { message: `❓ Unknown command: "${command}"` });
  });

  socket.on('get-week-moods', () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const startDate = start.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    db.all(`SELECT * FROM moods WHERE date(timestamp) BETWEEN ? AND ? ORDER BY timestamp DESC`, [startDate, endDate], (err, rows) => {
      socket.emit('week-moods', rows || []);
    });
  });

  socket.on('get-calendar-events', () => {
    db.all(`SELECT title, date FROM calendar_events`, [], (err, rows) => {
      socket.emit('calendar-events', rows || []);
    });
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// ===================== CHATBOT API =====================
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

// ===================== LOGIN API =====================
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM users WHERE username = ?`, [username], (err, user) => {
    if (err || !user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    res.json({ success: true, userId: user.id });
  });
});

// ===================== STATIC ROUTES =====================
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

// ===================== MOOD LOGGING API =====================
app.post("/api/mood", (req, res) => {
  const { userId, mood, date } = req.body;

  const sql = `INSERT INTO mood_entries (user_id, mood, date) VALUES (?, ?, ?)`;
  db.run(sql, [userId, mood, date], function (err) {
    if (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
    res.json({ success: true, moodId: this.lastID });
  });
});



