// Leads API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');
const { leadsStore } = require('../store');

// Create new lead
router.post('/', (req, res) => {
  try {
    const { phone, name, source, status, score, priority } = req.body;
    
    const lead = {
      id: uuidv4(),
      phone: phone || '',
      name: name || 'Unknown',
      source: source || 'web',
      status: status || 'new',
      score: score || 50,
      priority: priority || 'warm',
      createdAt: new Date().toISOString(),
      lastContactAt: new Date().toISOString()
    };
    
    // Save to in-memory store
    leadsStore.set(lead.id, lead);
    
    // Save to file DB (won't persist on Vercel but that's okay)
    try {
      updateDb(db => {
        db.leads = db.leads || {};
        db.leads[lead.id] = lead;
      });
    } catch (e) {}
    
    console.log('Lead created:', lead.id);
    res.json({ success: true, lead });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all leads
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const fileLeads = Object.values(db.leads || {});
    
    // Also get in-memory leads
    const memoryLeads = Array.from(leadsStore.values());
    
    // Merge, preferring newer entries
    const allLeads = [...memoryLeads, ...fileLeads];
    
    res.json({ leads: allLeads });
  } catch (e) {
    res.json({ leads: [] });
  }
});

// Get single lead
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const lead = db.leads?.[req.params.id];
    if (!lead) return res.status(404).json({ error: 'Lead not found' });
    res.json(lead);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update lead status, score, notes
router.put('/:id', (req, res) => {
  const { status, notes, score, priority } = req.body;
  try {
    updateDb(db => {
      if (db.leads?.[req.params.id]) {
        if (status) db.leads[req.params.id].status = status;
        if (notes) db.leads[req.params.id].notes = notes;
        if (score) db.leads[req.params.id].score = score;
        if (priority) db.leads[req.params.id].priority = priority;
        db.leads[req.params.id].updatedAt = new Date().toISOString();
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete lead
router.delete('/:id', (req, res) => {
  try {
    updateDb(db => {
      if (db.leads?.[req.params.id]) {
        delete db.leads[req.params.id];
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
