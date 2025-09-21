# postgres-baileys

A robust and reliable Node.js package designed to seamlessly persist your `@whiskeysockets/baileys` WhatsApp session data within a PostgreSQL database. 

**Key Benefits**

* **Persistent Sessions:** Maintain uninterrupted WhatsApp bot connectivity, even across server restarts or crashes
* **Scalability:** PostgreSQL's robust architecture supports handling large volumes of session data as your bot usage grows. 
* **TypeScript Support:** Leverages TypeScript for enhanced type safety and improved code maintainability.
* **Baileys v7 Compatible:** Updated for compatibility with the latest Baileys v7.x releases

## Installation

Install the package using npm or yarn:

```bash
npm install postgres-baileys
```

## Getting Started

### Automatic Session ID (Recommended for beginners)

If you're new to using postgres-baileys, you can let the library automatically generate a session ID for you:

```javascript
import { makeWASocket } from "@whiskeysockets/baileys";
import { usePostgreSQLAuthState } from "postgres-baileys"; 

const postgreSQLConfig = {
  host: 'your-postgresql-host',
  port: 5432, 
  user: 'your-postgresql-user',
  password: 'your-postgresql-password',
  database: 'your-postgresql-database',
};

async function main() {
  try {
    // No session ID needed - it will be generated automatically
    const { state, saveCreds } = await usePostgreSQLAuthState(postgreSQLConfig);

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state
    });

    sock.ev.on("creds.update", saveCreds); 

    console.log("WebSocket connected");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

### Manual Session ID (For managing multiple sessions)

If you need to manage multiple WhatsApp sessions or want to resume a specific session, provide your own session ID:

```javascript
import { makeWASocket } from "@whiskeysockets/baileys";
import { usePostgreSQLAuthState } from "postgres-baileys"; 

const postgreSQLConfig = {
  host: 'your-postgresql-host',
  port: 5432, 
  user: 'your-postgresql-user',
  password: 'your-postgresql-password',
  database: 'your-postgresql-database',
};

async function main() {
  try {
    // Provide your own unique session ID
    const { state, saveCreds } = await usePostgreSQLAuthState(postgreSQLConfig, "my-whatsapp-bot-1");

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state
    });

    sock.ev.on("creds.update", saveCreds); 

    console.log("WebSocket connected");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

## Using PostgreSQL Connection URL

You can also use a PostgreSQL connection URL string for simplified configuration:

```javascript
import { makeWASocket } from "@whiskeysockets/baileys";
import { usePostgreSQLAuthState } from "postgres-baileys"; 

// PostgreSQL connection URL format
const connectionUrl = "postgresql://username:password@host:port/database";

async function main() {
  try {
    // Session ID is optional - will be auto-generated if not provided
    const { state, saveCreds } = await usePostgreSQLAuthState(connectionUrl);

    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state
    });

    sock.ev.on("creds.update", saveCreds); 

    console.log("WebSocket connected");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

## Using Custom Schema

If you need to use a specific PostgreSQL schema (other than the default 'public' schema):

```javascript
import { makeWASocket } from "@whiskeysockets/baileys";
import { usePostgreSQLAuthState } from "postgres-baileys"; 

// Configuration with custom schema
const postgreSQLConfig = {
  host: 'your-postgresql-host',
  port: 5432, 
  user: 'your-postgresql-user',
  password: 'your-postgresql-password',
  database: 'your-postgresql-database',
  schema: 'whatsapp_sessions', // Custom schema name
};

// OR using connection URL with schema parameter
const connectionUrl = "postgresql://username:password@host:port/database?schema=whatsapp_sessions";

async function main() {
  try {
    const { state, saveCreds } = await usePostgreSQLAuthState(postgreSQLConfig);
    
    const sock = makeWASocket({
      printQRInTerminal: true,
      auth: state
    });

    sock.ev.on("creds.update", saveCreds);
    
    console.log("WebSocket connected");
  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```


# OR


```js
import { Pool } from 'pg';
import { usePostgreSQLAuthState } from './path-to-your-module'; // Adjust the path accordingly

// Assuming you have an already connected Pool instance
const pool = new Pool({
    host: 'your-host',
    port: 5432, // or your specific port
    user: 'your-username',
    password: 'your-password',
    database: 'your-database',
    ssl: true, // or your specific SSL configuration
});

// Define a session ID for this connection
const sessionId = 'unique-session-id';

async function main() {
    // Use the PostgreSQL authentication state
    const { state, saveCreds, deleteSession } = await usePostgreSQLAuthState(pool, sessionId);

    // Now, you can interact with the state, save credentials, or delete the session
    console.log('Initial Authentication State:', state);

    // Example: Save the current credentials
    await saveCreds();

    // Example: Delete the session when needed
    // await deleteSession();
}

main().catch(console.error);
```


## Core Concepts

1. **PostgreSQL Connection:** You can now provide connection details in three different ways:
   - **PostgreSQL configuration object:** Traditional approach with separate parameters
   - **PostgreSQL connection URL:** Simple string format (e.g., `postgresql://username:password@host:port/database`)
   - **PostgreSQL Pool instance:** Pre-configured Pool object for advanced use cases
2. **Session ID:** A unique identifier for your WhatsApp session. This can be:
   - **Automatic:** Let the library generate a random UUID (recommended for beginners)
   - **Manual:** Provide your own unique string (useful for managing multiple sessions or resuming specific sessions)
3. **`usePostgreSQLAuthState`:** Fetches or initializes session data from the database, returning the current state and a `saveCreds` function.
4. **`makeWASocket`:** Create your Baileys connection, passing in the retrieved `state`.
5. **`creds.update` Event:**  Listen for this event to automatically persist updated credentials to the database using the `saveCreds` function.

## Advanced Usage

```javascript
import { initAuthCreds } from "postgres-baileys";

// ...

// Manual credential initialization (optional)
const authCreds = initAuthCreds(); 

// ... (Use authCreds in your Baileys configuration if needed)
```

## API Reference

* **`usePostgreSQLAuthState(connection, sessionId?)`**
    * `connection`:  PostgreSQL connection - can be:
        * PostgreSQL connection configuration object
        * PostgreSQL Pool instance
        * PostgreSQL connection URL string (e.g., `postgresql://username:password@host:port/database`)
    * `sessionId` (optional):  Unique string identifier for your session. If not provided, a random UUID will be generated automatically.
    * Returns:  
        * `state`: The current authentication state or a newly initialized one.
        * `saveCreds`: A function to save updated credentials to the database
        * `deleteSession`: A function to delete the session from the database

* **`initAuthCreds()`**
   * Returns: A freshly generated set of Baileys authentication credentials.

## Important Considerations

* **Database Setup:** Ensure your PostgreSQL database is set up and accessible. 
* **Schema Configuration:** The library supports explicit schema specification for table creation:
  * **Automatic Schema:** Defaults to the 'public' schema if none is specified
  * **Configuration Object:** Add `schema: 'your_schema'` to your PostgreSQL config
  * **Connection String:** Add `?schema=your_schema` to your connection URL
  * **Pool Instances:** Always uses the 'public' schema (configure schema in your Pool if needed)
* **SSL Configuration:** The library automatically handles SSL configuration for cloud database providers:
  * **Automatic SSL:** SSL is automatically enabled for cloud databases (Heroku, AWS RDS, Google Cloud SQL, Azure Database, etc.)
  * **Local Development:** SSL is disabled by default for localhost connections
  * **Custom SSL:** You can override SSL settings by explicitly setting `ssl` in your configuration object or connection string
  * **Cloud Database Support:** The library recognizes common cloud database hostnames and applies appropriate SSL settings with `rejectUnauthorized: false` to handle self-signed certificates
* **Error Handling:** Implement robust error handling, especially for database connection issues.

## FAQ

### Session ID: Manual atau Otomatis?

**Q: Apakah kita harus membuat session ID manual? Bukannya session ID itu otomatis ya?**

**A:** Sekarang Anda bisa memilih kedua cara:

1. **Otomatis (Direkomendasikan untuk pemula):** Session ID akan dibuat secara otomatis menggunakan UUID random
   ```javascript
   const { state, saveCreds } = await usePostgreSQLAuthState(config); // Tanpa session ID
   ```

2. **Manual (Untuk mengelola multiple session):** Berikan session ID sendiri jika Anda ingin mengatur beberapa sesi atau melanjutkan sesi tertentu
   ```javascript
   const { state, saveCreds } = await usePostgreSQLAuthState(config, "my-session-1"); // Dengan session ID
   ```

### Session ID: Manual or Automatic?

**Q: Do we need to create session IDs manually? Isn't the session ID supposed to be automatic?**

**A:** Now you have both options:

1. **Automatic (Recommended for beginners):** Session ID will be automatically generated using a random UUID
   ```javascript
   const { state, saveCreds } = await usePostgreSQLAuthState(config); // No session ID needed
   ```

2. **Manual (For managing multiple sessions):** Provide your own session ID if you want to manage multiple sessions or resume specific sessions
   ```javascript
   const { state, saveCreds } = await usePostgreSQLAuthState(config, "my-session-1"); // With session ID
   ```


