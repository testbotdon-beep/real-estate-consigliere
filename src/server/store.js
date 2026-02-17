// Shared stores
// Used by twilio.js, telegram.js and admin.js

const conversationStore = {};
const leadsStore = new Map();
const appointmentsStore = new Map();

module.exports = { conversationStore, leadsStore, appointmentsStore };
