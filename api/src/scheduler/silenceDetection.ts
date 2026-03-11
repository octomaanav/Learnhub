import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { callGemini } from '../utils/gemini.js';
import { eq, isNotNull, and } from 'drizzle-orm';
import { sendTelegramMessage } from '../utils/telegram.js';

export async function checkSilentStudents() {
    try {
        console.log('[Scheduler] Checking for silent students...');

        const silentStudents = await db.query.users.findMany({
            where: and(
                isNotNull(users.telegramChatId),
                eq(users.lessonInProgress, true)
            )
        });

        for (const student of silentStudents) {
            if (!student.lastMessageAt) continue;

            const hoursSilent = (Date.now() - student.lastMessageAt.getTime()) / (1000 * 60 * 60);

            if (hoursSilent < 4) {
                continue;
            }

            const currentTopic = student.currentTopic || "your current lesson";
            let msg = "";

            if (hoursSilent < 6) {
                msg = "Still with me? No pressure — when you're ready, just reply 👋";
            } else if (hoursSilent < 24) {
                msg = await callGemini(`
                    Generate a curiosity hook about ${currentTopic}.
                    One surprising fact that makes them want to know more.
                    End with a simple question.
                    Keep it under 3 sentences. Do NOT use markdown formatting.
                `.trim()) || "Did you know there's more to learn about this topic? Let me know when you're ready to continue!";
            } else {
                msg = await callGemini(`
                    Student ${student.name} left mid-lesson on ${currentTopic}.
                    Write a warm re-entry message that:
                    - Acknowledges time has passed, no guilt
                    - Gives a 1-sentence recap of where they were
                    - Asks if they want to continue or start fresh
                    Keep it under 3 sentences. Do NOT use markdown formatting.
                `.trim()) || `Looks like we took a break from ${currentTopic}! Would you like to pick up where we left off or start something new?`;
            }

            if (student.telegramChatId) {
                await sendTelegramMessage(student.telegramChatId, msg);

                // Update their lastMessageAt so we don't spam them every 2 hours with the SAME threshold message
                await db.update(users)
                    .set({ lastMessageAt: new Date() })
                    .where(eq(users.id, student.id));
            }
        }
    } catch (e) {
        console.error('[Scheduler] Error in checkSilentStudents:', e);
    }
}
