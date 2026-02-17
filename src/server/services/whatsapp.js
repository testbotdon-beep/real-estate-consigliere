// WhatsApp Business API Integration
// Docs: https://developers.facebook.com/docs/whatsapp

const axios = require('axios');

const WHATSAPP_API_URL = 'https://graph.facebook.com/v18.0';

class WhatsAppService {
  constructor(phoneNumberId, accessToken) {
    this.phoneNumberId = phoneNumberId;
    this.accessToken = accessToken;
  }

  // Send a text message
  async sendMessage(to, message) {
    try {
      const response = await axios.post(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'text',
        text: { body: message }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp send error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send a template message
  async sendTemplate(to, templateName, components) {
    try {
      const response = await axios.post(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en_US' },
          components: components
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp template error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send interactive buttons (Quick Reply)
  async sendButtons(to, body, buttons) {
    try {
      const response = await axios.post(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'button',
          body: { text: body },
          action: {
            buttons: buttons.map((btn, i) => ({
              type: 'reply',
              reply: {
                id: `btn_${i + 1}`,
                title: btn.substring(0, 20) // Max 20 chars
              }
            }))
          }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp buttons error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Send a list message (for multiple options)
  async sendList(to, body, sections) {
    try {
      const response = await axios.post(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        to: to,
        type: 'interactive',
        interactive: {
          type: 'list',
          body: { text: body },
          action: {
            button: 'View Options',
            sections: sections
          }
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    } catch (error) {
      console.error('WhatsApp list error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Mark message as read
  async markAsRead(messageId) {
    try {
      await axios.post(`${WHATSAPP_API_URL}/${this.phoneNumberId}/messages`, {
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: messageId
      }, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('WhatsApp mark read error:', error.response?.data || error.message);
    }
  }

  // Process incoming webhook
  processWebhook(payload) {
    const messages = payload.entry?.[0]?.changes?.[0]?.value?.messages;
    if (!messages) return [];

    return messages.map(msg => ({
      from: msg.from,
      id: msg.id,
      type: msg.type,
      text: msg.text?.body,
      interactive: msg.interactive?.button_reply?.title,
      timestamp: msg.timestamp
    }));
  }
}

// Auto-reply logic - human, concise, natural
class AutoReplyEngine {
  constructor(agentName, propertyListings = []) {
    this.agentName = agentName;
    this.propertyListings = propertyListings;
  }

  // Handle button clicks
  handleButtonReply(buttonId, conversationState) {
    switch (buttonId) {
      case 'btn_1': // Confirm
        return {
          message: `All sorted. Your viewing is confirmed. See you there.`,
          state: { stage: 'booking_confirmed' }
        };
      case 'btn_2': // Change time
        return {
          message: `No worries. Let me know a better time.`,
          state: { stage: 'awaiting_date' }
        };
      case 'btn_3': // Cancel
        return {
          message: `Alright. Just message me when you're ready again.`,
          state: { stage: 'idle' }
        };
      default:
        return { message: null, state: {} };
    }
  }

  generateResponse(userMessage, conversationHistory = [], conversationState = {}) {
    const lower = userMessage.toLowerCase();
    const stage = conversationState?.stage || 'greeting';
    
    // Handle button responses
    if (conversationState?.buttonReply) {
      return this.handleButtonReply(conversationState.buttonReply, conversationState);
    }
    
    // Greeting
    if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
      return { 
        message: `Hey. {{agent_name}} asked me to help out. What's up?`,
        state: { stage: 'greeting' }
      };
    }
    
    // Looking for property
    if (lower.includes('looking for') || lower.includes('property') || lower.includes('house') || lower.includes('condo')) {
      return { 
        message: `Nice. What's your budget and which area are you looking at?`,
        state: { stage: 'collecting_requirements' }
      };
    }
    
    // Budget mentioned
    if (lower.includes('$') || lower.includes('million') || lower.includes('budget') || /\d/.test(lower)) {
      const props = this.listProperties();
      return {
        message: `Got it. Here's what we have:\n\n${props}\n\nWhich one interests you?`,
        state: { stage: 'selecting_property' }
      };
    }
    
    // Property selection
    if (lower.includes('1') || lower.includes('first') || lower.includes('bedok')) {
      return {
        message: `Solid pick. The Bedok place is well kept. Want to book a viewing?`,
        state: { stage: 'awaiting_date' }
      };
    }
    
    // Booking request
    if (lower.includes('viewing') || lower.includes('book') || lower.includes('schedule')) {
      return {
        message: `Let's do it. What times work for you?`,
        state: { stage: 'awaiting_date' }
      };
    }
    
    // Time/date provided - buttons appear
    if (lower.includes('tomorrow') || lower.includes('pm') || lower.includes('am') || lower.includes('today') || lower.includes('/')) {
      return {
        message: `Got it.\n\nBedok Resale Condo\n${userMessage}\n\nLooks good?`,
        state: { stage: 'confirming_booking' },
        buttons: ['Confirm', 'Change time', 'Cancel']
      };
    }
    
    // Yes/sure
    if (lower.includes('yes') || lower.includes('sure') || lower.includes('okay') || lower.includes('sounds good')) {
      return {
        message: `What times work for you?`,
        state: { stage: 'awaiting_date' }
      };
    }
    
    // No/not interested
    if (lower.includes('no') || lower.includes('not') || lower.includes('later')) {
      return {
        message: `No problem. Just message me when you're ready.`,
        state: { stage: 'idle' }
      };
    }
    
    // Default
    return { 
      message: `Sure. I've passed that on. They'll get back to you shortly.`,
      state: { stage: 'idle' }
    };
  }

  listProperties() {
    const properties = this.propertyListings.length > 0 ? this.propertyListings : [
      { name: 'Bedok Resale Condo', price: '$1.48M', size: '3BR', location: 'East' },
      { name: 'Tampines New Launch', price: '$1.52M', size: '3BR', location: 'East' },
      { name: 'Pasir Ris Rise', price: '$1.45M', size: '3BR', location: 'East' }
    ];
    
    let response = '';
    properties.forEach((p, i) => {
      response += `${i + 1}. ${p.name} - ${p.price}\n`;
    });
    return response;
  }
}

module.exports = { WhatsAppService, AutoReplyEngine };
