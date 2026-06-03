export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  driver: "better-sqlite",
  dbCredentials: {
    url: process.env.A11YAUDIT_DB_PATH ?? ".a11yaudit/a11yaudit.db"
  }
};
