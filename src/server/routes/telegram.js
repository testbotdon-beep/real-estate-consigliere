const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

// ============================================
// GOOGLE OAUTH - Calendar Connection
// ============================================
const { google } = require('googleapis');

const oauth2Client = new google.auth.OAuth2(
  (process.env.GOOGLE_CLIENT_ID || '').trim(),
  (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
  (process.env.GOOGLE_REDIRECT_URI || '').trim()
);

// Get OAuth URL for agent to connect their calendar
router.get('/calendar/connect', (req, res) => {
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
  // Redirect to Google's OAuth page
  res.redirect(authUrl);
});

// OAuth callback - store tokens
router.get('/calendar/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.redirect('/?calendar=error');
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    await kvSet('google_tokens', tokens);
    res.redirect('/?calendar=connected');
  } catch (error) {
    console.error('OAuth error:', error.message);
    res.redirect('/?calendar=error&msg=' + encodeURIComponent(error.message));
  }
});

// Check if calendar is connected
router.get('/calendar/status', async (req, res) => {
  const tokens = await kvGet('google_tokens');
  res.json({ connected: !!tokens });
});

// Create calendar event using OAuth
async function createCalendarEventOAuth(booking) {
  const tokens = await kvGet('google_tokens');
  if (!tokens) {
    return { success: false, error: 'Calendar not connected. Use /calendar/connect' };
  }
  
  try {
    // Create fresh OAuth client and set credentials
    const oauth = new google.auth.OAuth2(
      (process.env.GOOGLE_CLIENT_ID || '').trim(),
      (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      (process.env.GOOGLE_REDIRECT_URI || '').trim()
    );
    oauth.setCredentials(tokens);
    
    // Check if token expired and refresh if needed
    if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
      const { credentials } = await oauth.refreshAccessToken();
      await kvSet('google_tokens', credentials);
      oauth.setCredentials(credentials);
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth });
    
    const dateTimeStr = booking.date + 'T' + booking.time + ':00+08:00';
    const startDateTime = new Date(dateTimeStr);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
    
    const event = {
      summary: '🏠 Viewing: ' + booking.property,
      description: 'Buyer: ' + booking.name + '\nPhone: ' + booking.phone + '\nEmail: ' + (booking.email || 'N/A'),
      start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Singapore' },
      end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Singapore' },
      attendees: booking.email ? [{ email: booking.email }] : [],
      sendUpdates: 'all'
    };
    
    const response = await calendar.events.insert({ calendarId: 'primary', resource: event });
    return { success: true, htmlLink: response.data.htmlLink };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Update calendar event (reschedule)
async function updateCalendarEventOAuth(booking) {
  const tokens = await kvGet('google_tokens');
  if (!tokens) return { success: false, error: 'Calendar not connected' };
  
  try {
    let result = tokens;
    if (typeof tokens === 'string') result = JSON.parse(tokens);
    
    const oauth = new google.auth.OAuth2(
      (process.env.GOOGLE_CLIENT_ID || '').trim(),
      (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      (process.env.GOOGLE_REDIRECT_URI || '').trim()
    );
    oauth.setCredentials(result);
    
    if (result.expiry_date && result.expiry_date < Date.now()) {
      const { credentials } = await oauth.refreshAccessToken();
      await kvSet('google_tokens', credentials);
      oauth.setCredentials(credentials);
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth });
    
    // Find event by description (phone number)
    const list = await calendar.events.list({ 
      calendarId: 'primary', 
      q: booking.phone,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    if (list.data.items && list.data.items.length > 0) {
      const event = list.data.items[0];
      const dateTimeStr = booking.date + 'T' + booking.time + ':00+08:00';
      const startDateTime = new Date(dateTimeStr);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      
      const updated = await calendar.events.patch({
        calendarId: 'primary',
        eventId: event.id,
        resource: {
          summary: '🏠 Viewing: ' + booking.property,
          description: 'Buyer: ' + booking.name + '\nPhone: ' + booking.phone + '\nEmail: ' + (booking.email || 'N/A'),
          start: { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Singapore' },
          end: { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Singapore' },
          attendees: booking.email ? [{ email: booking.email }] : [],
          sendUpdates: 'all'
        }
      });
      return { success: true, htmlLink: updated.data.htmlLink };
    }
    return { success: false, error: 'Event not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

// Delete calendar event (cancel)
async function deleteCalendarEventOAuth(phone) {
  const tokens = await kvGet('google_tokens');
  if (!tokens) return { success: false, error: 'Calendar not connected' };
  
  try {
    let result = tokens;
    if (typeof tokens === 'string') result = JSON.parse(tokens);
    
    const oauth = new google.auth.OAuth2(
      (process.env.GOOGLE_CLIENT_ID || '').trim(),
      (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
      (process.env.GOOGLE_REDIRECT_URI || '').trim()
    );
    oauth.setCredentials(result);
    
    if (result.expiry_date && result.expiry_date < Date.now()) {
      const { credentials } = await oauth.refreshAccessToken();
      await kvSet('google_tokens', credentials);
      oauth.setCredentials(credentials);
    }
    
    const calendar = google.calendar({ version: 'v3', auth: oauth });
    
    // Find event by phone
    const list = await calendar.events.list({ 
      calendarId: 'primary', 
      q: phone,
      singleEvents: true,
      orderBy: 'startTime'
    });
    
    if (list.data.items && list.data.items.length > 0) {
      await calendar.events.delete({ calendarId: 'primary', eventId: list.data.items[0].id });
      return { success: true };
    }
    return { success: false, error: 'Event not found' };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

const KV_URL = process.env.KV_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// Extract host from KV_URL (which contains credentials)
function getUpstashUrl(path) {
  if (!KV_URL) return null;
  // KV_URL is like: rediss://default:TOKEN@host:6379
  const match = KV_URL.match(/rediss?:\/\/([^@]+)@(.+):(\d+)/);
  if (!match) return KV_URL + '/' + path;
  // Return https URL: https://host/path
  return 'https://' + match[2] + '/' + path;
}

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const url = getUpstashUrl('get/' + key);
    const res = await fetch(url, { headers: { 'Authorization': 'Bearer ' + KV_TOKEN } });
    if (!res.ok) return null;
    const data = await res.json();
    let result = data.result;
    // Handle stringified JSON
    if (typeof result === 'string') {
      try { result = JSON.parse(result); } catch (e) { }
    }
    return result;
  } catch (e) { return null; }
}

async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) return;
  try {
    const url = getUpstashUrl('set/' + key);
    await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify(value)
    });
  } catch (e) { console.log('kvSet error:', e.message); }
}

const conversationStates = new Map();
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const AGENT_CHAT_ID = process.env.AGENT_CHAT_ID;
const GOOGLE_CALENDAR_ID = 'primary'; // Use primary calendar - service account needs access

function getProperties() {
  const env = process.env.PROPERTY_LIST;
  if (env) return env.split(',').map(p => p.trim());
  return ['Orchard Residences', 'The Sail', 'Marina Bay Suites', 'CBD Lifestyle', 'Holland Village', 'Bukit Timah', 'East Coast', 'Sentosa'];
}

const STATES = {
  IDLE: 'idle',
  BOOK_PROPERTY: 'book_property',
  BOOK_NAME: 'book_name',
  BOOK_PHONE: 'book_phone',
  BOOK_EMAIL: 'book_email',
  BOOK_DATE: 'book_date',
  BOOK_TIME: 'book_time',
  BOOK_CONFIRM: 'book_confirm',
  RESCHEDULE_PROPERTY: 'reschedule_property',
  RESCHEDULE_NAME: 'reschedule_name',
  RESCHEDULE_NEW_DATE: 'reschedule_new_date',
  RESCHEDULE_NEW_TIME: 'reschedule_new_time',
  RESCHEDULE_CONFIRM: 'reschedule_confirm',
  CANCEL_PROPERTY: 'cancel_property',
  CANCEL_NAME: 'cancel_name',
  CANCEL_CONFIRM: 'cancel_confirm'
};

async function loadState(chatId) {
  if (conversationStates.has(chatId)) return conversationStates.get(chatId);
  const state = await kvGet('state:' + chatId);
  if (state) { conversationStates.set(chatId, state); return state; }
  return { step: STATES.IDLE, data: {}, updatedAt: Date.now() };
}

async function saveState(chatId, state) {
  state.updatedAt = Date.now();
  conversationStates.set(chatId, state);
  await kvSet('state:' + chatId, state);
}

async function createCalendarEvent(booking) {
  // Use OAuth instead of service account
  return createCalendarEventOAuth(booking);
}

async function saveBooking(booking) {
  const bookings = (await kvGet('bookings')) || [];
  bookings.push({ ...booking, createdAt: new Date().toISOString() });
  await kvSet('bookings', bookings);
}

function matchProperty(input) {
  const props = getProperties();
  const n = input.toLowerCase().trim();
  const exact = props.find(p => p.toLowerCase() === n);
  if (exact) return { match: exact, confidence: 100 };
  const contains = props.filter(p => p.toLowerCase().includes(n) || n.includes(p.toLowerCase()));
  if (contains.length === 1) return { match: contains[0], confidence: 90 };
  if (contains.length > 1) return { match: contains, confidence: 50 };
  return { match: null, confidence: 0 };
}

function validatePhone(phone) {
  const cleaned = phone.replace(/[\s\-\(\)]/g, '');
  const match = cleaned.match(/^(?:65)?[89]\d{7}$/);
  if (match) return { valid: true, phone: cleaned.length === 8 ? '65' + cleaned : cleaned };
  return { valid: false };
}

function validateEmail(email) {
  return email.includes('@') && email.includes('.') && email.length > 5;
}

function parseDate(text) {
  const t = text.toLowerCase().trim();
  
  // Get current date in Singapore timezone
  const now = new Date();
  const sgNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' }));
  sgNow.setHours(0, 0, 0, 0);
  const sgDay = sgNow.getDay();
  
  if (t === 'today') return formatSGDate(sgNow);
  if (t === 'tomorrow') { const d = new Date(sgNow); d.setDate(d.getDate() + 1); return formatSGDate(d); }
  
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (t.includes(days[i])) { 
      const d = new Date(sgNow); 
      let diff = (i + 7 - sgDay) % 7;
      if (diff === 0) diff = 7; // If today is the same day, go to next week
      d.setDate(d.getDate() + diff); 
      return formatSGDate(d); 
    }
  }
  
  // Try parsing dates like "20 Feb" or "Feb 20"
  const match = t.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);
  if (match) {
    const day = parseInt(match[1]);
    const monthMap = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
    const month = monthMap[match[2]];
    const d = new Date(today.getFullYear(), month, day);
    if (d < today) d.setFullYear(d.getFullYear() + 1);
    return formatSGDate(d);
  }
  
  return null;
}

function formatSGDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseTime(text) {
  const t = text.toLowerCase().trim();
  if (t.includes('morning')) return '10:00';
  if (t.includes('afternoon')) return '14:00';
  if (t.includes('evening')) return '18:00';
  let match = t.match(/(\d{1,2})[:.]?(\d{2})?\s*(am|pm)?/i);
  if (match) {
    let hour = parseInt(match[1]);
    const min = match[2] ? parseInt(match[2]) : 0;
    const period = match[3];
    if (period === 'pm' && hour < 12) hour += 12;
    if (period === 'am' && hour === 12) hour = 0;
    if (hour >= 0 && hour <= 23 && min >= 0 && min <= 59) return hour.toString().padStart(2, '0') + ':' + min.toString().padStart(2, '0');
  }
  return null;
}

async function getLLMResponse(msg) {
  if (!GROQ_API_KEY || !GROQ_API_KEY.startsWith('gsk_')) return null;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_API_KEY },
      body: JSON.stringify({ model: 'llama-3.1-8b-instant', messages: [{ role: 'system', content: 'Friendly real estate assistant.' }, { role: 'user', content: msg }], max_tokens: 80 })
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content;
  } catch (e) { return null; }
}

async function sendMessage(chatId, text, replyMarkup = null) {
  if (!BOT_TOKEN) return;
  try {
    const payload = { chat_id: chatId, text };
    if (replyMarkup) payload.reply_markup = replyMarkup;
    await axios.post('https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage', payload, { timeout: 10000 });
  } catch (e) { console.log('Send error:', e.message); }
}

function mainMenuKeyboard() { return { keyboard: [[{ text: '📅 Book a Viewing' }, { text: '📝 Reschedule' }], [{ text: '❌ Cancel Viewing' }, { text: '❓ Help' }]], resize_keyboard: true }; }
function yesNoKeyboard() { return { inline_keyboard: [[{ text: '✅ Yes', callback_data: 'yes' }, { text: '✏️ Edit', callback_data: 'no' }]] }; }
function propertyKeyboard() {
  const props = getProperties();
  const rows = [[{ text: '🔍 Type Property', callback_data: 'prop_search' }]];
  for (let i = 0; i < props.length; i += 2) {
    const row = [{ text: props[i], callback_data: 'prop_' + props[i] }];
    if (i + 1 < props.length) row.push({ text: props[i + 1], callback_data: 'prop_' + props[i + 1] });
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

function formatDate(d) { 
  // Parse as Singapore date to avoid timezone issues
  const [year, month, day] = d.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString('en-SG', { weekday: 'short', day: 'numeric', month: 'short' }); 
}
function formatTime(t) { const [h, m] = t.split(':'); const hour = parseInt(h); return (hour % 12 || 12) + ':' + m + ' ' + (hour >= 12 ? 'PM' : 'AM'); }

router.post('/webhook', async (req, res) => {
  try {
    const callbackQuery = req.body.callback_query;
    if (callbackQuery) {
      const chatId = callbackQuery.message.chat.id;
      const data = callbackQuery.data;
      try { await axios.post('https://api.telegram.org/bot' + BOT_TOKEN + '/answerCallbackQuery', { callback_query_id: callbackQuery.id }); } catch (e) { }
      let state = await loadState(chatId);
      if (data === 'book_viewing') { await saveState(chatId, { step: STATES.BOOK_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '🏠 Which property?', propertyKeyboard()); }
      else if (data === 'reschedule') { await saveState(chatId, { step: STATES.RESCHEDULE_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '📝 Which property?'); }
      else if (data === 'cancel_viewing') { await saveState(chatId, { step: STATES.CANCEL_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '❌ Which property?'); }
      else if (data === 'prop_search') { await sendMessage(chatId, 'Type property name:'); }
      else if (data.startsWith('prop_')) {
        const prop = data.replace('prop_', '');
        state.data.property = prop;
        if (state.step === STATES.BOOK_PROPERTY) { state.step = STATES.BOOK_NAME; await saveState(chatId, state); await sendMessage(chatId, 'Great! ' + prop + ' — what\'s your name?'); }
        else if (state.step === STATES.RESCHEDULE_PROPERTY) { state.step = STATES.RESCHEDULE_NAME; await saveState(chatId, state); await sendMessage(chatId, 'What name?'); }
        else if (state.step === STATES.CANCEL_PROPERTY) { state.step = STATES.CANCEL_NAME; await saveState(chatId, state); await sendMessage(chatId, 'What name?'); }
      }
      else if (data === 'yes' || data === 'no') {
        if (state.step === STATES.BOOK_CONFIRM && data === 'yes') {
          const booking = { id: uuidv4(), ...state.data, status: 'confirmed', createdAt: new Date().toISOString() };
          const calResult = await createCalendarEvent(booking);
          await saveBooking(booking);
          if (AGENT_CHAT_ID) await sendMessage(AGENT_CHAT_ID, '📅 NEW BOOKING!\n\n' + booking.property + '\n' + booking.name + '\n' + booking.phone + '\n' + formatDate(booking.date) + ' ' + formatTime(booking.time));
          const calMsg = calResult.success ? '\n\n📧 Calendar invite sent!\n' + (calResult.htmlLink || '') : '\n\n⚠️ Calendar failed: ' + (calResult.error || 'unknown');
          await sendMessage(chatId, '✅ BOOKED!\n\n' + booking.property + '\n' + formatDate(booking.date) + ' at ' + formatTime(booking.time) + calMsg);
          await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() });
        }
        else if (state.step === STATES.BOOK_CONFIRM && data === 'no') { await saveState(chatId, { step: STATES.BOOK_PROPERTY, data: state.data, updatedAt: Date.now() }); await sendMessage(chatId, 'OK, let\'s start over.\n\nWhich property?', propertyKeyboard()); }
        else if (state.step === STATES.RESCHEDULE_CONFIRM && data === 'yes') {
          const calResult = await updateCalendarEventOAuth(state.data);
          const calMsg = calResult.success ? '\n\n📧 Calendar updated!\n' + (calResult.htmlLink || '') : '\n\n⚠️ Calendar update failed: ' + (calResult.error || 'unknown');
          await sendMessage(chatId, '✅ RESCHEDULED!\n\n' + state.data.property + '\n' + formatDate(state.data.date) + ' at ' + formatTime(state.data.time) + calMsg);
          if (AGENT_CHAT_ID) await sendMessage(AGENT_CHAT_ID, '📝 RESCHEDULED\n\n' + state.data.property + '\n' + state.data.name + '\n' + formatDate(state.data.date) + ' ' + formatTime(state.data.time));
          await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() });
        }
        else if (state.step === STATES.RESCHEDULE_CONFIRM && data === 'no') { await sendMessage(chatId, 'No change made.', mainMenuKeyboard()); await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() }); }
        else if (state.step === STATES.CANCEL_CONFIRM && data === 'yes') {
          const calResult = await deleteCalendarEventOAuth(state.data.phone);
          await sendMessage(chatId, '❌ CANCELLED\n\n' + state.data.property + '\n' + state.data.name + (calResult.success ? '\n\n📧 Calendar event removed' : ''));
          if (AGENT_CHAT_ID) await sendMessage(AGENT_CHAT_ID, '❌ CANCELLED\n\n' + state.data.property + '\n' + state.data.name);
          await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() });
        }
        else if (state.step === STATES.CANCEL_CONFIRM && data === 'no') { await sendMessage(chatId, 'No problem!', mainMenuKeyboard()); await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() }); }
      }
      res.status(200).send('OK'); return;
    }

    const message = req.body.message;
    if (!message?.text) { res.status(200).send('OK'); return; }
    const chatId = message.chat.id;
    const text = message.text;
    const t = text.toLowerCase().trim();

    if (t === '/start' || t === '/menu') { await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '👋 Hi! I\'m Consigliere.\n\nWhat would you like to do?', mainMenuKeyboard()); res.status(200).send('OK'); return; }
    if (t === '📅 book a viewing' || t === 'book a viewing') { await saveState(chatId, { step: STATES.BOOK_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '🏠 Which property?', propertyKeyboard()); res.status(200).send('OK'); return; }
    if (t === '📝 reschedule' || t === 'reschedule') { await saveState(chatId, { step: STATES.RESCHEDULE_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '📝 Which property?'); res.status(200).send('OK'); return; }
    if (t === '❌ cancel viewing' || t === 'cancel viewing') { await saveState(chatId, { step: STATES.CANCEL_PROPERTY, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, '❌ Which property?'); res.status(200).send('OK'); return; }
    if (t === '❓ help' || t === 'help') { await sendMessage(chatId, '📅 Book\n📝 Reschedule\n❌ Cancel\n\nUse the menu!', mainMenuKeyboard()); res.status(200).send('OK'); return; }
    if (t === 'cancel') { await saveState(chatId, { step: STATES.IDLE, data: {}, updatedAt: Date.now() }); await sendMessage(chatId, 'Cancelled.', mainMenuKeyboard()); res.status(200).send('OK'); return; }

    let state = await loadState(chatId);
    switch (state.step) {
      case STATES.IDLE:
        const llm = await getLLMResponse(text);
        await sendMessage(chatId, llm || 'Use the menu to book, reschedule, or cancel.', mainMenuKeyboard());
        break;
      case STATES.BOOK_PROPERTY:
        const pm = matchProperty(text);
        if (pm.confidence >= 90) { state.data.property = pm.match; state.step = STATES.BOOK_NAME; await saveState(chatId, state); await sendMessage(chatId, 'Great! ' + pm.match + ' — what\'s your name?'); }
        else if (pm.confidence === 50) { const kb = { inline_keyboard: pm.match.map(p => [{ text: p, callback_data: 'prop_' + p }]) }; await sendMessage(chatId, 'Did you mean?', kb); }
        else { await sendMessage(chatId, 'Property not found.', propertyKeyboard()); }
        break;
      case STATES.BOOK_NAME:
        if (text.length < 2) { await sendMessage(chatId, 'Enter valid name.'); break; }
        state.data.name = text; state.step = STATES.BOOK_PHONE; await saveState(chatId, state);
        await sendMessage(chatId, 'Nice to meet you, ' + text + '! What\'s your phone?');
        break;
      case STATES.BOOK_PHONE:
        let pv = validatePhone(text);
        if (!pv.valid) { await sendMessage(chatId, 'Invalid phone. Try: 91234567'); break; }
        state.data.phone = pv.phone; state.step = STATES.BOOK_EMAIL; await saveState(chatId, state);
        await sendMessage(chatId, 'What\'s your email?');
        break;
      case STATES.BOOK_EMAIL:
        if (!validateEmail(text)) { await sendMessage(chatId, 'Invalid email. Try: john@email.com'); break; }
        state.data.email = text; state.step = STATES.BOOK_DATE; await saveState(chatId, state);
        await sendMessage(chatId, 'What date? (tomorrow, Friday, 20 Feb)');
        break;
      case STATES.BOOK_DATE:
        const dp = parseDate(text);
        if (!dp) { await sendMessage(chatId, 'Invalid date. Try: tomorrow, Friday'); break; }
        state.data.date = dp; state.step = STATES.BOOK_TIME; await saveState(chatId, state);
        await sendMessage(chatId, 'What time? (2pm, 3:30pm, afternoon)');
        break;
      case STATES.BOOK_TIME:
        const tp = parseTime(text);
        if (!tp) { await sendMessage(chatId, 'Invalid time. Try: 2pm'); break; }
        state.data.time = tp; state.step = STATES.BOOK_CONFIRM; await saveState(chatId, state);
        await sendMessage(chatId, '📋 Confirm\n\n' + state.data.property + '\n' + state.data.name + '\n' + state.data.phone + '\n' + state.data.email + '\n' + formatDate(state.data.date) + ' ' + formatTime(state.data.time) + '\n\nConfirm?', yesNoKeyboard());
        break;
      case STATES.RESCHEDULE_PROPERTY:
        const rs = matchProperty(text);
        if (rs.confidence >= 90) { state.data.property = rs.match; state.step = STATES.RESCHEDULE_NAME; await saveState(chatId, state); await sendMessage(chatId, 'What name?'); }
        else { await sendMessage(chatId, 'Property not found.'); }
        break;
      case STATES.RESCHEDULE_NAME:
        state.data.name = text; state.step = STATES.RESCHEDULE_NEW_DATE; await saveState(chatId, state); await sendMessage(chatId, 'New date?');
        break;
      case STATES.RESCHEDULE_NEW_DATE:
        const rd = parseDate(text);
        if (!rd) { await sendMessage(chatId, 'Invalid date.'); break; }
        state.data.date = rd; state.step = STATES.RESCHEDULE_NEW_TIME; await saveState(chatId, state); await sendMessage(chatId, 'New time?');
        break;
      case STATES.RESCHEDULE_NEW_TIME:
        const rt = parseTime(text);
        if (!rt) { await sendMessage(chatId, 'Invalid time.'); break; }
        state.data.time = rt; state.step = STATES.RESCHEDULE_CONFIRM; await saveState(chatId, state);
        await sendMessage(chatId, '🔄 Confirm reschedule to ' + formatDate(state.data.date) + ' ' + formatTime(state.data.time) + '?', yesNoKeyboard());
        break;
      case STATES.CANCEL_PROPERTY:
        const cp = matchProperty(text);
        if (cp.confidence >= 90) { state.data.property = cp.match; state.step = STATES.CANCEL_NAME; await saveState(chatId, state); await sendMessage(chatId, 'What name?'); }
        else { await sendMessage(chatId, 'Property not found.'); }
        break;
      case STATES.CANCEL_NAME:
        state.data.name = text; state.step = STATES.CANCEL_CONFIRM; await saveState(chatId, state);
        await sendMessage(chatId, '⚠️ Cancel ' + state.data.property + ' under ' + state.data.name + '?', yesNoKeyboard());
        break;
      default:
        await sendMessage(chatId, 'Type /start to begin.', mainMenuKeyboard());
    }
  } catch (e) { console.log('Error:', e.message); }
  res.status(200).send('OK');
});

module.exports = router;
