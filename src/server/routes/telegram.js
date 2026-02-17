// Telegram Bot - Sync send before response
const express = require('express');
const router = express.Router();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Debug endpoint
router.get('/test', (req, res) => {
  res.json({ 
    token: BOT_TOKEN ? 'present' : 'missing',
    tokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0
  });
});

// Quick responses
const responses = {
  greeting: ['Hey! 👋 Whats up?', 'Hi there! 👋', 'Hello! 👋 How can I help?'],
  property: ['Nice! What area you looking at?', 'Great! City fringe or outside?'], 
  buy: ['What\'s your budget range?', 'Are you looking for new launch or resale?'],
  viewing: ['Sure! Which property interests you?', 'Let me check my calendar for availability. Which property?'],
  price: ['What location you looking at?', ' Depends on district. Which area?'],
  help: ['I can help with properties, bookings, or general questions!', 'Ask me about properties or book a viewing!'],
  default: ['Got it! Tell me more 👀', 'Interesting! What else?', 'Cool!']
};

// POST /api/telegram/webhook
router.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message?.text) {
    res.status(200).send('OK');
    return;
  }
  
  const chatId = message.chat.id;
  const text = message.text;
  const t = text.toLowerCase();
  
  // Determine response category
  let reply = responses.default[Math.floor(Math.random() * responses.default.length)];
  
  if (t.includes('hi') || t.includes('hello') || t.includes('hey')) {
    reply = responses.greeting[Math.floor(Math.random() * responses.greeting.length)];
  }
  else if (t.includes('property') || t.includes('condo') || t.includes('apartment')) {
    reply = responses.property[Math.floor(Math.random() * responses.property.length)];
  }
  else if (t.includes('buy') || t.includes('purchase') || t.includes('looking for')) {
    reply = responses.buy[Math.floor(Math.random() * responses.buy.length)];
  }
  else if (t.includes('book') || t.includes('viewing') || t.includes('schedule')) {
    reply = responses.viewing[Math.floor(Math.random() * responses.viewing.length)];
  }
  else if (t.includes('price') || t.includes('cost') || t.includes('budget')) {
    reply = responses.price[Math.floor(Math.random() * responses.price.length)];
  }
  else if (t.includes('help') || t.includes('what can you do')) {
    reply = responses.help[Math.floor(Math.random() * responses.help.length)];
  }
  else if (t.includes('thanks') || t.includes('thank')) {
    reply = 'You\'re welcome! Anything else I can help with? 🙌';
  }
  else if (t.includes('ok') || t.includes('cool') || t.includes('nice')) {
    reply = '👍 What\'s next?';
  }

  // Send synchronously and WAIT for completion
  if (BOT_TOKEN) {
    try {
      await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        chat_id: chatId,
        text: reply
      }, { timeout: 10000 });
    } catch (e) {
      console.log('Send failed:', e.message);
    }
  }
  
  // Only respond after send completes (or fails)
  res.status(200).send('OK');
});

module.exports = router;
