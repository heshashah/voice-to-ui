// Dummy data - in real use, replace this with a fetch from the backend
const moodEntries = [
  { mood: 'anxious today', time: '15/7/2025, 9:21:23 PM' },
  { mood: 'happy', time: '15/7/2025, 9:16:25 PM' },
  { mood: 'happy today', time: '15/7/2025, 8:42:00 PM' }
];

const moodHistoryContainer = document.getElementById('mood-history');

moodEntries.forEach((entry, index) => {
  const div = document.createElement('div');
  div.className = 'mood-entry';
  div.innerHTML = `
    <div>
      <strong>${index + 1}. ${entry.mood}</strong><br/>
      <small>🕒 ${entry.time}</small>
    </div>
    <button class="chat-btn" onclick="openChat('${entry.mood}')">🧠 Chat</button>
  `;
  moodHistoryContainer.appendChild(div);
});

let selectedMood = '';

function openChat(mood) {
  selectedMood = mood;
  document.getElementById('chatModal').style.display = 'block';
  document.getElementById('chatLog').innerHTML = `
    <p><strong>You:</strong> I felt ${mood}</p>
    <p><strong>Bot:</strong> I'm here for you. Want to tell me more?</p>
  `;
}

function closeModal() {
  document.getElementById('chatModal').style.display = 'none';
  document.getElementById('chat-input').value = '';
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();
  if (!message) return;

  const log = document.getElementById('chatLog');
  log.innerHTML += `<p><strong>You:</strong> ${message}</p>`;

  const response = getSmartReply(message);
  log.innerHTML += `<p><strong>Bot:</strong> ${response}</p>`;
  input.value = '';
  log.scrollTop = log.scrollHeight;
}

function getSmartReply(msg) {
  const lower = msg.toLowerCase();
  if (lower.includes('anxious') || lower.includes('stress')) {
    return 'Try deep breathing or journaling your thoughts. Would you like a breathing exercise?';
  }
  if (lower.includes('tired') || lower.includes('exhausted')) {
    return 'Maybe a short nap or stepping outside for fresh air could help.';
  }
  if (lower.includes('sad')) {
    return 'It’s okay to feel sad. Talking to someone or listening to music might help.';
  }
  if (lower.includes('alone') || lower.includes('lonely')) {
    return 'You’re not alone. Reaching out to a friend or family member can make a difference.';
  }
  if (lower.includes('happy') || lower.includes('great')) {
    return 'That’s wonderful! Keep doing what’s making you feel good.';
  }
  if (lower.includes('angry') || lower.includes('mad')) {
    return 'Try counting to 10 or taking a short walk to cool off. I’m here if you want to talk more.';
  }
  return 'Thank you for sharing. Would you like some tips to improve your mood?';
}
