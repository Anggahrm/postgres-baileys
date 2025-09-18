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
    const { state, saveCreds } = await usePostgreSQLAuthState(postgreSQLConfig, "your-unique-session-id");

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
    const { state, saveCreds } = await usePostgreSQLAuthState(connectionUrl, "your-unique-session-id");

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
2. **Session ID:** A unique identifier for your WhatsApp session. Use a consistent ID to resume the same session across restarts.
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

* **`usePostgreSQLAuthState(connection, sessionId)`**
    * `connection`:  PostgreSQL connection - can be:
        * PostgreSQL connection configuration object
        * PostgreSQL Pool instance
        * PostgreSQL connection URL string (e.g., `postgresql://username:password@host:port/database`)
    * `sessionId`:  Unique string identifier for your session
    * Returns:  
        * `state`: The current authentication state or a newly initialized one.
        * `saveCreds`: A function to save updated credentials to the database
        * `deleteSession`: A function to delete the session from the database

* **`initAuthCreds()`**
   * Returns: A freshly generated set of Baileys authentication credentials.

## Important Considerations

* **Database Setup:** Ensure your PostgreSQL database is set up and accessible. 
* **Error Handling:** Implement robust error handling, especially for database connection issues.


