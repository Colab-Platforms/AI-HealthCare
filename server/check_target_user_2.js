const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');
const connectDB = require('./config/db');

async function checkUser(id) {
    await connectDB();
    try {
        const user = await User.findById(id);
        if (user) {
            console.log(`User ID: ${id} is ${user.name} (${user.email})`);
        } else {
            console.log(`User ID: ${id} NOT FOUND`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

const id = "69b2a23f1a19ba6cf27ae939";
checkUser(id);
