// Constants
const socket = io();
const allowedEmail = "hesha@gmail.com";
const allowedPassword = "hesha123";

// Speech recognition and listening status
let recognition;
let isListening = false;

// Speak helper function
function speak(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;  // speaking speed
  utterance.pitch = 1; // pitch
  utterance.volume = 1; // volume
  speechSynthesis.speak(utterance);
}

// Helper: Get cookie by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"));
  return match ? match[2] : null;
}

// Helper: Set cookie
function setCookie(name, value, maxAge = 86400) {
  document.cookie = `${name}=${value}; path=/; max-age=${maxAge}`;
}

// Handle form submission
document.addEventListener("DOMContentLoaded", () => {
  const loginForm = document.getElementById("loginForm");

  if (loginForm) {
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const enteredEmail = document.getElementById("email").value;
      const enteredPassword = document.getElementById("password").value;

      if (enteredEmail !== allowedEmail || enteredPassword !== allowedPassword) {
        alert("Unauthorized login: Only Hesha is allowed.");
        return;
      }

      const existingUserId = getCookie("userId");
      if (existingUserId) {
        submitUserData(existingUserId);
      } else {
        const userData = {
          name: "Hesha Shah",
          email: allowedEmail,
        };

        fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setCookie("userId", data.userId);
              submitUserData(data.userId);
            } else {
              console.error("Registration failed:", data.message);
            }
          })
          .catch((err) => console.error("Error:", err));
      }
    });
  }

  // Setup voice commands after DOM is ready
  setupVoiceCommands();
});

// Submit user data to mood entry or another page
function submitUserData(userId) {
  console.log("User ID:", userId);
  window.location.href = "/mood.html"; // redirect to main page after login
}

// Breathing exercise with customizable duration in minutes
function startBreathingExercise(durationMinutes = 1) {
  const phrases = [
    "Breathe in",
    "Breathe out",
    "Think about positive things"
  ];

  let elapsed = 0;
  const intervalMs = 4000; // 4 seconds per phrase
  const totalPhrases = Math.ceil((durationMinutes * 60 * 1000) / intervalMs);

  speak(`Starting a ${durationMinutes} minute guided breathing exercise. Focus on your breath.`);

  const interval = setInterval(() => {
    const phrase = phrases[elapsed % phrases.length];
    speak(phrase);
    elapsed++;

    if (elapsed >= totalPhrases) {
      clearInterval(interval);
      speak("Breathing exercise completed. Well done.");
    }
  }, intervalMs);
}

// Setup voice recognition commands
function setupVoiceCommands() {
  if (!("webkitSpeechRecognition" in window)) {
    console.warn("Speech recognition not supported");
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;

  document.getElementById("voiceBtn")?.addEventListener("click", () => {
    if (!isListening) {
      recognition.start();
    }
  });

  recognition.onstart = () => {
    isListening = true;
    console.log("Voice recognition started");
  };

  recognition.onend = () => {
    isListening = false;
    console.log("Voice recognition ended");
  };

  recognition.onresult = function (event) {
    let command = event.results[0][0].transcript.toLowerCase().trim();
    console.log("Recognized:", command);

    if (command.includes("show my mood history")) {
      window.location.href = "/history.html";
    } else if (command.includes("go to settings")) {
      window.location.href = "/settings.html";
    } else if (command.includes("logout")) {
      document.cookie = "userId=; path=/; max-age=0";
      window.location.href = "/index.html";
    } else if (command.includes("open wellness page") || command.includes("go to wellness")) {
      window.location.href = "/wellness.html";
    } else if (command.includes("start breathing exercise")) {
      // You can parse duration from command if needed, default to 1
      startBreathingExercise(1);
    } else if (command.includes("open appointment page")){
      window.location.href = "/appointments.html";
    } else {
      alert("Command not recognized");
    }
  };

  recognition.onerror = function (event) {
    console.error("Speech recognition error:", event.error);
  };
}

// Listen for server-triggered actions
socket.on('execute-action', (action) => {
  console.log('Action received from server:', action);

  if (action.type === 'START_BREATHING_EXERCISE') {
    alert(`🧘 Starting a ${action.payload.duration}-minute guided breathing exercise...`);
    startBreathingExercise(action.payload.duration);
  }

  if (action.type === 'PROMPT_FEELING') {
    const feeling = prompt("How are you feeling today?");
    if (feeling) {
      socket.emit('log-feeling', { feeling, date: new Date().toISOString().split('T')[0] });
    }
  }

  if (action.type === 'SHOW_EXERCISES') {
    alert("🏋️ Here are some gentle back stretches:\n1. Cat-Cow Stretch\n2. Child’s Pose\n3. Seated Forward Bend");
  }
});

window.addEventListener('load', () => {
  // Speak "Add medicines" on page load
  const speakText = new SpeechSynthesisUtterance("Add medicines");
  speechSynthesis.speak(speakText);

  // Start recognition automatically if supported and not already listening
  if (recognition && !isListening) {
    recognition.start();
  }
});

