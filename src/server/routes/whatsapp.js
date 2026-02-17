// WhatsApp Webhook Routes
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { AutoReplyEngine, WhatsAppService } = require('../services/whatsapp');
const { getDb, updateDb } = require('../db-file');
const { generateResponse: generateLLMResponse } = require('../services/llm');

// Try to import KV for persistence
let kv = null;
try {
  kv = require('@vercel/kv');
} catch (e) {
  console.log('KV not available, using in-memory fallback');
}

console.log('📱 WhatsApp routes loaded');

// System-level WhatsApp config from .env
const systemWhatsApp = {
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID
};

console.log('WhatsApp config:', systemWhatsApp.phoneNumberId ? '✅ loaded' : '❌ missing');

// In-memory store for agents' WhatsApp configs
const agentWhatsApp = new Map();

// POST /api/whatsapp/webhook - Receive incoming messages
router.post('/webhook', async (req, res) => {
  const io = req.app.get('io') || { emit: () => {} };
  const db = req.app.get('db');
  
  // Handle empty payload gracefully
  if (!req.body || !req.body.entry) {
    return res.status(200).send('OK');
  }
  
  // Meta sends verification challenge for webhook setup
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  // Handle webhook verification
  if (mode === 'subscribe') {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY || 'consigliere_verify';
    if (token === verifyToken) {
      console.log('✅ WhatsApp webhook verified');
      return res.status(200).send(challenge);
    }
    return res.status(403).send('Forbidden');
  }
  
  if (!db) {
    console.log('DB not available');
    return res.status(200).send('OK');
  }
  
  try {
    const payload = req.body;
    
    // Process messages
    const messages = extractMessages(payload);
    console.log('📩 Received messages:', JSON.stringify(messages));
    console.log('📞 From:', messages[0]?.from);
    console.log('📝 Text:', messages[0]?.text);
    
    if (!messages || messages.length === 0) {
      console.log('No messages in payload');
      return res.status(200).send('OK');
    }
    
    for (const msg of messages) {
      const { from, id, text, type } = msg;
      
      // Find or create conversation (try KV first, then fallback to memory)
      let conversation = await getConversation(from);
      const isNewConversation = !conversation;
      
      if (!conversation) {
        conversation = {
          id: uuidv4(),
          phone: from,
          leadId: null,
          messages: [],
          createdAt: new Date().toISOString()
        };
        
        // Create lead for new conversation
        try {
          const leadId = uuidv4();
          updateDb(db => {
            db.conversations[from] = conversation;
            db.leads = db.leads || {};
            db.leads[leadId] = {
              id: leadId,
              phone: from,
              source: 'whatsapp',
              status: 'new',
              createdAt: new Date().toISOString(),
              lastContactAt: new Date().toISOString()
            };
          });
          conversation.leadId = leadId;
          console.log('✅ New lead created:', leadId);
        } catch (e) {
          console.log('Could not save to file DB:', e.message);
        }
      } else {
        // Update last contact time
        try {
          updateDb(db => {
            db.conversations[from] = conversation;
            if (conversation.leadId && db.leads && db.leads[conversation.leadId]) {
              db.leads[conversation.leadId].lastContactAt = new Date().toISOString();
            }
          });
        } catch (e) {}
      }
      
      // Store message
      conversation.messages.push({
        id,
        type: type || 'text',
        content: text || '',
        direction: 'inbound',
        timestamp: new Date().toISOString()
      });
      
      // Save to KV
      await saveConversation(from, conversation);
      
      // Also save to in-memory for current request
      db.conversations.set(from, conversation);
      
      // Emit to dashboard
      io.emit('new_message', {
        conversationId: conversation.id,
        phone: from,
        message: text
      });
      
      // Get conversation state
      const conversationState = conversation.state || {};
      
      // Handle button reply (interactive button click)
      if (msg.interactive || msg.buttonId) {
        conversationState.buttonReply = msg.buttonId || msg.interactive;
        // Clear the text since it's a button response
        conversation.messages[conversation.messages.length - 1].content = `BUTTON: ${msg.interactive}`;
      }
      
      // Generate auto-reply - try LLM first, fall back to rule-based
      const agent = findAgentForPhone(db, from);
      const agentName = agent?.name || "John's Assistant";
      
      // Try LLM first if configured
      let reply = null;
      let replyButtons = null;
      let newState = {};
      
      try {
        const llmResult = await generateLLMResponse(text || '', conversation.messages, agentName);
        if (llmResult) {
          reply = llmResult.message;
          console.log('🤖 LLM response:', reply.substring(0, 50));
        }
      } catch (e) {
        console.log('LLM not available, using rule-based');
      }
      
      // Fall back to rule-based if LLM didn't work
      if (!reply) {
        const replyEngine = new AutoReplyEngine(agentName);
        const replyResult = replyEngine.generateResponse(text || '', conversation.messages, conversationState);
        reply = typeof replyResult === 'string' ? replyResult : replyResult.message;
        replyButtons = typeof replyResult === 'object' ? replyResult.buttons : null;
        newState = typeof replyResult === 'object' ? replyResult.state : {};
      }
      
      // Update conversation state
      conversation.state = { ...conversationState, ...newState };
      
      // Send reply via WhatsApp API (using system credentials or agent credentials)
      const waConfig = agent?.whatsapp?.phoneNumberId ? agent.whatsapp : systemWhatsApp;
      console.log('📤 WhatsApp config:', waConfig?.phoneNumberId ? 'found' : 'missing');
      
      if (waConfig?.phoneNumberId && waConfig?.accessToken) {
        const wa = new WhatsAppService(waConfig.phoneNumberId, waConfig.accessToken);
        try {
          // Send buttons if available, otherwise send text
          if (replyButtons && replyButtons.length > 0) {
            console.log('📤 Sending buttons to:', from, 'buttons:', replyButtons);
            await wa.sendButtons(from, reply, replyButtons);
          } else {
            console.log('📤 Sending reply to:', from, 'message:', reply.substring(0, 50));
            await wa.sendMessage(from, reply);
          }
          await wa.markAsRead(id);
          console.log('✅ Reply sent successfully');
        } catch (e) {
          console.error('❌ Failed to send WhatsApp reply:', e.message);
        }
      } else {
        console.log('❌ No WhatsApp config - would have sent:', reply.substring(0, 50));
      }
      
      // Store outgoing message
      conversation.messages.push({
        id: uuidv4(),
        type: 'text',
        content: reply,
        direction: 'outbound',
        timestamp: new Date().toISOString()
      });
      
      // Save to KV after outbound message
      await saveConversation(from, conversation);
      db.conversations.set(from, conversation);
      
      // Emit reply
      io.emit('auto_reply_sent', {
        conversationId: conversation.id,
        phone: from,
        message: reply
      });
    }
    
    res.status(200).send('OK');
  } catch (error) {
    console.error('WhatsApp webhook error:', error);
    res.status(500).send('Error');
  }
});

// GET /api/whatsapp/webhook - Webhook verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY || 'consigliere_verify';
  
  if (mode === 'subscribe' && token === verifyToken) {
    console.log('✅ WhatsApp webhook verified');
    res.status(200).send(challenge);
  } else {
    res.status(403).send('Forbidden');
  }
});

// POST /api/whatsapp/connect - Agent connects their WhatsApp
router.post('/connect', async (req, res) => {
  const { agentId, phoneNumberId, accessToken, verifyToken } = req.body;
  
  if (!agentId || !phoneNumberId || !accessToken) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  
  // Store credentials
  agentWhatsApp.set(agentId, { phoneNumberId, accessToken, verifyToken });
  
  // Update agent in DB
  const db = req.app.get('db');
  const agent = db.agents.get(agentId);
  if (agent) {
    agent.whatsapp = { connected: true, phoneNumberId };
    db.agents.set(agentId, agent);
  }
  
  res.json({ success: true, message: 'WhatsApp connected successfully' });
});

// Helper functions
function extractMessages(payload) {
  const messages = [];
  
  try {
    const entries = payload.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        const values = change.value || {};
        const msgs = values.messages || [];
        for (const msg of msgs) {
          messages.push({
            from: msg.from,
            id: msg.id,
            type: msg.type,
            text: msg.text?.body,
            interactive: msg.interactive?.button_reply?.title,
            buttonId: msg.interactive?.button_reply?.id,
            timestamp: msg.timestamp
          });
        }
      }
    }
  } catch (error) {
    console.error('Extract messages error:', error);
  }
  
  return messages;
}

function findAgentForPhone(db, phone) {
  // For now, return first agent or find by phone
  for (const agent of db.agents.values()) {
    if (agent.phone === phone) return agent;
  }
  return db.agents.values().next().value;
}

// KV-based conversation storage
async function getConversation(phone) {
  if (kv) {
    try {
      const data = await kv.get(`conv:${phone}`);
      return data || null;
    } catch (e) {
      console.log('KV get error:', e.message);
    }
  }
  return null;
}

async function saveConversation(phone, conversation) {
  if (kv) {
    try {
      await kv.set(`conv:${phone}`, conversation);
    } catch (e) {
      console.log('KV set error:', e.message);
    }
  }
}

// GET /api/whatsapp/status
router.get('/status', (req, res) => {
  const hasCredentials = !!(systemWhatsApp.phoneNumberId && systemWhatsApp.accessToken);
  res.json({
    configured: hasCredentials,
    phoneNumberId: systemWhatsApp.phoneNumberId ? `${systemWhatsApp.phoneNumberId.substring(0, 8)}...` : null,
    businessAccountId: systemWhatsApp.businessAccountId ? `${systemWhatsApp.businessAccountId.substring(0, 8)}...` : null,
    kvEnabled: !!kv
  });
});

// POST /api/whatsapp/test - Send test message
router.post('/test', async (req, res) => {
  const { to, message } = req.body;
  
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' });
  }
  
  const waConfig = systemWhatsApp;
  if (!waConfig?.phoneNumberId || !waConfig?.accessToken) {
    return res.status(500).json({ error: 'WhatsApp not configured' });
  }
  
  try {
    const wa = new WhatsAppService(waConfig.phoneNumberId, waConfig.accessToken);
    await wa.sendMessage(to, message);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
