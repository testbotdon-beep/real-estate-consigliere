// Agents API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');

// Get agent
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const agent = db.agents?.[req.params.id];
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agent });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create/update agent
router.put('/:id', (req, res) => {
  try {
    updateDb(db => {
      db.agents = db.agents || {};
      db.agents[req.params.id] = {
        ...db.agents[req.params.id],
        ...req.body,
        id: req.params.id,
        updatedAt: new Date().toISOString()
      };
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete agent
router.delete('/:id', (req, res) => {
  try {
    updateDb(db => {
      if (db.agents?.[req.params.id]) {
        delete db.agents[req.params.id];
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
