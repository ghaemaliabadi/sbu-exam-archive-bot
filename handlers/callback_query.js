import { api, db } from 'sdk';
import { and, eq } from 'sdk/db';
import { submissions } from 'schema';
import { ACCEPT_CHANNEL, ARCHIVE_CHANNEL } from 'lib/config';
import { setStep } from 'lib/state';
import { menu, startText } from 'lib/ui';

export default async function (query) {
  const data = query.data ?? '';

  if (data === 'none') {
    await api.answerCallbackQuery({ callback_query_id: query.id });
    return;
  }

  if (data === 'back' && query.message?.chat?.type === 'private') {
    await api.deleteMessage({
      chat_id: query.message.chat.id,
      message_id: query.message.message_id,
    });
    await api.sendMessage({
      chat_id: query.message.chat.id,
      text: startText,
      reply_markup: menu,
    });
    await setStep(query.from.id);
    await api.answerCallbackQuery({ callback_query_id: query.id });
    return;
  }

  const match = data.match(/^accept-([01])-(\d+)$/);
  if (!match) return;

  const accepted = match[1] === '1';
  const submissionId = Number(match[2]);
  const submission = await db.select()
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .get();

  if (!submission || submission.status !== 'pending') {
    await api.answerCallbackQuery({
      callback_query_id: query.id,
      text: 'این آزمون قبلا بررسی شده است.',
      show_alert: true,
    });
    return;
  }

  const nextStatus = accepted ? 'processing' : 'rejected';
  const claimed = await db.update(submissions)
    .set({ status: nextStatus })
    .where(and(
      eq(submissions.id, submissionId),
      eq(submissions.status, 'pending'),
    ))
    .returning()
    .run();

  if (claimed.length === 0) {
    await api.answerCallbackQuery({ callback_query_id: query.id });
    return;
  }

  if (accepted) {
    try {
      await api.copyMessages({
        chat_id: ARCHIVE_CHANNEL,
        from_chat_id: ACCEPT_CHANNEL,
        message_ids: submission.messageIds,
      });
      await db.update(submissions)
        .set({ status: 'accepted' })
        .where(eq(submissions.id, submissionId))
        .run();
    } catch (error) {
      await db.update(submissions)
        .set({ status: 'pending' })
        .where(eq(submissions.id, submissionId))
        .run();
      throw error;
    }
  }

  await api.editMessageReplyMarkup({
    chat_id: query.message.chat.id,
    message_id: query.message.message_id,
    reply_markup: {
      inline_keyboard: [[{
        text: accepted ? '✅ تایید شد' : '❌ رد شد',
        callback_data: 'none',
      }]],
    },
  });
  await api.answerCallbackQuery({ callback_query_id: query.id });
}
