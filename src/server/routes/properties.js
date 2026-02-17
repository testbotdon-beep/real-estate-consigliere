// Properties API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');

// Get all properties
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const properties = Object.values(db.properties || {});
    res.json({ properties });
  } catch (e) {
    res.json({ properties: [] });
  }
});

// Get single property
router.get('/:id', (req, res) => {
  try {
    const db = getDb();
    const property = db.properties?.[req.params.id];
    if (!property) return res.status(404).json({ error: 'Property not found' });
    res.json(property);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Add property
router.post('/', (req, res) => {
  const { name, price, size, location, address, description } = req.body;
  try {
    const id = uuidv4();
    updateDb(db => {
      db.properties = db.properties || {};
      db.properties[id] = {
        id,
        name,
        price,
        size,
        location,
        address,
        description,
        status: 'active',
        createdAt: new Date().toISOString()
      };
    });
    res.json({ success: true, id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update property
router.put('/:id', (req, res) => {
  const updates = req.body;
  try {
    updateDb(db => {
      if (db.properties?.[req.params.id]) {
        db.properties[req.params.id] = { ...db.properties[req.params.id], ...updates };
        db.properties[req.params.id].updatedAt = new Date().toISOString();
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Delete property
router.delete('/:id', (req, res) => {
  try {
    updateDb(db => {
      if (db.properties?.[req.params.id]) {
        delete db.properties[req.params.id];
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
