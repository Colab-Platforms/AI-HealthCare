const fs = require('fs');
const dns = require('dns');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config({ path: path.join(__dirname, '../.env') });

const OUTPUT_PATH = path.join(__dirname, '../users-export.csv');

// Some local networks (VPN/router/antivirus DNS filtering) block Node's direct SRV
// queries (used by mongodb+srv:// URIs) even though the OS's own resolver works fine
// via nslookup. If the machine's configured DNS can't resolve the SRV record, retry
// once against a public resolver before giving up — this script-only workaround
// doesn't touch config/db.js, which already connects fine for the main app.
const ensureSrvResolvable = async (uri) => {
    if (!uri.startsWith('mongodb+srv://')) return;
    const host = new URL(uri).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        console.warn(`Default DNS couldn't resolve the SRV record (${e.code}) — retrying via public DNS (8.8.8.8, 1.1.1.1)...`);
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    }
};

const csvEscape = (value) => {
    const str = value === undefined || value === null ? '' : String(value);
    if (/[",\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};

const run = async () => {
    try {
        await ensureSrvResolvable(process.env.MONGODB_URI);
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to DB');

        const cursor = User.find({}, 'name email phone role isActive createdAt')
            .sort({ createdAt: 1 })
            .lean()
            .cursor();

        const header = ['Sr No', 'Name', 'Email', 'Phone', 'Role', 'Active', 'Created At'];
        const lines = [header.map(csvEscape).join(',')];

        let count = 0;
        for await (const user of cursor) {
            count++;
            const row = [
                count,
                user.name,
                user.email,
                user.phone,
                user.role,
                user.isActive,
                user.createdAt ? user.createdAt.toISOString() : ''
            ];
            lines.push(row.map(csvEscape).join(','));
        }

        fs.writeFileSync(OUTPUT_PATH, lines.join('\n'), 'utf8');
        console.log(`Exported ${count} users to ${OUTPUT_PATH}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
