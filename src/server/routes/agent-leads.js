// Lead Capture API for Agent-to-Agent commerce
// Other AI agents can submit leads directly

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// In-memory lead store
const agentLeads = new Map();

// POST /api/agent/leads - Submit a lead from another agent
router.post('/leads', (req, res) => {
  const { 
    source_agent,
    client_name, 
    client_phone, 
    client_email,
    property_interest,
    budget_min,
    budget_max,
    timeline,
    notes,
    lead_score
  } = req.body;
  
  if (!client_name && !client_phone && !client_email) {
    return res.status(400).json({ 
      error: "At least one client contact method required",
      code: "MISSING_CONTACT"
    });
  }
  
  const lead = {
    id: uuidv4(),
    source: 'agent',
    source_agent: source_agent || 'unknown',
    client: {
      name: client_name,
      phone: client_phone,
      email: client_email
    },
    property_interest: property_interest || {},
    budget: {
      min: budget_min,
      max: budget_max
    },
    timeline: timeline || 'unknown',
    notes: notes || '',
    score: lead_score || 50,
    status: 'new',
    created_at: new Date().toISOString()
  };
  
  agentLeads.set(lead.id, lead);
  
  res.status(201).json({
    success: true,
    lead_id: lead.id,
    status: "lead_captured",
    pricing: { per_call: 0.001, currency: "USD" }
  });
});

// GET /api/agent/leads - List leads from agent sources
router.get('/leads', (req, res) => {
  const { status, min_score } = req.query;
  
  let leads = Array.from(agentLeads.values()).filter(l => l.source === 'agent');
  
  if (status) {
    leads = leads.filter(l => l.status === status);
  }
  
  if (min_score) {
    leads = leads.filter(l => l.score >= parseInt(min_score));
  }
  
  res.json({
    count: leads.length,
    leads: leads.slice(-50) // Last 50
  });
});

// GET /api/agent/leads/:id - Get specific lead
router.get('/leads/:id', (req, res) => {
  const lead = agentLeads.get(req.params.id);
  
  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }
  
  res.json(lead);
});

// PUT /api/agent/leads/:id - Update lead status
router.put('/leads/:id', (req, res) => {
  const lead = agentLeads.get(req.params.id);
  
  if (!lead) {
    return res.status(404).json({ error: "Lead not found" });
  }
  
  const { status, notes, score } = req.body;
  
  if (status) lead.status = status;
  if (notes) lead.notes = notes;
  if (score) lead.score = score;
  lead.updated_at = new Date().toISOString();
  
  agentLeads.set(lead.id, lead);
  
  res.json({ success: true, lead });
});

module.exports = router;
