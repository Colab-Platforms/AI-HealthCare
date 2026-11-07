const fs = require('fs');
const dns = require('dns');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const WaitlistUserEmail = require('../models/WaitlistUserEmail');

dotenv.config({ path: path.join(__dirname, '../.env') });

const OUTPUT_PATH = path.join(__dirname, '../waitlist-emails-export.csv');

const ensureSrvResolvable = async (uri) => {
    if (!uri.startsWith('mongodb+srv://')) return;
    const host = new URL(uri).hostname;
    try {
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`);
    } catch (e) {
        console.warn(`Default DNS couldn't resolve the SRV record (${e.code}) — retrying via public DNS (8.8.8.8, 1.1.1.1)...`);
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await dns.promises.resolveSrv(`_mongodb._tcp.${host}`); // let this throw if it still fails — real problem, not just DNS
    }2
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

        const entries = await WaitlistUserEmail.find({}, 'name email source createdAt userAgent')
            .sort({ createdAt: 1 })
            .lean();

        const header = ['Sr No', 'Name', 'Email', 'Source', 'Created At'];
        const rows = entries.map((entry, index) => [
            index + 1,
            entry.name,
            entry.email,
            entry.source,
            entry.createdAt ? entry.createdAt.toISOString() : ''
        ]);

        const csvLines = [header, ...rows].map(row => row.map(csvEscape).join(','));
        fs.writeFileSync(OUTPUT_PATH, csvLines.join('\n'), 'utf8');

        console.log(`Exported ${rows.length} records to ${OUTPUT_PATH}`);

        let android = 0, ios = 0, other = 0;
        for (const entry of entries) {
            const ua = entry.userAgent || '';
            if (/Android/i.test(ua)) android++;
            else if (/iPhone|iPad|iPod/i.test(ua)) ios++;
            else other++;
        }
        console.log(`Android: ${android}, iOS: ${ios}, Other/Unknown: ${other} (total ${entries.length})`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

run();
