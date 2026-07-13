import { table, integer, text } from 'sdk/db';

// Your database tables go here as named exports. `npx tgcloud push` deploys this
// file; `npx tgcloud migrate` applies the changes to the database.

// Uncomment to define your first table:
// export const users = table('users', {
//   id:   integer('id').primaryKey({ autoIncrement: true }),
//   name: text('name').notNull(),
// });
