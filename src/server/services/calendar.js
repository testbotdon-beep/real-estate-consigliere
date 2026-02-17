// Google Calendar API Integration
// Docs: https://developers.google.com/calendar/api/v3/reference

const { google } = require('googleapis');

class CalendarService {
  constructor(credentials) {
    this.credentials = credentials;
    this.calendar = null;
    this.init();
  }

  init() {
    const { client_id, client_secret, redirect_uris } = this.credentials.web || {};
    
    this.oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || 'http://localhost:3000/api/calendar/callback'
    );
    
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
  }

  // Generate auth URL
  getAuthUrl() {
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent'
    });
  }

  // Exchange code for tokens
  async getTokens(code) {
    const { tokens } = await this.oauth2Client.getToken(code);
    this.oauth2Client.setCredentials(tokens);
    return tokens;
  }

  // Set credentials from stored tokens
  setCredentials(tokens) {
    this.oauth2Client.setCredentials(tokens);
  }

  // Get upcoming events
  async getEvents(maxResults = 10) {
    try {
      const response = await this.calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: maxResults,
        singleEvents: true,
        orderBy: 'startTime'
      });
      return response.data.items || [];
    } catch (error) {
      console.error('Calendar get events error:', error.message);
      return [];
    }
  }

  // Get free/busy info
  async getFreeBusy(startTime, endTime) {
    try {
      const response = await this.calendar.freebusy.query({
        requestBody: {
          timeMin: startTime,
          timeMax: endTime,
          items: [{ id: 'primary' }]
        }
      });
      return response.data.calendars?.primary?.busy || [];
    } catch (error) {
      console.error('Calendar free-busy error:', error.message);
      return [];
    }
  }

  // Find available slots (simple version - 9am-7pm)
  findAvailableSlots(date, duration = 60) {
    const slots = [];
    const dateStr = new Date(date).toISOString().split('T')[0];
    
    for (let hour = 9; hour < 19; hour++) {
      const slotTime = `${dateStr}T${hour.toString().padStart(2, '0')}:00:00`;
      slots.push({
        start: slotTime,
        end: new Date(new Date(slotTime).getTime() + duration * 60000).toISOString(),
        time: `${hour}:00`
      });
    }
    
    return slots;
  }

  // Create an event
  async createEvent(eventDetails) {
    const { summary, description, startTime, endTime, attendees } = eventDetails;
    
    try {
      const event = {
        summary: summary || 'Property Viewing',
        description: description || 'Viewing scheduled via Consigliere',
        start: { dateTime: startTime },
        end: { dateTime: endTime },
        attendees: attendees?.map(a => ({ email: a })),
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 60 }
          ]
        }
      };
      
      const response = await this.calendar.events.insert({
        calendarId: 'primary',
        resource: event,
        sendUpdates: 'all'
      });
      
      return response.data;
    } catch (error) {
      console.error('Calendar create event error:', error.message);
      throw error;
    }
  }

  // Update an event
  async updateEvent(eventId, updates) {
    try {
      const response = await this.calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        resource: updates
      });
      return response.data;
    } catch (error) {
      console.error('Calendar update event error:', error.message);
      throw error;
    }
  }

  // Delete an event
  async deleteEvent(eventId) {
    try {
      await this.calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId
      });
      return true;
    } catch (error) {
      console.error('Calendar delete event error:', error.message);
      return false;
    }
  }
}

// Scheduling logic
class SchedulingEngine {
  constructor(calendarService) {
    this.calendar = calendarService;
  }

  async checkAvailability(date, time, duration = 60) {
    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    const busy = await this.calendar.getFreeBusy(
      startTime.toISOString(),
      endTime.toISOString()
    );
    
    return busy.length === 0;
  }

  async bookViewing(clientName, clientPhone, propertyAddress, date, time, agentEmail) {
    const startTime = new Date(`${date}T${time}`);
    const endTime = new Date(startTime.getTime() + 60 * 60000); // 1 hour
    
    const event = await this.calendar.createEvent({
      summary: `Property Viewing - ${clientName}`,
      description: `Client: ${clientName}\nPhone: ${clientPhone}\nProperty: ${propertyAddress}\n\nScheduled via Consigliere`,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      attendees: [agentEmail]
    });
    
    return event;
  }
}

module.exports = { CalendarService, SchedulingEngine };
