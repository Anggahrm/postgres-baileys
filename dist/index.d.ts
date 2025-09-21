import { Pool } from 'pg';
import { AuthenticationCreds } from '@whiskeysockets/baileys';
interface PostgreSQLConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    schema?: string;
    ssl?: boolean | any;
}
type PostgreSQLConnection = Pool | PostgreSQLConfig | string;
interface State {
    creds: AuthenticationCreds;
    keys: {
        get: (type: string, ids: string[]) => Promise<Record<string, any>>;
        set: (data: Record<string, Record<string, any>>) => Promise<void>;
    };
}
export declare const initAuthCreds: () => AuthenticationCreds;
export declare function usePostgreSQLAuthState(poolOrConfigOrUrl: PostgreSQLConnection, sessionId?: string): Promise<{
    state: State;
    saveCreds: () => Promise<void>;
    deleteSession: () => Promise<void>;
}>;
export { PostgreSQLConfig, PostgreSQLConnection };
//# sourceMappingURL=index.d.ts.map