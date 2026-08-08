const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const ENCRYPTION_VERSION = 1;

function currentKeyVersion() {
  const version = Number.parseInt(process.env.METIPATH_ENCRYPTION_KEY_VERSION || '1', 10);
  if (!Number.isInteger(version) || version < 1) throw new Error('METIPATH_ENCRYPTION_KEY_VERSION must be a positive integer.');
  return version;
}

function masterKey(version) {
  const encoded = process.env[`METIPATH_ENCRYPTION_MASTER_KEY_V${version}`];
  if (!encoded) throw new Error(`METIPATH_ENCRYPTION_MASTER_KEY_V${version} is missing from environment variables.`);
  const key = Buffer.from(String(encoded).trim(), 'base64');
  if (key.length !== 32) throw new Error(`METIPATH_ENCRYPTION_MASTER_KEY_V${version} must be a Base64 encoded 32-byte key.`);
  return key;
}

function tenantKey(tenantId, version, purpose) {
  const tenant = positiveInteger(tenantId, 'tenantId');
  return Buffer.from(crypto.hkdfSync('sha256', masterKey(version), Buffer.from('metipath-tenant-key-v1'), Buffer.from(`${purpose}:tenant:${tenant}:key:${version}`), 32));
}

function aad(tenantId, context, version) {
  return Buffer.from(`metipath:v${ENCRYPTION_VERSION}:tenant:${positiveInteger(tenantId, 'tenantId')}:key:${version}:${cleanContext(context)}`);
}

function encrypt(plaintext, tenantId, context = 'communication') {
  const version = currentKeyVersion();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, tenantKey(tenantId, version, 'encryption'), iv);
  cipher.setAAD(aad(tenantId, context, version));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  return { ciphertext: ciphertext.toString('base64'), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), encryptionVersion: ENCRYPTION_VERSION, keyVersion: version };
}

function decrypt(payload, tenantId, context = 'communication') {
  if (Number(payload.encryptionVersion || ENCRYPTION_VERSION) !== ENCRYPTION_VERSION) throw new Error('Unsupported Metipath encryption version.');
  const version = positiveInteger(payload.keyVersion, 'keyVersion');
  const decipher = crypto.createDecipheriv(ALGORITHM, tenantKey(tenantId, version, 'encryption'), Buffer.from(payload.iv, 'base64'));
  decipher.setAAD(aad(tenantId, context, version));
  decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(payload.ciphertext, 'base64')), decipher.final()]).toString('utf8');
}

function normalise(value, mode) {
  const text = String(value).normalize('NFKC').trim();
  if (mode === 'email') return text.toLowerCase();
  if (mode === 'compact') return text.toLowerCase().replace(/\s+/g, '');
  return text.toLowerCase().replace(/\s+/g, ' ');
}

function searchHash(value, tenantId, context = 'communication', mode = 'text') {
  const version = currentKeyVersion();
  return crypto.createHmac('sha256', tenantKey(tenantId, version, `blind-index:${cleanContext(context)}`)).update(normalise(value, mode), 'utf8').digest('hex');
}

function cleanContext(value) {
  const context = String(value || 'communication');
  if (!/^[a-zA-Z0-9_.:-]{1,100}$/.test(context)) throw new Error('context contains invalid characters.');
  return context;
}

function positiveInteger(value, name) {
  const number = Number(value); if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer.`); return number;
}

module.exports = {
  encryptValue(options) {
    const plaintext = this.parseRequired(options.plaintext, 'string', 'metipathSecurity.encryptValue: plaintext is required.');
    const tenantId = this.parseRequired(options.tenantId, 'number', 'metipathSecurity.encryptValue: tenantId is required.');
    return encrypt(plaintext, tenantId, this.parse(options.context) || 'communication');
  },
  decryptValue(options) {
    const tenantId = this.parseRequired(options.tenantId, 'number', 'metipathSecurity.decryptValue: tenantId is required.');
    return { plaintext: decrypt({ ciphertext: this.parseRequired(options.ciphertext, 'string'), iv: this.parseRequired(options.iv, 'string'), authTag: this.parseRequired(options.authTag, 'string'), encryptionVersion: this.parse(options.encryptionVersion), keyVersion: this.parseRequired(options.keyVersion, 'number') }, tenantId, this.parse(options.context) || 'communication') };
  },
  createSearchHash(options) {
    return { hash: searchHash(this.parseRequired(options.value, 'string'), this.parseRequired(options.tenantId, 'number'), this.parse(options.context) || 'communication', this.parse(options.normalisation) || 'text'), keyVersion: currentKeyVersion() };
  },
  verifyCiphertext(options) {
    try { decrypt(options, this.parseRequired(options.tenantId, 'number'), this.parse(options.context) || 'communication'); return { valid: true }; }
    catch (_) { return { valid: false }; }
  },
  _test: { encrypt, decrypt, searchHash, normalise }
};
