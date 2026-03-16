const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const User = require('./models/User');
const connectDB = require('./config/db');

async function listUsers() {
    await connectDB();
    try {
        const users = await User.find({}).select('name email role createdAt');
        console.log(`Found ${users.length} users.`);
        users.forEach(u => {
            console.log(`- ${u.name} (${u.email}) ID: ${u._id}, Joined: ${u.createdAt}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

listUsers();
