// Notifications API - handles emails, push notifications for appointments
const express = require('express');
const router = express.Router();
const { getDb, updateDb } = require('../db-file');

// Send appointment notification (placeholder - needs email service)
router.post('/appointment', async (req, res) => {
  const { type, appointmentId, clientEmail, agentEmail } = req.body;
  
  try {
    const db = getDb();
    const appointment = db.appointments?.[appointmentId];
    
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }
    
    // TODO: Integrate with email service (SendGrid, Mailgun, etc.)
    // For now, log the notification
    console.log(`📧 Notification: ${type} for appointment ${appointmentId}`);
    console.log(`   Client: ${appointment.clientName} (${appointment.clientPhone})`);
    console.log(`   Property: ${appointment.propertyAddress}`);
    console.log(`   Time: ${appointment.startTime}`);
    
    // Store notification record
    const notificationId = Date.now().toString();
    updateDb(db => {
      db.notifications = db.notifications || {};
      db.notifications[notificationId] = {
        id: notificationId,
        type,
        appointmentId,
        status: 'sent',
        createdAt: new Date().toISOString()
      };
    });
    
    res.json({ success: true, notificationId, message: 'Notification sent (logged)' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get notifications
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const notifications = Object.values(db.notifications || {}).reverse();
    res.json({ notifications });
  } catch (e) {
    res.json({ notifications: [] });
  }
});

module.exports = router;
