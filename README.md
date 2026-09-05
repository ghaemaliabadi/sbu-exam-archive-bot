# SBU Exam Archive Bot

A Telegram bot that collects past exam papers from students and publishes them to a
public archive channel after admin approval. It runs entirely on Telegram's
serverless platform — no server, no hosting, no bot token in the source.

Originally a PHP webhook bot; this is the JavaScript/serverless port.

## How it works

1. A student picks an exam type (midterm / final), then sends the professor name
   and the course name.
2. They upload up to 20 files and press **Send files**.
3. The bot copies everything into a private review channel with a hashtagged
   header and an approve/reject inline keyboard.
4. On approve, the messages are copied to the public archive channel; on reject
   they are deleted. Either way the submitter gets notified.

## Layout

| Path         | What it is                                                        |
|--------------|-------------------------------------------------------------------|
| `schema.js`  | Database tables (`users`, `submissions`, `draft_files`).           |
| `lib/`       | Shared modules: config, per-user step state, keyboards and texts.  |
| `handlers/`  | Update handlers, named after Telegram update types.                |
| `docs/`      | Platform SDK reference. Not deployed.                              |

Modules are imported by bare name (`import { users } from 'schema'`), never by
relative path. There are no npm packages at runtime — only the platform `sdk`
and the project's own modules. See [AGENTS.md](AGENTS.md) for the full set of
platform rules.

## Installation

**Requirements:** Node.js 18+ and a Telegram bot you own.

1. In [@BotFather](https://t.me/BotFather), open `My Bots > <your bot> > Serverless`
   and enable Serverless.
2. Copy the CLI access token from `Serverless > CLI Access > Access token`.
   This is *not* the Bot API token.
3. Install and deploy:

   ```bash
   cd serverless
   npm install
   npx tgcloud login     # paste the CLI access token
   npx tgcloud status    # show local vs. cloud differences
   npx tgcloud push      # deploy the modules
   npx tgcloud migrate   # create/update the database tables (interactive)
   npx tgcloud webhook   # verify the webhook matches the deployed handlers
   ```

   `push` deploys code only — it never touches the database. Run `migrate`
   separately and confirm the changes to `users`, `draft_files` and `submissions`.

4. Set your own IDs in [lib/config.js](lib/config.js):

   ```js
   export const ARCHIVE_CHANNEL = -100…;  // public channel for approved exams
   export const ACCEPT_CHANNEL  = -100…;  // private channel where admins review
   export const ADMINS          = [ … ];  // Telegram user IDs of the admins
   export const MAX_FILES       = 20;     // per submission
   ```

   The bot must be an administrator in both channels. Re-run `npx tgcloud push`
   after editing.

## Testing without deploying

Runs your local files on the platform without publishing them:

```bash
npx tgcloud run handlers/message '{ chat: { id: <your id>, type: "private" }, from: { id: <your id>, first_name: "Test" }, message_id: 1, text: "/start" }'
```

## npm scripts

| Script           | Runs             |
|------------------|------------------|
| `npm run deploy` | `tgcloud push`   |
| `npm run status` | `tgcloud status` |
| `npm run run`    | `tgcloud run`    |

## Notes

The bot's user-facing messages are in Persian; the code and docs are in English.
