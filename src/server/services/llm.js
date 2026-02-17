// LLM Service for natural conversations using Groq
const Groq = require('groq-sdk');

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.OPENAI_API_KEY // Groq uses the same env var since keys start with gsk_
});

// System prompt for the real estate agent assistant
const SYSTEM_PROMPT = `You are a friendly, professional personal assistant for a real estate agent in Singapore. Your goal is to help potential clients find properties and schedule viewings.

IMPORTANT:
- Keep responses SHORT and NATURAL. Like texting a friend.
- Never use bullet points or numbered lists.
- Never use em dashes or formal language.
- Respond to questions naturally.
- If they ask about properties, ask about their budget and preferred area.
- When they seem ready, suggest scheduling a viewing.
- Sound like a real person, not a bot.

The agent you work for is named {{agent_name}}. You handle inquiries for them.

Current property listings:
- Bedok Resale Condo, $1.48M, 3BR, East Singapore
- Tampines New Launch, $1.52M, 3BR, East Singapore  
- Pasir Ris Rise, $1.45M, 3BR, East Singapore

When scheduling a viewing, ask for:
1. Which property they're interested in
2. Preferred date and time
3. Their name and contact number

Once you have all the details, confirm the booking with the user.`;

async function generateResponse(userMessage, conversationHistory = [], agentName = "the agent") {
  // Check if LLM is configured (Groq keys start with gsk_)
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    console.log('No Groq API key found');
    return null;
  }
  
  try {
    // Build conversation context
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT.replace('{{agent_name}}', agentName) }
    ];
    
    // Add recent conversation history (last 6 messages)
    const recentHistory = conversationHistory.slice(-6);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.direction === 'inbound' ? 'user' : 'assistant',
        content: msg.content
      });
    }
    
    // Add current message
    messages.push({ role: 'user', content: userMessage });
    
    // Call Groq
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: messages,
      temperature: 0.7,
      max_tokens: 256,
    });
    
    const response = completion.choices[0]?.message?.content;
    
    if (response) {
      return {
        message: response,
        fromLLM: true
      };
    }
    
    return null;
  } catch (error) {
    console.log('Groq error:', error.message);
    return null;
  }
}

module.exports = { generateResponse };
