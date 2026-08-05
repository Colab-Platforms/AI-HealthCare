const axios = require('axios');

// MSG91 Flow API (DLT-compliant template-based SMS) — https://docs.msg91.com/p/tf9GTextN/e/kFJ0KEC5xk
const MSG91_AUTH_KEY = process.env.MSG91_AUTH_KEY;
const MSG91_SENDER_ID = process.env.MSG91_SENDER_ID;
const MSG91_OTP_TEMPLATE_ID = process.env.MSG91_OTP_TEMPLATE_ID; // DLT-approved template with an {{OTP}} variable

// MSG91 expects country code + 10-digit number, no '+' or leading zeros (e.g. 919876543210)
const toMsg91Mobile = (phone) => {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  throw new Error('Invalid phone number format');
};

// Sends a 6-digit OTP via SMS. In development, or if MSG91 isn't configured,
// logs the code instead of sending — mirrors how other services in this repo
// (e.g. cloudinary) degrade gracefully when unconfigured locally.
exports.sendOtpSms = async (phone, otp) => {
  if (!MSG91_AUTH_KEY || !MSG91_OTP_TEMPLATE_ID) {
    console.warn(`[smsService] MSG91 not configured — OTP for ${phone} is: ${otp}`);
    return { skipped: true };
  }

  const mobile = toMsg91Mobile(phone);

  const { data } = await axios.post(
    'https://control.msg91.com/api/v5/flow/',
    {
      template_id: MSG91_OTP_TEMPLATE_ID,
      short_url: '0',
      recipients: [
        {
          mobiles: mobile,
          OTP: otp
        }
      ]
    },
    {
      headers: {
        authkey: MSG91_AUTH_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    }
  );

  if (data?.type !== 'success') {
    throw new Error(data?.message || 'Failed to send SMS via MSG91');
  }

  return data;
};
