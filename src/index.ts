import { Pool, PoolClient } from 'pg';
import { proto } from '@whiskeysockets/baileys/WAProto';
import { Curve, signedKeyPair } from '@whiskeysockets/baileys/lib/Utils/crypto';
import { generateRegistrationId } from '@whiskeysockets/baileys/lib/Utils/generics';
import { randomBytes, randomUUID } from 'crypto';
import { AuthenticationCreds } from '@whiskeysockets/baileys';

// Interface for PostgreSQL Configurations
interface PostgreSQLConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    schema?: string; // Optional schema name (defaults to 'public')
    ssl?: boolean | any; // Optional SSL options
}

// Type for PostgreSQL connection - can be Pool, config object, or connection URL string
type PostgreSQLConnection = Pool | PostgreSQLConfig | string;

// Interface for Authentication State
interface State {
    creds: AuthenticationCreds;
    keys: {
        get: (type: string, ids: string[]) => Promise<Record<string, any>>;
        set: (data: Record<string, Record<string, any>>) => Promise<void>;
    };
}

// Utility functions for converting between buffer and JSON
function bufferToJSON(obj: any): any {
    if (Buffer.isBuffer(obj)) {
        return { type: 'Buffer', data: Array.from(obj) };
    } else if (Array.isArray(obj)) {
        return obj.map(bufferToJSON);
    } else if (typeof obj === 'object' && obj !== null) {
        if (typeof obj.toJSON === 'function') {
            return obj.toJSON();
        }
        const result: { [key: string]: any } = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                result[key] = bufferToJSON(obj[key]);
            }
        }
        return result;
    }
    return obj;
}

function jsonToBuffer(obj: any): any {
    if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
        return Buffer.from(obj.data);
    } else if (Array.isArray(obj)) {
        return obj.map(jsonToBuffer);
    } else if (typeof obj === 'object' && obj !== null) {
        const result: { [key: string]: any } = {};
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
export const initAuthCreds = (): AuthenticationCreds => {
    const identityKey = Curve.generateKeyPair();
    return {
        noiseKey: Curve.generateKeyPair(),
        signedIdentityKey: identityKey,
        signedPreKey: signedKeyPair(identityKey, 1),
        registrationId: generateRegistrationId(),
        advSecretKey: randomBytes(32).toString('base64'),
        processedHistoryMessages: [],
        nextPreKeyId: 1,
        firstUnuploadedPreKeyId: 1,
        accountSyncCounter: 0,
        accountSettings: {
            unarchiveChats: false,
        },
        registered: false,
        pairingEphemeralKeyPair: Curve.generateKeyPair(),
        pairingCode: undefined,
        lastPropHash: undefined,
        routingInfo: undefined,
    };
};

// Class to handle PostgreSQL operations
class PostgreSQLAuthState {
    private pool: Pool;
    private sessionId: string;
    private schema: string;

    constructor(poolOrConfigOrUrl: PostgreSQLConnection, sessionId?: string) {
        if (poolOrConfigOrUrl instanceof Pool) {
            this.pool = poolOrConfigOrUrl;
            this.schema = 'public'; // Default schema for Pool instances
        } else if (typeof poolOrConfigOrUrl === 'string') {
            // Connection string format: postgresql://username:password@host:port/database
            // Auto-enable SSL for cloud database providers and add sensible defaults
            this.pool = new Pool({ 
                connectionString: poolOrConfigOrUrl,
                ssl: this.getSSLConfig(poolOrConfigOrUrl)
            });
            this.schema = this.extractSchemaFromConnectionString(poolOrConfigOrUrl) || 'public';
        } else {
            // PostgreSQLConfig object - add SSL defaults if not specified
            const config = { ...poolOrConfigOrUrl };
            if (config.ssl === undefined) {
                config.ssl = this.shouldEnableSSL(config);
            }
            this.pool = new Pool(config);
            this.schema = config.schema || 'public';
        }
        this.sessionId = sessionId || randomUUID();
        this.ensureTableExists();
    }

    private async ensureTableExists(): Promise<void> {
        const query = `
            CREATE TABLE IF NOT EXISTS ${this.schema}.auth_data (
                session_key VARCHAR(255) PRIMARY KEY,
                data TEXT NOT NULL
            )
        `;
        await this.executeQuery(query);
    }

    private getKey(key: string): string {
        return `${this.sessionId}:${key}`;
    }

    private extractSchemaFromConnectionString(connectionString: string): string | null {
        try {
            const url = new URL(connectionString);
            const searchParams = new URLSearchParams(url.search);
            return searchParams.get('schema') || searchParams.get('currentSchema');
        } catch {
            return null;
        }
    }

    private getSSLConfig(connectionString: string): boolean | any {
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

    private shouldEnableSSL(config: PostgreSQLConfig): boolean | any {
        const hostname = config.host.toLowerCase();
        
        // Enable SSL for common cloud providers
        if (this.isCloudDatabase(hostname)) {
            return { rejectUnauthorized: false };
        }
        
        // Default to no SSL for localhost/local development
        return hostname === 'localhost' || hostname === '127.0.0.1' ? false : { rejectUnauthorized: false };
    }

    private isCloudDatabase(hostname: string): boolean {
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

    private async executeQuery(query: string, params: any[] = []): Promise<any> {
        const client: PoolClient = await this.pool.connect();
        try {
            const result = await client.query(query, params);
            return result.rows;
        } finally {
            client.release();
        }
    }

    private async writeData(key: string, data: any): Promise<void> {
        const serialized = JSON.stringify(bufferToJSON(data));
        await this.executeQuery(
            `INSERT INTO ${this.schema}.auth_data (session_key, data) VALUES ($1, $2) ON CONFLICT (session_key) DO UPDATE SET data = EXCLUDED.data`,
            [this.getKey(key), serialized]
        );
    }

    private async readData(key: string): Promise<any | null> {
        const rows = await this.executeQuery(
            `SELECT data FROM ${this.schema}.auth_data WHERE session_key = $1`,
            [this.getKey(key)]
        );
        return rows.length ? jsonToBuffer(JSON.parse(rows[0].data)) : null;
    }

    private async removeData(key: string): Promise<void> {
        await this.executeQuery(`DELETE FROM ${this.schema}.auth_data WHERE session_key = $1`, [this.getKey(key)]);
    }

    public async getAuthState(): Promise<State> {
        const creds = (await this.readData('auth_creds')) || initAuthCreds();
        return {
            creds,
            keys: {
                get: async (type: string, ids: string[]) => {
                    const data: Record<string, any> = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            const value = await this.readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                data[id] = proto.Message.AppStateSyncKeyData.create(value);
                            } else {
                                data[id] = value;
                            }
                        })
                    );
                    return data;
                },
                set: async (data: Record<string, Record<string, any>>) => {
                    const tasks = Object.entries(data).flatMap(([category, categoryData]) =>
                        Object.entries(categoryData || {}).map(([id, value]) => {
                            const key = `${category}-${id}`;
                            return value ? this.writeData(key, value) : this.removeData(key);
                        })
                    );
                    await Promise.all(tasks);
                },
            },
        };
    }

    public async saveCreds(creds: AuthenticationCreds): Promise<void> {
        await this.writeData('auth_creds', creds);
    }

    public async deleteSession(): Promise<void> {
        await this.executeQuery(`DELETE FROM ${this.schema}.auth_data WHERE session_key LIKE $1`, [`${this.sessionId}:%`]);
    }
}

// Function to use PostgreSQL Authentication State
export async function usePostgreSQLAuthState(poolOrConfigOrUrl: PostgreSQLConnection, sessionId?: string) {
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

export { PostgreSQLConfig, PostgreSQLConnection };
