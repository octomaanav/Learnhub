import TelegramBot from 'node-telegram-bot-api';
import cron from 'node-cron';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, isNotNull, sql } from 'drizzle-orm';
import { callGemini } from '../utils/gemini.js';

// Initialize telegram bot if token is provided
const token = process.env.TELEGRAM_BOT_TOKEN || '';
export const telegramBot = token ? new TelegramBot(token, { polling: true }) : null;

if (telegramBot) {
    console.log('[Telegram] Bot initialized');

    // Basic command to link account
    telegramBot.onText(/\/start (.+)/, async (msg, match) => {
        const chatId = msg.chat.id;
        const linkingCode = match?.[1];

        if (!linkingCode) {
            telegramBot.sendMessage(chatId, "Welcome to LearnHub! Please use the link provided in your dashboard to connect your account.");
            return;
        }

        try {
            // Find user with this linking code
            const user = await db.query.users.findFirst({
                where: eq(users.telegramLinkingCode, linkingCode)
            });

            if (!user) {
                telegramBot.sendMessage(chatId, "Invalid or expired linking code. Please generate a new one from your dashboard.");
                return;
            }

            // Link the telegram chat ID
            await db.update(users)
                .set({ telegramChatId: chatId.toString(), telegramLinkingCode: null })
                .where(eq(users.id, user.id));

            telegramBot.sendMessage(chatId, `Success! 🎉 Your LearnHub account (${user.name}) is now connected. I'll send you personalized learning nudges here.`);
            console.log(`[Telegram] Linked user ${user.id} to chat ${chatId}`);
        } catch (error) {
            console.error('[Telegram] Error linking account:', error);
            telegramBot.sendMessage(chatId, "Sorry, there was an error linking your account. Please try again.");
        }
    });

    // Handle generic messages (Stretch goal: conversational review)
    telegramBot.on('message', (msg) => {
        // Ignore commands
        if (msg.text?.startsWith('/')) return;
        // Basic auto-reply for now, could be wired to Gemini
        telegramBot?.sendMessage(msg.chat.id, "I'm your LearnHub assistant! I'll remind you about your learning goals. For full interactive lessons, please use the main web dashboard.");
    });

    // =========================================================================
    // CRON JOB: Proactive Nudges
    // =========================================================================

    // Run every day at 10:00 AM (for demo purposes, we can run it every minute or manually trigger)
    // For hackathon demo, we will expose an endpoint to trigger this manually instead of waiting for cron.
    cron.schedule('0 10 * * *', async () => {
        console.log('[Telegram Cron] Running daily proactive nudges...');
        await sendProactiveNudges();
    });
} else {
    console.warn('[Telegram] TELEGRAM_BOT_TOKEN not set. Bot features are disabled.');
}

/**
 * Sends highly contextual proactive nudges to users via Telegram
 */
export async function sendProactiveNudges() {
    if (!telegramBot) {
        console.warn('[Telegram Service] Cannot send nudges, bot is not initialized.');
        return;
    }

    try {
        // Find users who have linked their telegram and have a current topic
        const activeUsers = await db.query.users.findMany({
            where: sql`${users.telegramChatId} IS NOT NULL AND ${users.currentTopic} IS NOT NULL`
        });

        console.log(`[Telegram Service] Found ${activeUsers.length} users to nudge`);

        for (const user of activeUsers) {
            if (!user.telegramChatId || !user.currentTopic) continue;

            // Generate a customized, context-aware nudge using Gemini
            const prompt = `You are a motivating AI learning coach for an app called LearnHub.
Your student is named "${user.name}".
Their current active topic to learn next is: "${user.currentTopic}".

Write a HIGHLY customized, short (1-2 sentences), friendly, and encouraging Telegram message to remind them to log back in and learn this specific topic.
Use emojis sparingly. Be enthusiastic but natural. DO NOT sound like an automated robot.
Example: "Hey Manav! You were doing great yesterday. Got 5 minutes right now to dive into Backpropagation?"`;

            try {
                const nudgeMessage = await callGemini(prompt);
                await telegramBot.sendMessage(user.telegramChatId, nudgeMessage);
                console.log(`[Telegram Service] Sent nudge to ${user.name}`);
            } catch (geminiError) {
                console.error(`[Telegram Service] Failed to generate/send nudge for ${user.id}:`, geminiError);
            }
        }
    } catch (error) {
        console.error('[Telegram Service] Error in sendProactiveNudges:', error);
    }
}
