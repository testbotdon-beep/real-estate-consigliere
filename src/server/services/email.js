// Email Service for notifications
const nodemailer = require('nodemailer');

// Create transporter (configure with your SMTP)
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

// Send booking confirmation email
const sendBookingConfirmation = async (appointment, agent) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Consigliere" <noreply@consigliere.app>',
    to: appointment.clientEmail || appointment.clientPhone + '@sms.email',
    subject: `✅ Viewing Confirmed - ${appointment.propertyAddress}`,
    html: `
      <h2>Your viewing has been confirmed!</h2>
      <p>Hi ${appointment.clientName},</p>
      <p>Your property viewing has been confirmed.</p>
      <h3>Details:</h3>
      <ul>
        <li><strong>Date:</strong> ${new Date(appointment.startTime).toLocaleDateString()}</li>
        <li><strong>Time:</strong> ${new Date(appointment.startTime).toLocaleTimeString()}</li>
        <li><strong>Property:</strong> ${appointment.propertyAddress}</li>
        <li><strong>Agent:</strong> ${agent?.name || 'Your agent'}</li>
      </ul>
      <p>See you there!</p>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (e) {
    console.log('Email not configured:', e.message);
    return false;
  }
};

// Send new lead notification to agent
const sendNewLeadNotification = async (lead, agent) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: process.env.SMTP_FROM || '"Consigliere" <noreply@consigliere.app>',
    to: agent?.email || 'agent@consigliere.app',
    subject: `🔥 New Lead - ${lead.phone}`,
    html: `
      <h2>You have a new lead!</h2>
      <p><strong>Phone:</strong> ${lead.phone}</p>
      <p><strong>Source:</strong> ${lead.source || 'WhatsApp'}</p>
      <p><strong>Time:</strong> ${new Date(lead.createdAt).toLocaleString()}</p>
      <p>Log in to your admin dashboard to respond.</p>
    `
  };
  
  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (e) {
    console.log('Email not configured:', e.message);
    return false;
  }
};

module.exports = { sendBookingConfirmation, sendNewLeadNotification };
