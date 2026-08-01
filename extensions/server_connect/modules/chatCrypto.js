const crypto = require('crypto');

function currentVersion() {
    const parsed = Number.parseInt(process.env.CHAT_ENCRYPTION_KEY_VERSION || '1', 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('CHAT_ENCRYPTION_KEY_VERSION must be a positive integer.');
    }
    return parsed;
}

function keyForVersion(version) {
    const encoded = process.env[`CHAT_ENCRYPTION_KEY_V${version}`];
    if (!encoded) {
        throw new Error(`CHAT_ENCRYPTION_KEY_V${version} is missing from environment variables.`);
    }
    const key = Buffer.from(String(encoded).trim(), 'base64');
    if (key.length !== 32) {
        throw new Error(`CHAT_ENCRYPTION_KEY_V${version} must be a Base64 encoded 32-byte key.`);
    }
    return key;
}

function aad(tenantId, conversationId, version) {
    return Buffer.from(`tastrack-chat:v${version}:${tenantId}:${conversationId}`, 'utf8');
}

function decryptRow(row, tenantId, outputField) {
    if (!row || !row.messageCiphertext) return { ...row, [outputField]: null };

    const version = Number(row.messageKeyVersion);
    const conversationId = Number(row.messageConversationId || row.conversationId);
    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        keyForVersion(version),
        Buffer.from(row.messageIv, 'base64')
    );
    decipher.setAAD(aad(Number(tenantId), conversationId, version));
    decipher.setAuthTag(Buffer.from(row.messageAuthTag, 'base64'));
    const plaintext = Buffer.concat([
        decipher.update(Buffer.from(row.messageCiphertext, 'base64')),
        decipher.final()
    ]).toString('utf8');

    const output = { ...row, [outputField]: plaintext };
    delete output.messageCiphertext;
    delete output.messageIv;
    delete output.messageAuthTag;
    delete output.messageKeyVersion;
    delete output.messageConversationId;
    return output;
}

module.exports = {
    encrypt: function (options) {
        const plaintext = this.parseRequired(options.plaintext, 'string', 'chatCrypto.encrypt: plaintext is required.');
        const tenantId = this.parseRequired(options.tenantId, 'number', 'chatCrypto.encrypt: tenantId is required.');
        const conversationId = this.parseRequired(options.conversationId, 'number', 'chatCrypto.encrypt: conversationId is required.');
        const version = currentVersion();
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', keyForVersion(version), iv);
        cipher.setAAD(aad(tenantId, conversationId, version));
        const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);

        return {
            ciphertext: ciphertext.toString('base64'),
            iv: iv.toString('base64'),
            authTag: cipher.getAuthTag().toString('base64'),
            keyVersion: version
        };
    },

    decryptRows: function (options) {
        const tenantId = this.parseRequired(options.tenantId, 'number', 'chatCrypto.decryptRows: tenantId is required.');
        const parsedRows = this.parse(options.rows);
        const rows = Array.isArray(parsedRows) ? parsedRows : [];
        const outputField = this.parse(options.outputField) || 'messageText';
        if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(outputField)) {
            throw new Error('chatCrypto.decryptRows: outputField is invalid.');
        }
        return rows.map(row => decryptRow(row, tenantId, outputField));
    }
};
