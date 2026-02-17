// Telegram Bot - With Booking Flow
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// In-memory conversation states
const conversationStates = new Map();

// States: idle, booking_property, booking_name, booking_phone, booking_date, booking_time
const STATES = {
  IDLE: 'idle',
  BOOKING_PROPERTY: 'booking_property',
  BOOKING_NAME: 'booking_name',
  BOOKING_PHONE: 'booking_phone',
  BOOKING_DATE: 'booking_date',
  BOOKING_TIME: 'booking_time'
};

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
  viewing: ['Sure! Which property would you like to view?', 'Let me help you book a viewing. Which property interests you?'],
  price: ['What location you looking at?', 'Depends on district. Which area?'],
  help: ['I can help with properties, bookings, or general questions!', 'Ask me about properties or book a viewing!'],
  default: ['Got it! Tell me more 👀', 'Interesting! What else?', 'Cool!'],
  booking_start: ['Great! Which property would you like to view?'],
  booking_name: ['Perfect! What\'s your name?'],
  booking_phone: ['Nice to meet you! What\'s your phone number?'],
  booking_date: ['When would you like to view? (e.g., tomorrow, friday, or a date like 20 Feb)'],
  booking_time: ['What time works for you? (e.g., 2pm, 3:30pm)'],
  booking_confirm: ['Awesome! I\'ll send your viewing request to the agent. They\'ll confirm shortly! ✅'],
  booking_cancel: ['No problem! Let me know when you need help again 👋'],
  unknown_date: ['Sorry, I didn\'t get that. Try: tomorrow, friday, or a date like 20 Feb'],
  unknown_time: ['Sorry, try a time like: 2pm, 3:30pm, or 14:00']
};

// Parse relative dates
function parseDate(text) {
  const t = text.toLowerCase();
  const today = new Date();
  
  if (t.includes('tomorrow')) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
  
  if (t.includes('today')) {
    return today.toISOString().split('T')[0];
  }
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (t.includes(days[i])) {
      const d = new Date(today);
      const diff = (i + 7 - today.getDay()) % 7 || 7;
      d.setDate(d.getDate() + diff);
      return d.toISOString().split('T')[0];
    }
  }
  
  // Try regex for dates like "20 Feb" or "Feb 20"
  const dateMatch = text.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (dateMatch) {
    const monthMap = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const month = monthMap[dateMatch[2].toLowerCase()];
    const day = parseInt(dateMatch[1]);
    const d = new Date(today.getFullYear(), month, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString().split('T')[0];
  }
  
  return null;
}

// Parse time
function parseTime(text) {
  const t = text.toLowerCase();
  
  // Match patterns like 2pm, 3:30pm, 14:00, 2:30 pm
  let match = t.match(/(\d{1,2})[:.](\d{2})?\s*(am|pm)?/);
  if (match) {
    let hour = parseInt(match[1]);
    const min = match[2] ? parseInt(match[2]) : 0;
    const period = match[3];
    
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    
    return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
  }
  
  match = t.match(/(\d{1,2})\s*(am|pm)/);
  if (match) {
    let hour = parseInt(match[1]);
    if (match[2] === 'pm' && hour < 12) hour += 12;
    if (match[2] === 'am' && hour === 12) hour = 0;
    return `${hour.toString().padStart(2, '0')}:00`;
  }
  
  return null;
}

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
  
  // Get or init conversation state
  let state = conversationStates.get(chatId) || { step: STATES.IDLE, data: {} };
  
  // Handle cancel anytime
  if (t === 'cancel' || t === 'stop' || t === 'nevermind') {
    if (state.step !== STATES.IDLE) {
      conversationStates.set(chatId, { step: STATES.IDLE, data: {} });
      await sendMessage(chatId, responses.booking_cancel);
      res.status(200).send('OK');
      return;
    }
  }
  
  // Booking flow state machine
  if (state.step === STATES.BOOKING_PROPERTY) {
    state.data.property = text;
    state.step = STATES.BOOKING_NAME;
    conversationStates.set(chatId, state);
    await sendMessage(chatId, responses.booking_name[0]);
    res.status(200).send('OK');
    return;
  }
  
  if (state.step === STATES.BOOKING_NAME) {
    state.data.name = text;
    state.step = STATES.BOOKING_PHONE;
    conversationStates.set(chatId, state);
    await sendMessage(chatId, responses.booking_phone[0]);
    res.status(200).send('OK');
    return;
  }
  
  if (state.step === STATES.BOOKING_PHONE) {
    state.data.phone = text;
    state.step = STATES.BOOKING_DATE;
    conversationStates.set(chatId, state);
    await sendMessage(chatId, responses.booking_date[0]);
    res.status(200).send('OK');
    return;
  }
  
  if (state.step === STATES.BOOKING_DATE) {
    const date = parseDate(text);
    if (!date) {
      await sendMessage(chatId, responses.unknown_date[0]);
      res.status(200).send('OK');
      return;
    }
    state.data.date = date;
    state.step = STATES.BOOKING_TIME;
    conversationStates.set(chatId, state);
    await sendMessage(chatId, responses.booking_time[0]);
    res.status(200).send('OK');
    return;
  }
  
  if (state.step === STATES.BOOKING_TIME) {
    const time = parseTime(text);
    if (!time) {
      await sendMessage(chatId, responses.unknown_time[0]);
      res.status(200).send('OK');
      return;
    }
    state.data.time = time;
    
    // Complete booking
    const { property, name, phone, date } = state.data;
    
    // Send to agent (in production, this would call the appointments API)
    const bookingMsg = `📅 VIEWING REQUEST\n\nProperty: ${property}\nName: ${name}\nPhone: ${phone}\nDate: ${date} at ${time}`;
    
    // Notify agent (Don)
    if (BOT_TOKEN) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: process.env.ADMIN_CHAT_ID || chatId,
          text: bookingMsg
        }, { timeout: 10000 });
      } catch (e) {
        console.log('Agent notification failed:', e.message);
      }
    }
    
    // Confirm to client
    await sendMessage(chatId, `${responses.booking_confirm[0]}\n\n📍 ${property}\n👤 ${name}\n📱 ${phone}\n📆 ${date} at ${time}`);
    
    // Reset state
    conversationStates.set(chatId, { step: STATES.IDLE, data: {} });
    res.status(200).send('OK');
    return;
  }
  
  // Normal conversation - determine response
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
  else if (t.includes('book') || t.includes('viewing') || t.includes('schedule') || t.includes('appointment')) {
    // Start booking flow
    state.step = STATES.BOOKING_PROPERTY;
    state.data = {};
    conversationStates.set(chatId, state);
    reply = responses.booking_start[0];
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

  await sendMessage(chatId, reply);
  res.status(200).send('OK');
});

// Helper to send message
async function sendMessage(chatId, text) {
  if (!BOT_TOKEN) return;
  try {
    await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      chat_id: chatId,
      text: text
    }, { timeout: 10000 });
  } catch (e) {
    console.log('Send failed:', e.message);
  }
}

module.exports = router;
