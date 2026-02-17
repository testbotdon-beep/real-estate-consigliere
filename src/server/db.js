// Simple in-memory database
const db = {
  agents: new Map(),
  conversations: new Map(),
  appointments: new Map(),
  waitlist: new Set()
};

// Load waitlist from localStorage if available
try {
  const saved = localStorage.getItem('waitlist');
  if (saved) {
    JSON.parse(saved).forEach(email => db.waitlist.add(email));
  }
} catch (e) {}

module.exports = { db };
