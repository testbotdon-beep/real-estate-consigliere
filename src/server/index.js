require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const whatsappRoutes = require('./routes/whatsapp');
const twilioRoutes = require('./routes/twilio');
const calendarRoutes = require('./routes/calendar');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const leadsRoutes = require('./routes/leads');
const appointmentsRoutes = require('./routes/appointments');
const propertiesRoutes = require('./routes/properties');
const templatesRoutes = require('./routes/templates');
const agentsRoutes = require('./routes/agents');
const waitlistRoutes = require('./routes/waitlist');
const notificationsRoutes = require('./routes/notifications');
const adminDashboardRoutes = require('./routes/admin-dashboard');
const testBotRoutes = require("./routes/test-bot");
const telegramRoutes = require('./routes/telegram');
const agentRoutes = require('./routes/agent');
const agentLeadRoutes = require('./routes/agent-leads');
const agentWebhookRoutes = require('./routes/agent-webhooks');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// In-memory database (replace with proper DB later)
const db = {
  agents: new Map(),
  leads: new Map(),
  conversations: new Map(),
  appointments: new Map()
};

app.set('db', db);

// Routes
app.use('/api/twilio', twilioRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/leads', leadsRoutes);
app.use('/api/appointments', appointmentsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/agents', agentsRoutes);
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/admin-dashboard', adminDashboardRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/agent', agentLeadRoutes);
app.use('/api/agent', agentWebhookRoutes);
app.use('/api/test-bot', testBotRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// For Vercel - serve the frontend for all other routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/admin.html'));
});

app.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/status.html'));
});

app.get('/setup', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/setup.html'));
});

app.get('/webhook-test', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/webhook-test.html'));
});

app.get('/book', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/book.html'));
});

app.get('/calendar-connect', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/calendar-connect.html'));
});

app.get('/pitch', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/pitch.html'));
});

app.get('/one-pager', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/one-pager.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start server if running locally
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🦅 Consigliere server running on port ${PORT}`);
    console.log(`📨 Telegram: Using webhooks (set via /api/telegram/set-webhook)`);
  });
}

module.exports = app;
