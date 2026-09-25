import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const campaigns = sqliteTable("campaigns", {
  id: text("id").primaryKey(),
  version: integer("version").notNull().default(0),
  data: text("data").notNull(),
  updatedAt: text("updated_at").notNull(),
});
