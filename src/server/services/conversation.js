// Improved conversational AI
function generateSmartReply(message, history) {
  const lower = message.toLowerCase();
  
  // Get the last assistant message (what we asked)
  const lastAssistantMsg = [...history].reverse().find(m => m.direction === 'outbound');
  const lastQuestion = lastAssistantMsg?.content?.toLowerCase() || '';
  
  console.log('📝 Last question:', lastQuestion);
  console.log('📝 User said:', lower);
  
  // Check what was the last question and respond accordingly
  if (lastQuestion.includes('budget')) {
    // User answered budget question
    if (lower.includes('$') || lower.includes('million') || lower.includes('k ') || /\d/.test(lower)) {
      // Ask about location next
      return "Got it! Which area or location do you prefer?";
    }
    return "What's your estimated budget?";
  }
  
  if (lastQuestion.includes('location') || lastQuestion.includes('area')) {
    // User answered location question
    if (lower.includes('east') || lower.includes('west') || lower.includes('north') || lower.includes('south') || 
        lower.includes('tampines') || lower.includes('bedok') || lower.includes('jurong') || lower.includes('central') ||
        lower.includes('pasir') || lower.includes('sentosa')) {
      // Ask about bedrooms next
      return "Great! How many bedrooms do you need?";
    }
    return "Which area interests you - like East, West, North, or Central?";
  }
  
  if (lastQuestion.includes('bedroom')) {
    // User answered bedrooms question
    if (/\d/.test(lower)) {
      // Ask about property type
      return "Would you prefer new launch or resale?";
    }
    return "How many bedrooms - 1, 2, or 3?";
  }
  
  if (lastQuestion.includes('new launch') || lastQuestion.includes('resale')) {
    // User answered property type - try to book
    return "I'll arrange a viewing. What date and time works for you?";
  }
  
  if (lastQuestion.includes('date') || lastQuestion.includes('time') || lastQuestion.includes('viewing')) {
    // User gave a time
    return "I'll confirm that with the agent. You'll receive a calendar invite shortly!";
  }
  
  // First message - check if user gave any info upfront
  if (lower.includes('$') || lower.includes('million') || lower.includes('k ')) {
    return "Great! Which area or location do you prefer?";
  }
  
  if (lower.includes('east') || lower.includes('west') || lower.includes('north') || lower.includes('south') ||
      lower.includes('tampines') || lower.includes('bedok') || lower.includes('jurong')) {
    return "What's your budget for that area?";
  }
  
  if (lower.includes('1 bedroom') || lower.includes('2 bedroom') || lower.includes('3 bedroom')) {
    return "Got it! What's your budget?";
  }
  
  // Greeting
  if (lower.includes('hi') || lower.includes('hello') || lower.includes('hey')) {
    return "Hi! I'm Sarah. What type of property are you looking for?";
  }
  
  // Thank you
  if (lower.includes('thank')) {
    return "You're welcome! Let me know if you'd like to schedule a viewing.";
  }
  
  // Default - ask about budget first
  return "What's your budget for the property?";
}

module.exports = { generateSmartReply };
