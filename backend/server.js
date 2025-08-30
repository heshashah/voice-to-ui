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
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});
const PORT = process.env.PORT || 4000;

//patient login
async function loginPatient(event) {
  event.preventDefault();
  const name = document.getElementById("patientName").value;
  const age = document.getElementById("patientAge").value;
  const gender = document.querySelector('input[name="patientGender"]:checked')?.value;
  const mobile = document.getElementById("patientMobile").value;

  try {
    // send details to backend
    const res = await fetch("http://localhost:3000/api/patients/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, age, gender, mobile })
    });

    const data = await res.json();

    if (res.ok) {
      // store session info locally
      sessionStorage.setItem("userRole", "patient");
      sessionStorage.setItem("userName", name);

      // redirect to home
      window.location.href = "home.html";
    } else {
      alert("Login failed: " + data.message);
    }
  } catch (err) {
    console.error("Error logging in:", err);
    alert("Something went wrong!");
  }
}

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

// Route to save patient login
app.post("/patient-login", (req, res) => {
  const { name } = req.body;
  const date = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  const sql = "INSERT INTO patient_logins (name, login_date) VALUES (?, ?)";
  db.query(sql, [name, date], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).send("❌ Failed to save login");
    }
    res.send("✅ Patient login saved");
  });
});

app.listen(4000, () => {
  console.log("🚀 Server running on http://localhost:3000");
});

// ✅ Create tables
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

function formatDateToDayDateYear(dateStr) {
  const dateObj = new Date(dateStr);
  if (isNaN(dateObj)) return dateStr;
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  return dateObj.toLocaleDateString('en-US', options);
}



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

function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  speechSynthesis.speak(utterance);
}


// ✅ Sockets
io.on('connection', (socket) => {
  console.log('✅ Client connected');

  socket.on('voice-command', (command) => {
    const cmd = command.toLowerCase().trim();

    // ✅ Mood Logging 
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
    function parseEventCommand(command) {
      command = command.toLowerCase().trim();

      const match = command.match(/mark (.+?) as (.+)/i);
      if (match) {
        const title = match[1].trim();
        const status = match[2].trim();
        const date = new Date().toISOString().split("T")[0];
        return { title: `${title} (${status})`, date };
      }

      const regex = /mark (.+?) on (\d{4}-\d{2}-\d{2})/i;
      const m2 = command.match(regex);
      if (m2) {
        return { title: m2[1].trim(), date: m2[2] };
      }

      return null;
    }

    // 📅 Add Event
    if (cmd.startsWith('mark')) {
      const event = parseEventCommand(cmd);
      if (event) {
        db.query(
          `INSERT INTO calendar_events (title, date) VALUES (?, ?)`,
          [event.title, event.date],
          (err) => {
            if (err) {
              console.error('❌ DB Insert Error:', err);
              socket.emit('feedback', { message: '❌ Failed to save event to DB' });
              return;
            }

            // ✅ Update frontend UI
            socket.emit('execute-action', {
              type: 'ADD_EVENT',
              payload: event
            });

            // ✅ Notify user
            socket.emit('feedback', {
              message: `✅ Event "${event.title}" added on ${event.date}`
            });

            // 🔄 Re-sync all events to frontend
            db.query(
              `SELECT title, date FROM calendar_events ORDER BY date ASC`,
              (err, rows) => {
                if (!err) socket.emit('calendar-events', rows);
              }
            );
          }
        );
      } else {
        socket.emit('feedback', {
          message: `❌ Could not parse event: "${command}"`
        });
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

    // 🎵 Music
    if (cmd.startsWith('play')) {
      const songName = cmd.replace('play', '').trim().toLowerCase();
      const songMap = { 'lover': 'games/assets/audio/Lover.mp3' };
      const songPath = songMap[songName];
      if (songPath) socket.emit('execute-action', { type: 'PLAY_SONG', payload: { file: songPath } });
      else socket.emit('feedback', { message: `❌ Song "${songName}" not found.` });
      return;
    }

    // Redirections 
    if (cmd.includes('mood history')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'history.html' } }); return; }
    if (cmd.includes('settings')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'settings.html' } }); return; }
    if (cmd.includes('calendar')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'calendar.html' } }); return; }
    if (cmd.includes('songs') || cmd.includes('music')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'songs.html' } }); return; }
    if (cmd.includes('game') || cmd.includes('dino')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'games/dino.html' } }); return; }
    if (cmd.includes('home')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'home.html' } }); return; }
    if (cmd.includes('appointment bookings')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'appointments.html' } }); return; }
    if (cmd.includes('home')) { socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'home.html' } }); return; }

    // Medicine Tracker
    app.post('/api/add-medicine', async (req, res) => {
      const { name, dosage, time, date } = req.body;

      if (!name || !time || !date) {
        return res.json({ message: "Please fill in all required fields" });
      }

      try {
        db.run(
          "INSERT INTO medicines (name, dosage, time, date) VALUES (?, ?, ?, ?)",
          [name, dosage, time, date],
          function (err) {
            if (err) {
              console.error(err);
              return res.json({ message: "Database error" });
            }
            res.json({ message: "Medicine added successfully" });
          }
        );
      } catch (err) {
        console.error(err);
        res.json({ message: "Server error" });
      }
    });

    // ✅ Medicine Tracker 
    if (cmd.includes('medicine tracker') || cmd.includes('show me medicine tracker') || cmd.includes('go to medicine tracker')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'medicine.html' } });
      return;
    }
    // 💊 Handle "add medicine" voice command
    if (cmd.startsWith('add medicine')) {
      // Example: "add medicine paracetamol 500mg at 9pm on july 5"
      const match = cmd.match(/add medicine ([a-zA-Z0-9\s]+) (\d+mg)? at ([0-9:apm\s]+) on (\w+) (\d{1,2})/i);

      if (match) {
        const [, name, dosage, time, monthName, day] = match;
        const month = monthMap[monthName.toLowerCase()];
        if (!month) {
          socket.emit('feedback', { message: '❌ Could not understand month' });
          return;
        }

        const date = `${new Date().getFullYear()}-${month}-${String(day).padStart(2, '0')}`;

        // ✅ Send data to frontend to auto-fill fields
        socket.emit('voice-command-result', {
          type: 'MEDICINE_COMMAND',
          payload: { name: name.trim(), dosage: dosage || '', time: time.trim(), date }
        });

        //Patient Login
        app.post("/api/patients/login", async (req, res) => {
          const { name, age, gender, mobile } = req.body;
          const date = new Date();

          try {
            await db.query(
              "INSERT INTO patients (name, age, gender, mobile, login_date) VALUES (?, ?, ?, ?, ?)",
              [name, age, gender, mobile, date]
            );
            res.json({ message: "Patient logged in successfully" });
          } catch (err) {
            console.error(err);
            res.status(500).json({ message: "Database error" });
          }
        });


        // ✅ insert into DB
        db.query(
          `INSERT INTO medicines (name, dosage, time, date) VALUES (?, ?, ?, ?)`,
          [name.trim(), dosage || '', time.trim(), date],
          (err) => {
            if (err) {
              console.error('❌ Medicine insert error:', err);
              socket.emit('feedback', { message: '❌ Failed to save medicine in DB' });
            } else {
              socket.emit('feedback', { message: `💊 Medicine "${name}" scheduled on ${date} at ${time}` });
              db.query(`SELECT id, name, dosage, time, date FROM medicines ORDER BY date ASC`, (err, rows) => {
                if (!err) {
                  const formattedRows = rows.map(med => ({
                    ...med,
                    date: formatDateToDayDateYear(med.date)
                  }));
                  socket.emit('medicine-data', formattedRows);
                }
              });
            }
          }
        );
      } else {
        socket.emit('feedback', { message: '❌ Could not parse medicine command. Try: add medicine paracetamol 500mg at 9pm on july 5' });
      }
      return;
    }

    // 🌿 Wellness Coach - medition 
    if (cmd.includes('open wellness page') || cmd.includes('go to wellness')) {
      socket.emit('execute-action', { type: 'REDIRECT', payload: { url: 'wellness.html' } });
      return;
    }

    if (cmd.includes('start') && cmd.includes('breathing exercise')) {
      socket.emit('feedback', { message: '🧘 Starting breathing exercise. Focus on your breath...' });
      socket.emit('execute-action', { type: 'START_BREATHING_EXERCISE', payload: { duration: 5 } });
      return;
    }

    if (cmd.includes('start') && cmd.includes('breathing exercise')) {
      let duration = 2;
      const match = cmd.match(/(\d+)\s*(minute|min|mins)/);
      if (match) duration = parseInt(match[1]);

      socket.emit('feedback', { message: `🧘 Starting breathing exercise for ${duration} minutes. Focus on your breath...` });
      socket.emit('execute-action', { type: 'START_BREATHING_EXERCISE', payload: { duration } });
      return;
    }

    if (cmd.includes('how are you feeling today') || cmd.includes('daily health check-in')) {
      const date = new Date().toISOString().split('T')[0];
      db.query(`INSERT INTO mood_logs (mood, date) VALUES (?, ?)`, ['Check-in initiated', date], (err) => {
        if (err) socket.emit('feedback', { message: '❌ Error starting health check-in.' });
        else socket.emit('feedback', { message: '🩺 How are you feeling today? Please share your mood.' });
      });
      return;
    }

    if (cmd.includes('suggest exercises for back pain')) {
      socket.emit('feedback', { message: '🏋️ Suggesting gentle exercises for back pain...' });
      socket.emit('execute-action', { type: 'SHOW_EXERCISES', payload: { condition: 'back pain' } });
      return;
    }

    if (command.includes("start a 5-minute breathing exercise")) {
      speak("Let's begin. Breathe in...");
      setTimeout(() => speak("Breathe out..."), 1000);
      setTimeout(() => speak("Breathe in..."), 1000);
      setTimeout(() => speak("Breathe out..."), 1000);
    }

    // 🍃 Wellness Coach - Relief feature 
    if (cmd.includes("i have a back pain")) {
      socket.emit('feedback', { message: "💡 I suggest 3 exercises: Bridge Pose, Bird Dog, or cat-cow pose. Please say which one you'd like to start." });
      socket.emit('execute-action', { type: 'SUGGEST_BACK_EXERCISES' });
      return;
    }

    if (cmd.includes("start bridge pose")) {
      const instructions = "To perform the pose, lie on your back with feet flat on the floor, knees bent and hip-width apart, and lift your hips towards the ceiling, interlace your fingers underneath your body, and hold the pose while breathing deeply. It's important to keep your chin tucked slightly towards your chest, avoid any pain or discomfort during the pose, and gently lower the hips back to the floor, vertebra by vertebra, when releasing.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "Bridge Pose", instructions }
      });
      return;
    }

    if (cmd.includes("start bird dog")) {
      const instructions = "To perfrom bird dog, Draw your shoulder blades together. Raise your right arm and left leg, keeping your shoulders and hips parallel to the floor. Lengthen the back of your neck and tuck your chin into your chest to gaze down at the floor. Hold this position for a few seconds, then lower back down to the starting position.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "Bird Dog", instructions }
      });
      return;
    }

    if (cmd.includes("start cat cow")) {
      const instructions = "The cat-cow pose gently massages the spine and stretches your back. Start on your hands and knees in tabletop position. Inhale as you drop your belly and lift your head and tailbone for cow pose. Exhale as you round your back towards the ceiling for cat pose. Continue moving slowly with your breath.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "Cat-Cow Pose", instructions }
      });
      return;
    }

    // Wellness Coach - Knee Pain Relief
    if (cmd.includes("i have a knee pain")) {
      socket.emit('feedback', { message: "💡 I suggest 3 exercises: Straight leg raises, Hamstring stretch, Leg extension. Please say which one you'd like to start." });
      socket.emit('execute-action', { type: 'SUGGEST_KNEE_EXERCISES' });
      return;
    }

    if (cmd.includes("start straight leg raises")) {
      const instructions = "For this exercise, you can use a mat to add cushioning under your back. Lie down on the floor with one leg bent and one leg straight out in front of you. Contract the quadricep of your straight leg and slowly raise it off the floor until it’s the same height as your bent knee. Pause at the top for 5 seconds, then lower to the starting position. Do 2 to 3 sets of 10 repetitions for each leg.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "straight leg raises", instructions }
      });
      return;
    }

    if (cmd.includes("start hamstring stretch")) {
      const instructions = "For this stretch, you can use a mat to add cushioning under your back. Lie down on the floor or mat and straighten both legs. Or, if it’s more comfortable, you can bend both knees with your feet flat on the floor. Lift one leg off the floor. Place your hands behind your thigh but below the knee, and gently pull your knee toward your chest until you feel a slight stretch. This shouldn’t be painful. Hold for 30 seconds. Lower and change legs. Repeat twice on each side.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "Hamstring Stretch", instructions }
      });
      return;
    }

    if (cmd.includes("start leg extension")) {
      const instructions = "Sit up tall in a chair. Put your feet flat on the floor, hip-width apart. Look straight ahead, contract your thigh muscles, and extend one leg as high as possible without raising your buttocks off the chair. Pause, then lower to the starting position. Do 2 to 3 sets of 10 repetitions for each leg.";
      socket.emit('execute-action', {
        type: 'START_RELIEF_EXERCISE',
        payload: { exercise: "leg extension", instructions }
      });
      return;
    }

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

  // ✅ Fetch Calendar Events
  socket.on('get-calendar-events', () => {
    db.query(`SELECT title, date FROM calendar_events ORDER BY date ASC`, (err, rows) => {
      socket.emit('calendar-events', err ? [] : rows);
    });
  });

  // ✅ Fetch Medicines for Medicine Tracker
  socket.on('get-medicines', () => {
    db.query(`SELECT id, name, dosage, time, date FROM medicines ORDER BY date ASC`, (err, rows) => {
      socket.emit('medicine-data', err ? [] : rows);
    });
  });

  socket.on('disconnect', () => console.log('❌ Client disconnected'));
});

// ✅ Chatbot API
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

// ✅ Login API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  db.query(`SELECT * FROM users WHERE username = ?`, [username], (err, results) => {
    if (err || results.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const user = results[0];
    if (!bcrypt.compareSync(password, user.password)) return res.status(401).json({ error: 'Invalid credentials' });
    res.json({ success: true, userId: user.id });
  });
});

// ✅ Static routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'home.html'));
});

// 💊Medicine Tracker
server.listen(PORT, () => console.log(`🚀 Server running at http://localhost:${PORT}`));
db.query(`
  CREATE TABLE IF NOT EXISTS medicines (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    time VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`);

// ✅ API to Add Medicine
app.post('/api/add-medicine', (req, res) => {
  const { name, dosage, time, date } = req.body;
  if (!name || !time || !date) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  db.query(`INSERT INTO medicines (name, dosage, time, date) VALUES (?, ?, ?, ?)`,
    [name, dosage, time, date],
    (err) => {
      if (err) {
        console.error('❌ Error inserting medicine:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ success: true, message: 'Medicine added successfully' });
    });
});

//Appointments
let appointments = []; // Optional cache

io.on("connection", (socket) => {
  console.log("⚡ User connected");
  // Doctor requests all appointments
  socket.on("getAppointments", () => {
    db.query("SELECT * FROM appointments ORDER BY dateTime ASC", (err, rows) => {
      if (err) {
        console.error("❌ DB Error:", err);
        socket.emit("feedback", { message: "❌ Failed to fetch appointments" });
      } else {
        socket.emit("appointmentsList", rows);
      }
    });
  });

  // Patient books appointment
  socket.on("bookAppointment", ({ patientName, dateTime }) => {
    db.query(
      "INSERT INTO appointments (patientName, dateTime, status) VALUES (?, ?, 'pending')",
      [patientName, dateTime],
      (err, result) => {
        if (err) {
          console.error("❌ DB Error:", err);
          socket.emit("feedback", { message: "❌ Failed to book appointment" });
        } else {
          const appointment = {
            id: result.insertId,
            patientName,
            dateTime,
            status: "pending",
          };

          // Keep in memory too (optional)
          appointments.push(appointment);

          // Send back to patient
          socket.emit("appointmentBooked", appointment);

          // Notify doctor(s)
          io.emit("newAppointment", appointment);
        }
      }
    );
  });

  // Doctor updates appointment
  socket.on("updateAppointment", ({ id, status }) => {
    db.query(
      "UPDATE appointments SET status = ? WHERE id = ?",
      [status, id],
      (err) => {
        if (err) {
          console.error("❌ DB Error:", err);
          return;
        }

        const appt = appointments.find((a) => a.id === id);
        if (appt) appt.status = status;

        io.emit("appointmentUpdated", { id, status });
      }
    );
  });

  socket.on("disconnect", () => {
    console.log("❌ User disconnected");
  });
});

// server.listen(3000, () => {
//   console.log("🚀 Server running on http://localhost:3000");
// });