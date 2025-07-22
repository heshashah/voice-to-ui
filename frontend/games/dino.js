const socket = io();

const dino = document.getElementById('dino');
const obstacle = document.getElementById('obstacle');
const scoreDisplay = document.getElementById('score');
const startScreen = document.getElementById('start-screen');
const gameContainer = document.querySelector('.game-container');

const statusBox = document.getElementById('status-display');
const statusText = document.getElementById('status');
const outputText = document.getElementById('command-output');

let score = 0;
let gameStarted = false;
let gameOver = false;

function startGame() {
  if (!gameStarted) {
    startScreen.style.display = 'none';
    gameContainer.style.display = 'block';
    score = 0;
    gameOver = false;
    gameStarted = true;
    obstacle.style.animation = 'moveObstacle 2s linear infinite';
    console.log("🚀 Game started!");
    if (outputText) outputText.textContent = "🎮 Game started!";
    window.scrollTo(0, gameContainer.offsetTop);
  }
}

function jump() {
  if (gameStarted && !dino.classList.contains('jump')) {
    dino.classList.add('jump');
    setTimeout(() => dino.classList.remove('jump'), 500);
    console.log("⬆️ Dino jumped!");
    if (outputText) outputText.textContent = "⬆️ Dino jumped!";
  }
}

function duck() {
  if (gameStarted) {
    dino.style.height = '30px';
    setTimeout(() => {
      dino.style.height = '60px';
    }, 500);
    console.log("⬇️ Dino ducked!");
    if (outputText) outputText.textContent = "⬇️ Dino ducked!";
  }
}

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp') {
    !gameStarted ? startGame() : jump();
  } else if (e.code === 'ArrowDown') {
    duck();
  }
});

setInterval(() => {
  if (!gameStarted || gameOver) return;

  const dinoBottom = parseInt(getComputedStyle(dino).getPropertyValue("bottom"));
  const obstacleRight = parseInt(getComputedStyle(obstacle).getPropertyValue("right"));
  const obstacleLeft = 800 - obstacleRight;

  if (obstacleLeft > 80 && obstacleLeft < 140 && dinoBottom < 40) {
    alert(`💀 Game Over! Your score: ${score}`);
    gameOver = true;
    gameStarted = false;
    score = 0;
    scoreDisplay.textContent = `Score: 0`;
    obstacle.style.animation = 'none';
    obstacle.offsetHeight;
    obstacle.style.animation = '';
    startScreen.style.display = 'block';
    gameContainer.style.display = 'none';
    if (outputText) outputText.textContent = "💀 Game Over!";
  }
}, 10);

setInterval(() => {
  if (gameStarted && !gameOver) {
    score++;
    scoreDisplay.textContent = `Score: ${score}`;
  }
}, 200);

// Voice Recognition
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.continuous = true;

  recognition.onstart = () => {
    console.log("🎙️ Voice recognition started");
    if (statusBox) {
      statusBox.classList.add("visible");
      statusText.textContent = "Listening...";
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
    console.log("🎤 You said:", transcript);
    if (outputText) outputText.textContent = `"${transcript}"`;

    if (transcript.includes('start')) startGame();
    else if (transcript.includes('jump')) jump();
    else if (transcript.includes('duck')) duck();
    else if (transcript.includes('home')) window.location.href = '/home.html';
    else if (transcript.includes('settings')) window.location.href = '/settings.html';
    else if (transcript.includes('calendar')) window.location.href = '/calendar.html';
    else if (transcript.includes('songs') || transcript.includes('music')) window.location.href = '/songs.html';
  };

  recognition.onerror = (event) => {
    console.error("❌ Speech recognition error:", event.error);
    if (outputText) outputText.textContent = `Error: ${event.error}`;
  };

  recognition.onend = () => {
    console.warn("🎙️ Restarting voice recognition...");
    recognition.start();
  };

  recognition.start();
} else {
  console.warn("🚫 Speech recognition not supported in this browser.");
  if (outputText) outputText.textContent = "Voice commands not supported!";
}

window.startGame = startGame;
window.jump = jump;
window.duck = duck;
