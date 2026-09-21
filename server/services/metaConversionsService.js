const axios = require('axios');
const crypto = require('crypto');

const GRAPH_API_VERSION = 'v19.0';

const hashField = (value) => {
  if (!value) return undefined;
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
};

class MetaConversionsService {
  constructor() {
    this.pixelId = process.env.META_PIXEL_ID;
    this.accessToken = process.env.META_CONVERSIONS_API_TOKEN;

    if (!this.pixelId || !this.accessToken) {
      console.warn('⚠️ Meta Conversions API: META_PIXEL_ID or META_CONVERSIONS_API_TOKEN missing. Server-side events will not be sent.');
    }
  }

  // Fire-and-forget: caller should not await this on the request's critical path.
  async sendLeadEvent({ email, name, eventId, eventSourceUrl, clientIp, userAgent, fbp, fbc }) {
    if (!this.pixelId || !this.accessToken) return { success: false, error: 'Meta Conversions API not configured' };

    const [firstName, ...rest] = (name || '').trim().split(/\s+/);
    const lastName = rest.join(' ');

    const userData = {
      em: hashField(email),
      fn: hashField(firstName),
      ln: hashField(lastName),
      client_ip_address: clientIp,
      client_user_agent: userAgent,
      fbp: fbp || undefined,
      fbc: fbc || undefined,
    };

    Object.keys(userData).forEach((key) => userData[key] === undefined && delete userData[key]);

    const payload = {
      data: [
        {
          event_name: 'Lead',
          event_time: Math.floor(Date.now() / 1000),
          event_id: eventId,
          event_source_url: eventSourceUrl,
          action_source: 'website',
          user_data: userData,
          custom_data: { content_name: 'waitlist_signup' },
        },
      ],
    };

    try {
      const response = await axios.post(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${this.pixelId}/events`,
        payload,
        { params: { access_token: this.accessToken }, timeout: 10000 }
      );
      return { success: true, data: response.data };
    } catch (error) {
      console.error('[MetaConversionsService] Failed to send Lead event:', error.response?.data || error.message);
      return { success: false, error: error.response?.data || error.message };
    }
  }
}

module.exports = new MetaConversionsService();
