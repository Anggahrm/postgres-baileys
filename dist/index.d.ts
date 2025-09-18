import { Pool } from 'pg';
import { AuthenticationCreds } from '@whiskeysockets/baileys';
interface PostgreSQLConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl?: boolean | any;
}
interface State {
    creds: AuthenticationCreds;
    keys: {
        get: (type: string, ids: string[]) => Promise<Record<string, any>>;
        set: (data: Record<string, Record<string, any>>) => Promise<void>;
    };
}
declare const initAuthCreds: () => AuthenticationCreds;
declare function usePostgreSQLAuthState(poolOrConfig: Pool | PostgreSQLConfig, sessionId: string): Promise<{
    state: State;
    saveCreds: () => Promise<void>;
    deleteSession: () => Promise<void>;
}>;
export { usePostgreSQLAuthState, initAuthCreds };
//# sourceMappingURL=index.d.ts.map