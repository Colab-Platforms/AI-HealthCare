const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const promoteUser = async () => {
    const email = process.argv[2];

    if (!email) {
        console.error('❌ Please provide a user email: node promoteAdmin.js <email>');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const user = await User.findOne({ email: email.toLowerCase() });

        if (!user) {
            console.error(`❌ User not found with email: ${email}`);
            process.exit(1);
        }

        if (user.role === 'admin') {
            console.log(`ℹ️  User ${email} is already an admin.`);
            process.exit(0);
        }

        user.role = 'admin';
        await user.save();

        console.log(`🚀 Success! User ${email} has been promoted to Admin.`);
        console.log('You can now log in with this account to access the Admin Dashboard at /admin');

        process.exit(0);
    } catch (error) {
        console.error('❌ Error promoting user:', error);
        process.exit(1);
    }
};

promoteUser();
