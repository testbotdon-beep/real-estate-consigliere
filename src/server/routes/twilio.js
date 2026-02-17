// Twilio WhatsApp Webhook Routes
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { conversationStore } = require('../store');

console.log('📱 Twilio WhatsApp routes loaded');

// System-level Twilio config from .env
const systemTwilio = {
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  whatsappNumber: process.env.TWILIO_WHATSAPP_NUMBER
};

console.log('Twilio config:', systemTwilio.accountSid ? '✅ loaded' : '❌ missing');

// In-memory conversation store (shared via store.js)

async function getConversation(phone) {
  const key = phone.replace('whatsapp:', '');
  return conversationStore[key] || null;
}

async function saveConversation(phone, conversation) {
  const key = phone.replace('whatsapp:', '');
  conversationStore[key] = conversation;
}

// POST /api/twilio/webhook - Receive incoming messages from Twilio
router.post('/webhook', async (req, res) => {
  console.log('📩 Twilio webhook hit');
  
  // Set content type for TwiML
  res.type('text/xml');
  
  try {
    const from = req.body.From;
    const body = req.body.Body;
    const messageSid = req.body.MessageSid;
    
    console.log('📩 From:', from, 'Body:', body);
    
    if (!from || !body) {
      return res.send('<Response></Response>');
    }
    
    // Get or create conversation
    let conversation = await getConversation(from);
    if (!conversation) {
      conversation = {
        id: uuidv4(),
        phone: from.replace('whatsapp:', ''),
        messages: [],
        createdAt: new Date().toISOString()
      };
    }
    
    // Add user message
    conversation.messages.push({
      id: messageSid || uuidv4(),
      type: 'text',
      content: body,
      direction: 'inbound',
      timestamp: new Date().toISOString()
    });
    
    // Generate AI response
    let reply;
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (apiKey && apiKey.startsWith('gsk_') && !apiKey.includes('Your')) {
      try {
        const messages = [
          { role: 'system', content: 'You are Sarah, a friendly Singapore real estate assistant. Keep replies short (1-2 sentences). Ask ONE question at a time.' },
          ...conversation.messages.slice(-8).map(m => ({ 
            role: m.direction === 'inbound' ? 'user' : 'assistant', 
            content: m.content 
          }))
        ];
        
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: messages,
            max_tokens: 80
          })
        });
        
        const data = await response.json();
        reply = data.choices?.[0]?.message?.content?.trim();
        console.log('🤖 AI:', reply?.substring(0, 50));
      } catch (e) {
        console.log('AI error:', e.message);
      }
    }
    
    // Fallback
    if (!reply) {
      const lower = body.toLowerCase();
      if (lower.includes('hi') || lower.includes('hello')) {
        reply = "Hi! I'm Sarah. What's your budget for a property?";
      } else if (lower.includes('$') || lower.includes('million')) {
        reply = "Great! Which area or location do you prefer?";
      } else if (lower.includes('east') || lower.includes('west') || lower.includes('north')) {
        reply = "How many bedrooms do you need?";
      } else if (lower.includes('1') || lower.includes('2') || lower.includes('3')) {
        reply = "Would you like new launch or resale?";
      } else {
        reply = "What's your budget for a property?";
      }
    }
    
    // Add assistant message
    conversation.messages.push({
      id: uuidv4(),
      type: 'text',
      content: reply,
      direction: 'outbound',
      timestamp: new Date().toISOString()
    });
    
    await saveConversation(from, conversation);
    
    return res.send('<Response><Message>' + reply + '</Message></Response>');
    
  } catch (error) {
    console.error('❌ Error:', error);
    return res.send('<Response></Response>');
  }
});

// GET /api/twilio/webhook - For Twilio webhook verification  
router.get('/webhook', (req, res) => {
  res.status(200).send('OK');
});

// Status endpoint
router.get('/status', (req, res) => {
  res.json({
    configured: !!(systemTwilio.accountSid && systemTwilio.whatsappNumber),
    provider: 'twilio'
  });
});

module.exports = router;
