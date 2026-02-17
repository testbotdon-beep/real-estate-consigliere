// WhatsApp Message Templates API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');

// Get all templates
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const templates = Object.values(db.templates || {});
    res.json({ templates });
  } catch (e) {
    res.json({ templates: [] });
  }
});

// Get template by name
router.get('/:name', (req, res) => {
  try {
    const db = getDb();
    const template = Object.values(db.templates || {}).find(t => t.name === req.params.name);
    if (!template) return res.status(404).json({ error: 'Template not found' });
    res.json(template);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Create template
router.post('/', (req, res) => {
  const { name, body, buttons, category } = req.body;
  try {
    const id = uuidv4();
    updateDb(db => {
      db.templates = db.templates || {};
      db.templates[id] = {
        id,
        name,
        body,
        buttons: buttons || [],
        category: category || 'general',
        createdAt: new Date().toISOString()
      };
    });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete template
router.delete('/:id', (req, res) => {
  try {
    updateDb(db => {
      if (db.templates?.[req.params.id]) {
        delete db.templates[req.params.id];
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
