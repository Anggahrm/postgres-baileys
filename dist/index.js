"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initAuthCreds = void 0;
exports.usePostgreSQLAuthState = usePostgreSQLAuthState;
const pg_1 = require("pg");
const WAProto_1 = require("@whiskeysockets/baileys/WAProto");
const crypto_1 = require("@whiskeysockets/baileys/lib/Utils/crypto");
const generics_1 = require("@whiskeysockets/baileys/lib/Utils/generics");
const crypto_2 = require("crypto");
// Utility functions for converting between buffer and JSON
function bufferToJSON(obj) {
    if (Buffer.isBuffer(obj)) {
        return { type: 'Buffer', data: Array.from(obj) };
    }
    else if (Array.isArray(obj)) {
        return obj.map(bufferToJSON);
    }
    else if (typeof obj === 'object' && obj !== null) {
        if (typeof obj.toJSON === 'function') {
            return obj.toJSON();
        }
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = bufferToJSON(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
function jsonToBuffer(obj) {
    if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    }
    else if (Array.isArray(obj)) {
        return obj.map(jsonToBuffer);
    }
    else if (typeof obj === 'object' && obj !== null) {
        const result = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = jsonToBuffer(obj[key]);
            }
        }
        return result;
    }
    return obj;
}
// Function to initialize authentication credentials
const initAuthCreds = () => {
    const identityKey = crypto_1.Curve.generateKeyPair();
    return {
        noiseKey: crypto_1.Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: (0, crypto_1.signedKeyPair)(identityKey, 1),
        registrationId: (0, generics_1.generateRegistrationId)(),
        advSecretKey: (0, crypto_2.randomBytes)(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false,
        },
        registered: false,
        pairingEphemeralKeyPair: crypto_1.Curve.generateKeyPair(),
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
    };
};
exports.initAuthCreds = initAuthCreds;
// Class to handle PostgreSQL operations
class PostgreSQLAuthState {
    constructor(poolOrConfigOrUrl, sessionId) {
        if (poolOrConfigOrUrl instanceof pg_1.Pool) {
            this.pool = poolOrConfigOrUrl;
        }
        else if (typeof poolOrConfigOrUrl === 'string') {
            // Connection string format: postgresql://username:password@host:port/database
            // Auto-enable SSL for cloud database providers and add sensible defaults
            this.pool = new pg_1.Pool({
                connectionString: poolOrConfigOrUrl,
                ssl: this.getSSLConfig(poolOrConfigOrUrl)
            });
        }
        else {
            // PostgreSQLConfig object - add SSL defaults if not specified
            const config = { ...poolOrConfigOrUrl };
            if (config.ssl === undefined) {
                config.ssl = this.shouldEnableSSL(config);
            }
            this.pool = new pg_1.Pool(config);
        }
        this.sessionId = sessionId || (0, crypto_2.randomUUID)();
        this.ensureTableExists();
    }
    async ensureTableExists() {
        const query = `
            CREATE TABLE IF NOT EXISTS auth_data (
                session_key VARCHAR(255) PRIMARY KEY,
                data TEXT NOT NULL
            )
        `;
        await this.executeQuery(query);
    }
    getKey(key) {
        return `${this.sessionId}:${key}`;
    }
    getSSLConfig(connectionString) {
        // Check if SSL is already specified in the connection string
        if (connectionString.includes('sslmode=') || connectionString.includes('ssl=')) {
            return undefined; // Let the connection string handle it
        }
        // Auto-enable SSL for common cloud database providers
        const url = new URL(connectionString);
        const hostname = url.hostname.toLowerCase();
        // Enable SSL for common cloud providers
        if (this.isCloudDatabase(hostname)) {
            return { rejectUnauthorized: false }; // Accept self-signed certificates common in cloud DBs
        }
        // Default to no SSL for localhost/local development
        return hostname === 'localhost' || hostname === '127.0.0.1' ? false : { rejectUnauthorized: false };
    }
    shouldEnableSSL(config) {
        const hostname = config.host.toLowerCase();
        // Enable SSL for common cloud providers
        if (this.isCloudDatabase(hostname)) {
            return { rejectUnauthorized: false };
        }
        // Default to no SSL for localhost/local development
        return hostname === 'localhost' || hostname === '127.0.0.1' ? false : { rejectUnauthorized: false };
    }
    isCloudDatabase(hostname) {
        const cloudProviders = [
            // Heroku Postgres
            '.compute-1.amazonaws.com',
            '.compute.amazonaws.com',
            'ec2-',
            // AWS RDS
            '.rds.amazonaws.com',
            '.rds.',
            // Google Cloud SQL
            '.gcp.neon.tech',
            '.googleusercontent.com',
            // Azure Database
            '.postgres.database.azure.com',
            '.database.windows.net',
            // DigitalOcean
            '.db.ondigitalocean.com',
            // Railway
            '.railway.app',
            // PlanetScale, Neon, and other cloud providers
            '.neon.tech',
            '.planetscale.sh',
            '.supabase.co'
        ];
        return cloudProviders.some(provider => hostname.includes(provider));
    }
    async executeQuery(query, params = []) {
        const client = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        }
        finally {
            client.release();
        }
    }
    async writeData(key, data) {
        const serialized = JSON.stringify(bufferToJSON(data));
        await this.executeQuery('INSERT INTO auth_data (session_key, data) VALUES ($1, $2) ON CONFLICT (session_key) DO UPDATE SET data = EXCLUDED.data', [this.getKey(key), serialized]);
    }
    async readData(key) {
        const rows = await this.executeQuery('SELECT data FROM auth_data WHERE session_key = $1', [this.getKey(key)]);
        return rows.length ? jsonToBuffer(JSON.parse(rows[0].data)) : null;
    }
    async removeData(key) {
        await this.executeQuery('DELETE FROM auth_data WHERE session_key = $1', [this.getKey(key)]);
    }
    async getAuthState() {
        const creds = (await this.readData('auth_creds')) || (0, exports.initAuthCreds)();
        return {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(ids.map(async (id) => {
                        const value = await this.readData(`${type}-${id}`);
                        if (type === 'app-state-sync-key' && value) {
                            data[id] = WAProto_1.proto.Message.AppStateSyncKeyData.create(value);
                        }
                        else {
                            data[id] = value;
                        }
                    }));
                    return data;
                },
                set: async (data) => {
                    const tasks = Object.entries(data).flatMap(([category, categoryData]) => Object.entries(categoryData || {}).map(([id, value]) => {
                        const key = `${category}-${id}`;
                        return value ? this.writeData(key, value) : this.removeData(key);
                    }));
                    await Promise.all(tasks);
                },
            },
        };
    }
    async saveCreds(creds) {
        await this.writeData('auth_creds', creds);
    }
    async deleteSession() {
        await this.executeQuery('DELETE FROM auth_data WHERE session_key LIKE $1', [`${this.sessionId}:%`]);
    }
}
// Function to use PostgreSQL Authentication State
async function usePostgreSQLAuthState(poolOrConfigOrUrl, sessionId) {
    const authState = new PostgreSQLAuthState(poolOrConfigOrUrl, sessionId);
    const state = await authState.getAuthState();
    return {
        state,
        saveCreds: async () => {
            await authState.saveCreds(state.creds);
        },
        deleteSession: async () => {
            await authState.deleteSession();
        },
    };
}
//# sourceMappingURL=index.js.map