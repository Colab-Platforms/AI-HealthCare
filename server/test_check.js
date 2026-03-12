const axios = require('axios');

async function testApi() {
    try {
        const nutritionController = require('./controllers/nutritionController');
        const db = require('./config/db');
        const mongoose = require('mongoose');
        const dotenv = require('dotenv');
        dotenv.config();

        await db();

        const req = {
            body: { foodDescription: 'Oatmeal 1 serving' },
            user: { _id: new mongoose.Types.ObjectId() },
            headers: { 'content-type': 'application/json' },
            file: null
        };

        const res = {
            status: function (code) { console.log('\n--- STATUS --- \n', code); return this; },
            json: function (data) { console.log('\n--- JSON --- \n', JSON.stringify(data, null, 2)); return this; }
        };

        await nutritionController.quickFoodCheck(req, res);
        process.exit(0);
    } catch (err) {
        console.error('TEST ERROR:', err);
        process.exit(1);
    }
}

testApi();
