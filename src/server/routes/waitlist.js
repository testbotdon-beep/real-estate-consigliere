// Waitlist API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');

// Get all waitlist entries
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const waitlist = Object.values(db.waitlist || {});
    res.json({ waitlist });
  } catch (e) {
    res.json({ waitlist: [] });
  }
});

// Add to waitlist
router.post('/', (req, res) => {
  const { email, name, phone, notes } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }
  
  try {
    const id = uuidv4();
    updateDb(db => {
      db.waitlist = db.waitlist || {};
      db.waitlist[id] = {
        id,
        email,
        name: name || '',
        phone: phone || '',
        notes: notes || '',
        status: 'pending',
        createdAt: new Date().toISOString()
      };
    });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
