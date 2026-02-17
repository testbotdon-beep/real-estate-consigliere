// Simple Admin Dashboard API
const express = require('express');
const router = express.Router();
const { conversationStore } = require('../store');

// Get all conversations
router.get('/conversations', (req, res) => {
  const conversations = Object.entries(conversationStore).map(([key, conv]) => ({
    phone: conv.phone || key,
    lastMessage: conv.messages?.[conv.messages.length - 1]?.content || '',
    lastMessageAt: conv.messages?.[conv.messages.length - 1]?.timestamp,
    messageCount: conv.messages?.length || 0,
    createdAt: conv.createdAt
  }));
  
  conversations.sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
  
  res.json({ conversations });
});

// Get specific conversation
router.get('/conversations/:phone', (req, res) => {
  const phone = req.params.phone;
  const conversation = conversationStore[phone] || conversationStore['whatsapp:' + phone];
  
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json(conversation);
});

// Stats - enhanced with all metrics
router.get('/stats', (req, res) => {
  const store = conversationStore;
  const total = Object.keys(store).length;
  const messages = Object.values(store).reduce((sum, c) => sum + (c.messages?.length || 0), 0);
  
  // Get data from DB
  const db = require('../db-file').getDb();
  const leads = Object.values(db.leads || {});
  const appointments = Object.values(db.appointments || {});
  const properties = Object.values(db.properties || {});
  const waitlist = Object.values(db.waitlist || {});
  const notifications = Object.values(db.notifications || {});
  
  // Lead stats
  const hotLeads = leads.filter(l => l.priority === 'hot').length;
  const qualifiedLeads = leads.filter(l => l.status === 'qualified').length;
  
  // Appointment stats
  const pendingAppts = appointments.filter(a => a.status === 'pending').length;
  const confirmedAppts = appointments.filter(a => a.status === 'confirmed').length;
  
  res.json({ 
    totalConversations: total, 
    totalMessages: messages,
    leads: {
      total: leads.length,
      hot: hotLeads,
      qualified: qualifiedLeads
    },
    appointments: {
      total: appointments.length,
      pending: pendingAppts,
      confirmed: confirmedAppts
    },
    properties: properties.length,
    waitlist: waitlist.length,
    notifications: notifications.length
  });
});

module.exports = router;
