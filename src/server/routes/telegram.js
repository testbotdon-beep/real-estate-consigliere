// Telegram Bot - Sync send before response
const express = require('express');
const router = express.Router();
const axios = require('axios');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// POST /api/telegram/webhook
router.post('/webhook', async (req, res) => {
  // Send response immediately
  res.status(200).send('OK');
  
  try {
    const message = req.body.message;
    if (!message?.text) return;
    
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

    // Send synchronously
    if (BOT_TOKEN) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: chatId,
          text: reply
        }, { timeout: 5000 });
      } catch (e) {
        console.log('Send failed:', e.message);
      }
    }
  } catch (e) {
    console.log('Error:', e.message);
  }
});

module.exports = router;
