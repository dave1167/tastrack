const fs = require('fs-extra');
const path = require('path');
const { Resend } = require('resend');

function parseEmailList(value) {
    if (!value) return [];

    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(Boolean);
    }

    return String(value)
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
}

function buildAttachment(attachmentPath, attachmentFilename) {
    if (!attachmentPath) return undefined;

    const filePath = String(attachmentPath).trim();
    if (!filePath) return undefined;

    const filename = String(
        attachmentFilename || path.basename(filePath)
    ).trim();

    if (!filename) {
        throw new Error('Attachment filename could not be determined');
    }

    if (/^https?:\/\//i.test(filePath)) {
        return {
            filename,
            path: filePath
        };
    }

    if (!fs.existsSync(filePath)) {
        throw new Error('Attachment file not found: ' + filePath);
    }

    return {
        filename,
        content: fs.readFileSync(filePath).toString('base64')
    };
}

module.exports = {
    send: async function (options) {
        const apiKey = process.env.RESEND_API_KEY;
        const defaultFrom = process.env.RESEND_FROM;

        if (!apiKey) {
            throw new Error('RESEND_API_KEY is missing from environment variables');
        }

        const resend = new Resend(apiKey);

        const fromEmail = this.parseOptional(options.from, 'string', defaultFrom || '');
        const fromName = this.parseOptional(options.fromName, 'string', '');
        const replyTo = this.parseOptional(options.replyTo, 'string', '');

        const toEmail = this.parseRequired(options.to, 'string', 'resend.send: to is required.');
        const toName = this.parseOptional(options.toName, 'string', '');
        const cc = this.parseOptional(options.cc, 'string', '');
        const bcc = this.parseOptional(options.bcc, 'string', '');

        const subject = this.parseRequired(options.subject, 'string', 'resend.send: subject is required.');
        const html = this.parseOptional(options.html, 'string', '');
        const text = this.parseOptional(options.text, 'string', '');

        const attachmentPath = this.parseOptional(options.attachmentPath, 'string', '');
        const attachmentFilename = this.parseOptional(options.attachmentFilename, 'string', '');

        if (!fromEmail) {
            throw new Error('resend.send: from is required or RESEND_FROM must be set.');
        }

        if (!html && !text) {
            throw new Error('resend.send: HTML Body or Plain Text Body is required.');
        }

        const from = fromName ? `"${fromName}" <${fromEmail}>` : fromEmail;
        const to = toName ? `"${toName}" <${toEmail}>` : toEmail;

        const payload = {
            from,
            to: parseEmailList(to),
            subject,
            html: html || undefined,
            text: text || undefined
        };

        const ccList = parseEmailList(cc);
        const bccList = parseEmailList(bcc);

        if (ccList.length) payload.cc = ccList;
        if (bccList.length) payload.bcc = bccList;
        if (replyTo) payload.replyTo = replyTo;

        const attachment = buildAttachment(attachmentPath, attachmentFilename);

        if (attachment) {
            payload.attachments = [attachment];
        }

        const response = await resend.emails.send(payload);

        if (response.error) {
            throw new Error(response.error.message || JSON.stringify(response.error));
        }

        if (!response.data || !response.data.id) {
            throw new Error('Resend returned no email ID: ' + JSON.stringify(response));
        }

        return {
            success: true,
            id: response.data.id,
            to,
            subject,
            message: 'Email sent successfully'
        };
    }
};