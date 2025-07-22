// Constants
const allowedEmail = "hesha@gmail.com";
const allowedPassword = "hesha123";

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

  // Optional: Handle voice commands
  setupVoiceCommands();
});

// Submit user data to mood entry or another page
function submitUserData(userId) {
  console.log("User ID:", userId);
  window.location.href = "/mood.html"; // redirect to main page after login
}

// Voice commands (basic example)
function setupVoiceCommands() {
  if (!("webkitSpeechRecognition" in window)) {
    console.warn("Speech recognition not supported");
    return;
  }

  const recognition = new webkitSpeechRecognition();
  recognition.continuous = false;
  recognition.lang = "en-US";
  recognition.interimResults = false;

  // Trigger voice recognition on some button or condition
  document.getElementById("voiceBtn")?.addEventListener("click", () => {
    recognition.start();
  });

  recognition.onresult = function (event) {
    const command = event.results[0][0].transcript.toLowerCase();
    console.log("Voice Command:", command);

    if (command.includes("show my mood history")) {
      window.location.href = "/history.html";
    } else if (command.includes("go to settings")) {
      window.location.href = "/settings.html";
    } else if (command.includes("logout")) {
      document.cookie = "userId=; path=/; max-age=0";
      window.location.href = "/index.html";
    } else {
      alert("Command not recognized");
    }
  };

  recognition.onerror = function (event) {
    console.error("Speech recognition error:", event.error);
  };
}
