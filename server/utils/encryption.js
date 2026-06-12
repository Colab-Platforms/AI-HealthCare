const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY = Buffer.from(process.env.VAULT_ENCRYPTION_KEY, 'hex'); // 32 bytes = 64 hex chars

const encrypt = (buffer) => {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    // Prepend IV to encrypted data so we can decrypt later
    return Buffer.concat([iv, encrypted]);
};

const decrypt = (encryptedBuffer) => {
    const iv = encryptedBuffer.subarray(0, 16);
    const data = encryptedBuffer.subarray(16);
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    return Buffer.concat([decipher.update(data), decipher.final()]);
};

module.exports = { encrypt, decrypt };
