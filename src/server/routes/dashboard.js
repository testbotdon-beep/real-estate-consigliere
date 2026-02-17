const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Dashboard API - Agent-facing

// POST /api/dashboard/register - Register new agent
router.post('/register', async (req, res) => {
  const { name, email, phone, tier } = req.body;
  
  const db = req.app.get('db');
  
  const agent = {
    id: uuidv4(),
    name,
    email,
    phone,
    tier: tier || 'soldier', // soldier, capo, consigliere
    whatsapp: { connected: false },
    calendar: { connected: false },
    createdAt: new Date().toISOString()
  };
  
  db.agents.set(agent.id, agent);
  
  res.json({ success: true, agent });
});

// GET /api/dashboard/:agentId - Get agent dashboard data
router.get('/:agentId', async (req, res) => {
  const { agentId } = req.params;
  
  const db = req.app.get('db');
  const agent = db.agents.get(agentId);
  
  if (!agent) {
    return res.status(404).json({ error: 'Agent not found' });
  }
  
  // Get stats
  const conversations = Array.from(db.conversations.values())
    .filter(c => c.agentId === agentId);
  
  const totalMessages = conversations.reduce((sum, c) => sum + c.messages.length, 0);
  const totalAppointments = Array.from(db.appointments.values())
    .filter(a => a.agentId === agentId && a.status === 'confirmed').length;
  
  // This week stats
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const newLeadsThisWeek = conversations.filter(c => 
    new Date(c.createdAt) > weekAgo
  ).length;
  
  const dashboard = {
    agent: {
      id: agent.id,
      name: agent.name,
      tier: agent.tier,
      connected: {
        whatsapp: agent.whatsapp?.connected || false,
        calendar: agent.calendar?.connected || false
      }
    },
    stats: {
      totalConversations: conversations.length,
      totalMessages,
      totalAppointments,
      newLeadsThisWeek
    },
    recentConversations: conversations.slice(0, 10).map(c => ({
      id: c.id,
      phone: c.phone,
      lastMessage: c.messages[c.messages.length - 1]?.content || '',
      messageCount: c.messages.length,
      updatedAt: c.messages[c.messages.length - 1]?.timestamp || c.createdAt
    })),
    upcomingAppointments: Array.from(db.appointments.values())
      .filter(a => a.agentId === agentId && a.status === 'confirmed')
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
      .slice(0, 5)
  };
  
  res.json(dashboard);
});

// GET /api/dashboard/:agentId/conversations - Get all conversations
router.get('/:agentId/conversations', async (req, res) => {
  const { agentId } = req.params;
  
  const db = req.app.get('db');
  const conversations = Array.from(db.conversations.values())
    .filter(c => c.agentId === agentId);
  
  res.json({ conversations });
});

// GET /api/dashboard/:agentId/conversations/:conversationId - Get specific conversation
router.get('/:agentId/conversations/:conversationId', async (req, res) => {
  const { conversationId } = req.params;
  
  const db = req.app.get('db');
  const conversation = db.conversations.get(conversationId);
  
  if (!conversation) {
    return res.status(404).json({ error: 'Conversation not found' });
  }
  
  res.json(conversation);
});

// POST /api/dashboard/:agentId/leads - Create/update lead
router.post('/:agentId/leads', async (req, res) => {
  const { agentId } = req.params;
  const { phone, name, status, source, notes } = req.body;
  
  const db = req.app.get('db');
  
  const lead = {
    id: uuidv4(),
    agentId,
    phone,
    name: name || phone,
    status: status || 'new', // new, contacted, qualified, converted, lost
    source: source || 'whatsapp',
    notes,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  db.leads.set(lead.id, lead);
  
  res.json({ success: true, lead });
});

// GET /api/dashboard/:agentId/leads - Get all leads
router.get('/:agentId/leads', async (req, res) => {
  const { agentId } = req.params;
  const { status } = req.query;
  
  const db = req.app.get('db');
  let leads = Array.from(db.leads.values())
    .filter(l => l.agentId === agentId);
  
  if (status) {
    leads = leads.filter(l => l.status === status);
  }
  
  res.json({ leads });
});

// PUT /api/dashboard/:agentId/leads/:leadId - Update lead
router.put('/:agentId/leads/:leadId', async (req, res) => {
  const { leadId } = req.params;
  const updates = req.body;
  
  const db = req.app.get('db');
  const lead = db.leads.get(leadId);
  
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }
  
  const updated = { 
    ...lead, 
    ...updates, 
    updatedAt: new Date().toISOString() 
  };
  db.leads.set(leadId, updated);
  
  res.json({ success: true, lead: updated });
});

module.exports = router;
