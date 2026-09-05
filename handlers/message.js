import { api, db } from 'sdk';
import { asc, eq } from 'sdk/db';
import { draftFiles, submissions } from 'schema';
import { ACCEPT_CHANNEL, ADMINS, MAX_FILES } from 'lib/config';
import { getUser, parseStep, setStep } from 'lib/state';
import { back, backWithNo, menu, sendToChannel, startText } from 'lib/ui';

const MAIN_MENU_TEXT = '◀️ بازگشت به منوی اصلی';
const SEND_FILES_TEXT = '📤 ارسال فایل‌ها';
const EXAM_TYPES = ['📝 ثبت پایان‌ترم', '📝 ثبت میان‌ترم'];

function hashtag(value) {
  return `#${value.replace(/[ ‌]/g, '_')}`;
}

async function showMainMenu(chatId) {
  await api.sendMessage({ chat_id: chatId, text: startText, reply_markup: menu });
  await setStep(chatId);
}

export default async function (message) {
  if (message.chat?.type !== 'private' || !message.from?.id) return;

  const userId = message.from.id;
  const text = message.text ?? '';
  const user = await getUser(userId);
  const step = parseStep(user.step);

  if (/^-?\d+$/.test(text) && ADMINS.includes(userId)) {
    const targetId = Number(text);
    const member = await api.getChatMember({ chat_id: targetId, user_id: targetId });
    const name = member.user?.first_name ?? '';
    const username = member.user?.username ? `@${member.user.username}` : '-';
    await api.sendMessage({
      chat_id: userId,
      text: `ID: ${text}\nName: ${name}\nUsername: ${username}`,
    });
    return;
  }

  if (text === '/start' || text === MAIN_MENU_TEXT) {
    await showMainMenu(userId);
    return;
  }

  if (EXAM_TYPES.includes(text)) {
    const examType = text.replace('📝 ثبت ', '');
    await api.sendMessage({
      chat_id: userId,
      text: `👤 نام استاد درس رو ارسال کنید یا نامشخص رو از پایین صفحه انتخاب کنید:

- برای مثال:
قوامی‌زاده
وحیدی
عطارزاده`,
      reply_markup: backWithNo,
    });
    await setStep(userId, { stage: 'professor', examType });
    return;
  }

  if (step?.stage === 'professor') {
    await api.sendMessage({
      chat_id: userId,
      text: `📚 نام درس رو ارسال کنید:
- سعی کنید از کلیدواژه‌های بیشتری استفاده کنید. از زدن آندراسکور و هشتگ هم پرهیز کنید. ربات موقع ارسال می‌زنه.

- برای مثال:
ریزپردازنده
طراحی سیستم دیجیتال DSD
معماری کامپیوتر`,
      reply_markup: back,
    });
    await setStep(userId, { ...step, stage: 'lesson', professor: text });
    return;
  }

  if (step?.stage === 'lesson') {
    await api.sendMessage({
      chat_id: userId,
      text: `📄 فایل(ها) رو ارسال کنید و پس از اتمام ارسال،‌ روی ارسال به کانال از پایین صفحه بزنید:

- حداکثر تعداد فایل ۲۰ فایل است.`,
      reply_markup: sendToChannel,
    });
    await db.delete(draftFiles).where(eq(draftFiles.userId, userId)).run();
    await setStep(userId, { ...step, stage: 'files', lesson: text });
    return;
  }

  if (text === SEND_FILES_TEXT && step?.stage === 'files') {
    const files = await db.select()
      .from(draftFiles)
      .where(eq(draftFiles.userId, userId))
      .orderBy(asc(draftFiles.id))
      .all();

    if (files.length === 0) {
      await api.sendMessage({
        chat_id: userId,
        text: '📄 فایلی برای ارسال وجود ندارد. لطفا حداقل یک فایل ارسال کنید.',
      });
      return;
    }

    const professor = step.professor.replace('👤 ', '');
    const header = `📝 نوع امتحان: ${hashtag(step.examType)}\n\n` +
      `👤 نام استاد: ${hashtag(professor)} | ${professor}\n\n` +
      `📚 نام درس: ${hashtag(step.lesson)} | ${step.lesson}\n\n` +
      '📄 فایل‌ها:';

    const [submission] = await db.insert(submissions)
      .values({ userId, messageIds: [], status: 'preparing' })
      .returning()
      .run();

    const copiedMessageIds = [];
    const headerMessage = await api.sendMessage({ chat_id: ACCEPT_CHANNEL, text: header });
    copiedMessageIds.push(headerMessage.message_id);

    for (const file of files) {
      const copied = await api.copyMessage({
        chat_id: ACCEPT_CHANNEL,
        from_chat_id: userId,
        message_id: file.messageId,
      });
      copiedMessageIds.push(copied.message_id);
    }

    await db.update(submissions)
      .set({ messageIds: copiedMessageIds, status: 'pending' })
      .where(eq(submissions.id, submission.id))
      .run();

    await api.sendMessage({
      chat_id: ACCEPT_CHANNEL,
      text: '📚 پیامای بالا تاییده؟',
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ تایید', callback_data: `accept-1-${submission.id}` }],
          [{ text: '-----------', callback_data: 'none' }],
          [{ text: '❌ رد', callback_data: `accept-0-${submission.id}` }],
        ],
      },
    });

    await api.sendMessage({
      chat_id: userId,
      text: '📝 امتحان با موفقیت برای تایید ادمین‌ها ارسال شد و به زودی در کانال قرار خواهد گرفت.',
      reply_markup: menu,
    });
    await db.delete(draftFiles).where(eq(draftFiles.userId, userId)).run();
    await setStep(userId);

    const sender = [message.from.first_name, message.from.last_name].filter(Boolean).join(' ');
    const username = message.from.username ? `@${message.from.username}` : '';
    await api.sendMessage({
      chat_id: ADMINS[0],
      text: `exam sent by ${userId} ${sender} ${username}`.trim(),
    });
    return;
  }

  if (step?.stage === 'files') {
    const count = await db.$count(draftFiles, eq(draftFiles.userId, userId));
    if (count >= MAX_FILES) {
      await api.sendMessage({
        chat_id: userId,
        text: '📄 تعداد فایل‌ها بیشتر از ۲۰ عدد نباید باشد.',
      });
      return;
    }

    await db.insert(draftFiles)
      .values({ userId, messageId: message.message_id })
      .onConflictDoNothing({ target: [draftFiles.userId, draftFiles.messageId] })
      .run();
    const savedCount = await db.$count(draftFiles, eq(draftFiles.userId, userId));
    await api.sendMessage({
      chat_id: userId,
      text: `📝 فایل ثبت شد. تعداد کل فایل‌ها: ${savedCount}\n\n👈 برای ارسال فایل در کانال از دکمه ارسال فایل پایین صفحه اقدام کنید.`,
      reply_parameters: { message_id: message.message_id },
    });
  }
}
