// Simple test endpoint to verify bot can send messages
const express = require('express');
const router = express.Router();

const telegramConfig = {
  botToken: process.env.TELEGRAM_BOT_TOKEN
};

router.get('/test-bot', async (req, res) => {
  const chatId = req.query.chat_id || '1856542353';
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text: '🔔 Test message from bot - verification' 
      })
    });
    
    const result = await response.json();
    res.json({ success: result.ok, result: result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
