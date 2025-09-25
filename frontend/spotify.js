const loginBtn = document.getElementById('login-btn');
const micBtn = document.getElementById('mic-btn');
const statusBox = document.getElementById('status-box');

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

let token = null;

const CLIENT_ID = 'd518b0e202c34573b6cb7abc354a5f66';  
const REDIRECT_URI = 'https://8a5262ee343a.ngrok-free.app/callback.html'; 
const SCOPES = 'streaming user-read-playback-state user-modify-playback-state user-read-currently-playing';

function loginWithSpotify() {
  const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${SCOPES}`;
  window.location.href = authUrl;
}

loginBtn.onclick = loginWithSpotify;

if (window.location.hash.includes('access_token')) {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  token = params.get('access_token');
  window.localStorage.setItem('spotify_token', token);
  window.location.href = 'songs.html';
} else {
  token = window.localStorage.getItem('spotify_token');
}

// Voice Recognition
if (SpeechRecognition) {
  const recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.lang = 'en-US';

  micBtn.onclick = () => {
    recognition.start();
    statusBox.textContent = '🎧 Listening...';
  };

  recognition.onresult = async (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase();
    statusBox.textContent = `🎙 You said: "${transcript}"`;

    if (transcript.includes('play')) {
      const songName = transcript.replace('play', '').trim();
      playSong(songName);
    } else if (transcript.includes('login with spotify')) {
      loginWithSpotify(); 
    }
  };
} else {
  alert("Speech recognition not supported in this browser.");
}
