// Twilio WhatsApp Service
// Docs: https://www.twilio.com/docs/whatsapp/api

const twilio = require('twilio');

class TwilioWhatsAppService {
  constructor(accountSid, authToken, fromNumber) {
    this.client = twilio(accountSid, authToken);
    this.fromNumber = fromNumber;
  }

  // Send a text message
  async sendMessage(to, message) {
    try {
      // Format number for WhatsApp
      const toWhatsApp = this.formatToWhatsApp(to);
      const fromWhatsApp = this.formatToWhatsApp(this.fromNumber);
      
      const result = await this.client.messages.create({
        body: message,
        from: fromWhatsApp,
        to: toWhatsApp
      });
      
      console.log('✅ Twilio message sent:', result.sid);
      return result;
    } catch (error) {
      console.error('Twilio send error:', error.message);
      throw error;
    }
  }

  // Format number for WhatsApp (must start with +)
  formatToWhatsApp(number) {
    // Remove any spaces or dashes
    const clean = number.replace(/[\s-]/g, '');
    // Add WhatsApp prefix if not present
    if (!clean.startsWith('whatsapp:')) {
      return 'whatsapp:' + clean;
    }
    return clean;
  }

  // Mark message as read (not directly supported by Twilio, but we can track)
  async markAsRead(messageId) {
    // Twilio handles delivery status via webhooks
    console.log('Message SID:', messageId);
  }
}

// Auto-reply engine using the same logic as before
class AutoReplyEngine {
  constructor(agentName, propertyListings = []) {
    this.agentName = agentName;
    this.propertyListings = propertyListings;
  }

  generateResponse(userMessage, conversationHistory = []) {
    const lower = userMessage.toLowerCase();
    const recentHistory = conversationHistory.slice(-4); // Last 4 messages
    
    // Check for booking approval context
    if (lower.includes('yes') || lower.includes('confirm') || lower.includes('book')) {
      if (recentHistory.some(m => m.content.includes('viewing') || m.content.includes('schedule'))) {
        return `Perfect! I've noted your request. The agent will confirm your viewing shortly. You'll receive a calendar invite once approved. Thank you!`;
      }
    }
    
    // Check for time/date booking
    if (lower.includes('tomorrow') || lower.includes('pm') || lower.includes('am') || lower.includes('2pm') || lower.includes('3pm') || /\d{1,2}:\d{2}/.test(lower)) {
      return `I've noted your preferred time. I'll check availability and request confirmation from ${this.agentName}. You'll receive a notification once confirmed.`;
    }
    
    // Check for viewing request
    if (lower.includes('viewing') || lower.includes('schedule') || lower.includes('book')) {
      return `Great! I'd be happy to help you schedule a viewing. What dates and times work for you? I'll check ${this.agentName}'s calendar and confirm.`;
    }
    
    // Check for property selection
    if (lower.includes('1') || lower.includes('first') || lower.includes('bedok') || lower.includes('number one')) {
      return `Excellent choice! The Bedok Resale Condo is a 3-bedroom unit at $1.48M in a prime East location.\n\nWould you like to schedule a viewing?`;
    }
    
    // Check for budget/property search
    if (lower.includes('$') || lower.includes('million') || lower.includes('budget') || lower.includes('looking for') || lower.includes('property') || lower.includes('condo') || lower.includes('house') || lower.includes('buy') || lower.includes('bedroom') || /\d/.test(lower)) {
      return this.listProperties();
    }
    
    // Greeting
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey') || lower.includes('good')) {
      return `Hi there! 👋 I'm ${this.agentName}'s personal assistant. How can I help you today?`;
    }
    
    // Thank you
    if (lower.includes('thank') || lower.includes('thanks')) {
      return `You're welcome! ${this.agentName} will be in touch soon. Is there anything else I can help you with?`;
    }
    
    // Default
    return `Thank you for your message! I've noted it and ${this.agentName} will get back to you shortly. In the meantime, feel free to tell me what kind of property you're looking for!`;
  }

  listProperties() {
    const properties = this.propertyListings.length > 0 ? this.propertyListings : [
      { name: 'Bedok Resale Condo', price: '$1.48M', size: '3BR', location: 'East' },
      { name: 'Tampines New Launch', price: '$1.52M', size: '3BR', location: 'East' },
      { name: 'Pasir Ris Rise', price: '$1.45M', size: '3BR', location: 'East' }
    ];
    
    let response = `Got it! Here are some properties that match typical budgets:\n\n`;
    properties.forEach((p, i) => {
      response += `${i + 1}. ${p.name} - ${p.price}\n`;
    });
    response += '\nWhich one interests you?';
    return response;
  }
}

module.exports = { TwilioWhatsAppService, AutoReplyEngine };
