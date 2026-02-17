// Webhook Registry for Agent-to-Agent callbacks
// Other agents can register to receive notifications

const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');

// Registered webhooks
const webhooks = new Map();

// POST /api/agent/webhooks - Register a webhook
router.post('/webhooks', (req, res) => {
  const { url, events, secret } = req.body;
  
  if (!url) {
    return res.status(400).json({ error: "URL required" });
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "Invalid URL" });
  }
  
  const webhook = {
    id: uuidv4(),
    url,
    events: events || ['lead.created', 'booking.confirmed'],
    secret: secret || uuidv4(),
    active: true,
    created_at: new Date().toISOString(),
    stats: {
      total_calls: 0,
      successful: 0,
      failed: 0
    }
  };
  
  webhooks.set(webhook.id, webhook);
  
  res.status(201).json({
    success: true,
    webhook_id: webhook.id,
    secret: webhook.secret,
    message: "Webhook registered. Use secret to verify callbacks."
  });
});

// GET /api/agent/webhooks - List webhooks
router.get('/webhooks', (req, res) => {
  const hooks = Array.from(webhooks.values());
  res.json({ count: hooks.length, webhooks: hooks });
});

// DELETE /api/agent/webhooks/:id - Remove webhook
router.delete('/webhooks/:id', (req, res) => {
  if (webhooks.has(req.params.id)) {
    webhooks.delete(req.params.id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "Webhook not found" });
  }
});

// POST /api/agent/events - Trigger an event (internal)
router.post('/events', (req, res) => {
  const { event, data } = req.body;
  
  if (!event) {
    return res.status(400).json({ error: "Event type required" });
  }
  
  // Find webhooks listening for this event
  const listeners = Array.from(webhooks.values()).filter(h => 
    h.active && h.events.includes(event)
  );
  
  const results = [];
  
  for (const hook of listeners) {
    // In production, would actually call the webhook
    hook.stats.total_calls++;
    
    results.push({
      webhook_id: hook.id,
      url: hook.url,
      status: "simulated"
    });
  }
  
  res.json({
    event,
    delivered: results.length,
    results
  });
});

module.exports = router;
