import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const outfitJobsTable = pgTable("outfit_jobs", {
  jobId: text("job_id").primaryKey(),
  status: text("status").notNull().default("analyzing"),
  prompt: text("prompt").notNull(),
  outfits: jsonb("outfits").notNull().default([]),
  error: text("error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOutfitJobSchema = createInsertSchema(outfitJobsTable).omit({
  createdAt: true,
});

export type InsertOutfitJob = z.infer<typeof insertOutfitJobSchema>;
export type OutfitJob = typeof outfitJobsTable.$inferSelect;
