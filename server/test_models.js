const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function getModels() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    try {
        const resp = await axios.get('https://api.anthropic.com/v1/models', {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01'
            }
        });
        console.log("MODELS:", JSON.stringify(resp.data, null, 2));
    } catch (err) {
        console.error("ERROR:", err.response?.data || err.message);
    }
}
getModels();
