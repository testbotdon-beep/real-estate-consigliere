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

// POST /api/telegram/webhook
router.post('/webhook', async (req, res) => {
  const message = req.body.message;
  if (!message?.text) {
    res.status(200).send('OK');
    return;
  }
  
  const chatId = message.chat.id;
  const text = message.text;
  
  // Determine response
  let reply = 'Cool!';
  const t = text.toLowerCase();
  
  if (t.includes('hi') || t.includes('hello')) reply = 'Hey! 👋 Whats up?';
  else if (t.includes('property') || t.includes('buy') || t.includes('condo')) reply = 'Nice! What area you looking at?';
  else if (t.includes('book') || t.includes('viewing')) reply = 'Sure thing! Which property?';
  else if (t.includes('price')) reply = 'What location?';
  else if (t.includes('help')) reply = 'I can help with properties or viewings!';

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
