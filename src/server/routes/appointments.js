// Appointments API
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { getDb, updateDb } = require('../db-file');
const { appointmentsStore } = require('../store');

// Create new appointment
router.post('/', (req, res) => {
  try {
    const { agentId, clientName, clientPhone, propertyAddress, startTime, duration, status, source } = req.body;
    
    const appointment = {
      id: uuidv4(),
      agentId: agentId || 'default',
      clientName: clientName || 'Unknown',
      clientPhone: clientPhone || 'N/A',
      propertyAddress: propertyAddress || 'TBD',
      startTime: startTime || new Date().toISOString(),
      duration: duration || 60,
      status: status || 'pending',
      source: source || 'web',
      createdAt: new Date().toISOString()
    };
    
    // Save to in-memory store
    appointmentsStore.set(appointment.id, appointment);
    
    // Save to file DB
    try {
      updateDb(db => {
        db.appointments = db.appointments || {};
        db.appointments[appointment.id] = appointment;
      });
    } catch (e) {}
    
    console.log('Appointment created:', appointment.id);
    res.json({ success: true, appointment });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get all appointments
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const fileAppointments = Object.values(db.appointments || {});
    
    // Also get in-memory appointments
    const memoryAppointments = Array.from(appointmentsStore.values());
    
    // Merge
    const allAppointments = [...memoryAppointments, ...fileAppointments];
    
    res.json({ appointments: allAppointments });
  } catch (e) {
    res.json({ appointments: [] });
  }
});

// Get appointments by status
router.get('/status/:status', (req, res) => {
  try {
    const db = getDb();
    const appointments = Object.values(db.appointments || {}).filter(
      a => a.status === req.params.status
    );
    res.json({ appointments });
  } catch (e) {
    res.json({ appointments: [] });
  }
});

// Update appointment status
router.put('/:id', (req, res) => {
  const { status } = req.body;
  try {
    updateDb(db => {
      if (db.appointments?.[req.params.id]) {
        db.appointments[req.params.id].status = status;
        db.appointments[req.params.id].updatedAt = new Date().toISOString();
      }
    });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
