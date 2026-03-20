const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

async function testApi(model) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    console.log("Testing model:", model);

    try {
        const resp = await axios.post('https://api.anthropic.com/v1/messages', {
            model: model,
            max_tokens: 100,
            messages: [{ role: 'user', content: 'hello' }]
        }, {
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
                'Content-Type': 'application/json'
            }
        });
        console.log("SUCCESS:", model, "works");
    } catch (err) {
        console.error("ERROR DATA:", err.response?.data || err.message);
    }
}
async function run() {
    await testApi('claude-sonnet-4-20250514');
    await testApi('claude-sonnet-4-6');
    await testApi('claude-3-5-sonnet-20241022');
}
run();
