import { createDb, initializeDb } from "./client.js";

const dbClient = createDb(process.env.A11YAUDIT_DB_PATH);

try {
  initializeDb(dbClient.sqlite);
} finally {
  dbClient.close();
}
