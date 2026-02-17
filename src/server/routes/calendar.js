// Google Calendar Routes
const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { CalendarService, SchedulingEngine } = require('../services/calendar');

// In-memory store for agents' calendar configs
const agentCalendars = new Map();

// GET /api/calendar/auth-url - Get OAuth URL for agent
router.get('/auth-url/:agentId', (req, res) => {
  const { agentId } = req.params;
  
  const { google } = require('googleapis');
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ];
  
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: agentId,
    prompt: 'consent'
  });
  
  res.json({ authUrl });
});

// GET /api/calendar/callback - OAuth callback
router.get('/callback', async (req, res) => {
  const { code, state: agentId } = req.query;
  
  if (!code || !agentId) {
    return res.redirect('/?calendar=error&message=missing_params');
  }
  
  try {
    const { google } = require('googleapis');
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );
    
    const { tokens } = await oauth2Client.getToken(code);
    
    // Store tokens for this agent
    agentCalendars.set(agentId, { tokens, oauth2Client });
    
    res.redirect('/?calendar=connected');
  } catch (error) {
    console.error('OAuth callback error:', error);
    res.redirect('/?calendar=error&message=' + encodeURIComponent(error.message));
  }
});

// POST /api/calendar/connect - Agent connects their calendar
router.post('/connect', async (req, res) => {
  const { agentId, credentials } = req.body;
  
  if (!agentId) {
    return res.status(400).json({ error: 'Missing agentId' });
  }
  
  try {
    // Store credentials (in production, encrypt these)
    const calendarService = new CalendarService({
      web: {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uris: [process.env.GOOGLE_REDIRECT_URI]
      }
    });
    
    agentCalendars.set(agentId, calendarService);
    
    res.json({ success: true, message: 'Calendar connected successfully' });
  } catch (error) {
    console.error('Calendar connect error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/calendar/events/:agentId - Get agent's events
router.get('/events/:agentId', async (req, res) => {
  const { agentId } = req.params;
  const { startDate, endDate } = req.query;
  
  const calendarService = agentCalendars.get(agentId);
  
  if (!calendarService) {
    return res.json({ 
      events: [],
      message: 'Calendar not connected - connect at /api/calendar/auth-url/:agentId'
    });
  }
  
  try {
    const events = await calendarService.getEvents(20);
    res.json({ events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calendar/availability - Check availability
router.post('/availability', async (req, res) => {
  const { agentId, date } = req.body;
  
  const calendarService = agentCalendars.get(agentId);
  
  if (!calendarService) {
    // Return default slots for demo
    const slots = [];
    for (let hour = 9; hour < 19; hour++) {
      slots.push({ time: `${hour}:00`, available: true });
    }
    return res.json({ date, slots });
  }
  
  try {
    // Get busy times
    const dateStr = new Date(date).toISOString().split('T')[0];
    const startTime = `${dateStr}T09:00:00`;
    const endTime = `${dateStr}T19:00:00`;
    
    const busy = await calendarService.getFreeBusy(startTime, endTime);
    
    // Calculate available slots
    const slots = [];
    for (let hour = 9; hour < 19; hour++) {
      const slotStart = new Date(`${dateStr}T${hour}:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60000);
      
      const isBusy = busy.some(b => {
        const busyStart = new Date(b.start.dateTime || b.start);
        const busyEnd = new Date(b.end.dateTime || b.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });
      
      slots.push({
        time: `${hour}:00`,
        available: !isBusy
      });
    }
    
    res.json({ date, slots });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/calendar/schedule - Schedule a viewing
router.post('/schedule', async (req, res) => {
  const { agentId, clientName, clientPhone, propertyId, propertyAddress, date, time, duration, notes } = req.body;
  
  const io = req.app.get('io') || { emit: () => {} };
  const calendarService = agentCalendars.get(agentId);
  
  // Create appointment
  const appointment = {
    id: uuidv4(),
    agentId: agentId || 'default',
    clientName,
    clientPhone,
    propertyAddress: propertyAddress || 'TBD',
    startTime: new Date(`${date}T${time}`).toISOString(),
    duration: duration || 60,
    status: 'pending',
    notes,
    createdAt: new Date().toISOString()
  };
  
  // Emit to dashboard
  io.emit('appointment_requested', appointment);
  
  // Try to create calendar event if connected
  if (calendarService) {
    try {
      const startTime = new Date(`${date}T${time}`).toISOString();
      const endTime = new Date(new Date(startTime).getTime() + 60*60*1000).toISOString();
      
      const event = {
        summary: `Property Viewing: ${propertyAddress}`,
        description: `Client: ${clientName}\nPhone: ${clientPhone}\nNotes: ${notes || 'N/A'}`,
        start: { dateTime: startTime, timeZone: 'Asia/Singapore' },
        end: { dateTime: endTime, timeZone: 'Asia/Singapore' }
      };
      
      const result = await calendarService.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all'
      });
      
      appointment.calendarEventId = result.data.id;
      appointment.status = 'confirmed';
      
      io.emit('appointment_confirmed', appointment);
    } catch (error) {
      console.error('Calendar booking error:', error.message);
    }
  }
  
  res.json({ success: true, appointment });
});

// PUT /api/calendar/appointments/:id - Approve/decline appointment
router.put('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  const { action } = req.body; // 'approve' or 'decline'
  
  const io = req.app.get('io') || { emit: () => {} };
  
  // In production, load from DB
  const appointment = { id, status: action === 'approve' ? 'confirmed' : 'declined' };
  
  io.emit('appointment_updated', appointment);
  
  res.json({ success: true, appointment });
});

// DELETE /api/calendar/appointments/:id - Cancel appointment
router.delete('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  
  const io = req.app.get('io') || { emit: () => {} };
  
  io.emit('appointment_cancelled', { id });
  
  res.json({ success: true });
});

module.exports = router;
