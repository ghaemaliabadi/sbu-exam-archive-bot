import { table, integer, text, json, index, uniqueIndex, sql } from 'sdk/db';

export const users = table('users', {
  id: integer('id').primaryKey(),
  step: text('step'),
});

export const submissions = table('submissions', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  messageIds: json('message_ids').notNull().default([]),
  status: text('status').notNull().default('pending'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`),
}, (table) => ({
  userIdx: index('idx_submissions_user_id').on(table.userId),
}));

export const draftFiles = table('draft_files', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  messageId: integer('message_id').notNull(),
}, (table) => ({
  userMessageIdx: uniqueIndex('uidx_draft_files_user_message')
    .on(table.userId, table.messageId),
}));
