# Email Integration Options

## Current Status
- Notifications API ready (logs to console)
- Need email service for production

## Option 1: SendGrid (Recommended)
- Free tier: 100 emails/day
- Paid: $15+/month for more
- Easy API integration

## Option 2: Mailgun
- Free tier: 5,000 emails/month
- Pay per email after
- Good deliverability

## Option 3: Resend
- Developer-friendly
- Free: 3,000 emails/month
- $15/10k after

## Integration Steps (SendGrid example)
1. Sign up at sendgrid.com
2. Create API key
3. Add to .env:
   SENDGRID_API_KEY=SG.xxxxxx
   FROM_EMAIL=bookings@consigliere.app
4. Update notifications.js to call SendGrid API

## Quick Implementation
```javascript
// In notifications.js
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: clientEmail,
  from: process.env.FROM_EMAIL,
  subject: 'Appointment Confirmed',
  html: '<p>Your viewing is confirmed...</p>'
};
await sgMail.send(msg);
```

## Action Items
- [ ] Choose email provider
- [ ] Create account
- [ ] Get API credentials
- [ ] Update .env
- [ ] Integrate with notifications API
