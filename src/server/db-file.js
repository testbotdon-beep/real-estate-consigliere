const fs = require('fs');
const path = require('path');

let db = null;

// Simple in-memory DB for Vercel serverless
function getDb() {
  if (!db) {
    db = {
      agents: {},
      leads: {},
      appointments: {},
      properties: {},
      conversations: {},
      waitlist: []
    };
    
    // Try to load from file if exists (development only)
    try {
      const DB_FILE = path.join(__dirname, '../../data/db.json');
      if (fs.existsSync(DB_FILE)) {
        const fileData = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        db = { ...db, ...fileData };
      }
    } catch (e) {
      // File doesn't exist or can't read - that's fine for serverless
    }
  }
  return db;
}

function updateDb(updater) {
  try {
    const currentDb = getDb();
    updater(currentDb);
    db = currentDb;
    
    // Try to save to file (development only)
    try {
      const DB_FILE = path.join(__dirname, '../../data/db.json');
      const dataDir = path.dirname(DB_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) {
      // Can't write - that's fine for serverless
    }
  } catch (e) {
    console.log('DB update error:', e.message);
  }
}

module.exports = { getDb, updateDb };
