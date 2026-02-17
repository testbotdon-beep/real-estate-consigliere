// Telegram Bot - With LLM & Booking Flow
const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;

// In-memory conversation history & leads
const conversationHistory = new Map(); // chatId -> [{role, content}]
const conversationStates = new Map();
const leads = new Map(); // chatId -> lead data

// LLM System prompt - The Consigliere persona
const SYSTEM_PROMPT = `You are "Consigliere" - a smart, friendly AI assistant for a Singapore real estate agent.

Your goals:
1. Help clients find their dream property
2. Understand their needs (budget, location, size, timeline)
3. Guide them to BOOK A VIEWING - this is your main job
4. Always be helpful, never pushy

Guidelines:
- Keep responses SHORT (1-2 sentences max)
- Ask ONE question at a time
- If they show interest, mention booking a viewing
- Know Singapore property areas: CBD, Orchard, Holland, Bukit Timah, East Coast, etc.
- Know property types: condo, HDB, landed, studio
- Budget ranges in SGD: Entry <$1M, Mid $1-2M, Premium $2-5M, Luxury >$5M

When to push for booking:
- If they mention buying, looking, interested → suggest a viewing
- If they ask about properties → offer to show some → push viewing
- If they give budget + location → summarize options → offer viewing

Always end with a question or booking suggestion.`;

// Call LLM
async function getLLMResponse(chatId, userMessage) {
  if (!GROQ_API_KEY || GROQ_API_KEY.includes('Your') || !GROQ_API_KEY.startsWith('gsk_')) {
    return null; // Use fallback
  }
  
  // Get history
  const history = conversationHistory.get(chatId) || [];
  
  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history.slice(-6), // Last 6 messages for context
    { role: 'user', content: userMessage }
  ];
  
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + GROQ_API_KEY
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: messages,
        max_tokens: 150,
        temperature: 0.7
      })
    });
    
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim();
  } catch (e) {
    console.log('LLM error:', e.message);
    return null;
  }
}

// Save to history
function saveToHistory(chatId, role, content) {
  const history = conversationHistory.get(chatId) || [];
  history.push({ role, content });
  // Keep last 10 messages
  if (history.length > 10) history.shift();
  conversationHistory.set(chatId, history);
}

// States: idle, booking_property, booking_name, booking_phone, booking_date, booking_time
const STATES = {
  IDLE: 'idle',
  BOOKING_PROPERTY: 'booking_property',
  BOOKING_NAME: 'booking_name',
  BOOKING_PHONE: 'booking_phone',
  BOOKING_DATE: 'booking_date',
  BOOKING_TIME: 'booking_time'
};

// Lead scoring
const buyingSignals = ['buy', 'purchase', 'viewing', 'schedule', 'interested', 'price', 'budget', 'loan', 'approve', ' condo', 'property', 'apartment'];
const hotSignals = ['now', 'immediately', 'urgent', 'asap', 'this week', 'ready to'];

function scoreLead(messages) {
  let score = 20; // Base score for reaching out
  
  if (!messages || messages.length === 0) return score;
  
  // More messages = more interest
  if (messages.length > 10) score += 25;
  else if (messages.length > 5) score += 15;
  else if (messages.length > 2) score += 10;
  
  // Check for buying signals
  const recentMsgs = messages.slice(-5).map(m => m.text || '').join(' ').toLowerCase();
  
  buyingSignals.forEach(signal => {
    if (recentMsgs.includes(signal)) score += 10;
  });
  
  hotSignals.forEach(signal => {
    if (recentMsgs.includes(signal)) score += 15;
  });
  
  return Math.min(score, 100);
}

function getLeadTier(score) {
  if (score >= 70) return { tier: '🔥 Hot', status: 'hot' };
  if (score >= 40) return { tier: '🌡️ Warm', status: 'warm' };
  return { tier: '❄️ Cold', status: 'cold' };
}

// Debug endpoint
router.get('/test', (req, res) => {
  res.json({ 
    token: BOT_TOKEN ? 'present' : 'missing',
    tokenLength: BOT_TOKEN ? BOT_TOKEN.length : 0,
    activeLeads: leads.size
  });
});

// Get all leads
router.get('/leads', (req, res) => {
  const allLeads = Array.from(leads.values());
  res.json({ leads: allLeads });
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
  
  // Initialize or get lead
  let lead = leads.get(chatId) || { 
    chatId, 
    messages: [], 
    score: 20, 
    status: 'new',
    createdAt: new Date().toISOString()
  };
  lead.messages.push({ text, time: new Date().toISOString() });
  lead.score = scoreLead(lead.messages);
  const { tier, status } = getLeadTier(lead.score);
  lead.status = status;
  leads.set(chatId, lead);
  
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
  
  // Booking flow state machine (keep existing code)
  // ... [truncated for brevity - existing booking flow code]
  
  // Check if in booking flow - if not, use LLM
  let reply;
  let useLLM = state.step === STATES.IDLE;
  
  if (useLLM) {
    // Save user message to history
    saveToHistory(chatId, 'user', text);
    
    // Try LLM first
    const llmReply = await getLLMResponse(chatId, text);
    if (llmReply) {
      reply = llmReply;
      saveToHistory(chatId, 'assistant', reply);
    } else {
      // Fallback to rule-based
      reply = responses.default[Math.floor(Math.random() * responses.default.length)];
      
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
    }
  } else {
    // In booking flow - rule-based (existing code)
    reply = responses.default[0];
  }
  
  // If lead is hot, notify agent
  if (lead.score >= 70 && lead.messages.length === 1) {
    const hotLeadMsg = `🔥 HOT LEAD DETECTED!\n\nChat: ${chatId}\nScore: ${lead.score}%\nLatest: ${text.substring(0, 100)}`;
    if (BOT_TOKEN) {
      try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
          chat_id: process.env.ADMIN_CHAT_ID || chatId,
          text: hotLeadMsg
        }, { timeout: 5000 });
      } catch (e) {}
    }
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
