// Lead Qualification Logic
// Scores leads based on engagement and attributes

function scoreLead(lead, conversation) {
  let score = 0;
  
  // Base score from status
  const statusScores = {
    'new': 10,
    'contacted': 30,
    'qualified': 60,
    'hot': 85,
    'converted': 100
  };
  score += statusScores[lead.status] || 0;
  
  // Engagement score from conversation
  if (conversation && conversation.messages) {
    const msgCount = conversation.messages.length;
    if (msgCount > 10) score += 20;
    else if (msgCount > 5) score += 15;
    else if (msgCount > 2) score += 10;
    
    // Check for buying signals in messages
    const lastMessages = conversation.messages.slice(-5);
    const buyingSignals = ['buy', 'viewing', 'schedule', 'interested', 'price', 'budget', 'loan', 'approve'];
    
    for (const msg of lastMessages) {
      const content = (msg.content || '').toLowerCase();
      if (buyingSignals.some(signal => content.includes(signal))) {
        score += 5;
      }
    }
  }
  
  // Cap at 100
  return Math.min(score, 100);
}

function getPriority(score) {
  if (score >= 70) return 'hot';
  if (score >= 40) return 'warm';
  return 'cold';
}

module.exports = { scoreLead, getPriority };
