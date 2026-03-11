import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { callGemini } from '../utils/gemini.js';
import { eq, isNotNull } from 'drizzle-orm';
import { sendTelegramMessage } from '../utils/telegram.js';

export async function dailyLessonPush() {
    try {
        // Find all users who have a telegram chat ID hooked up
        const students = await db.query.users.findMany({
            where: isNotNull(users.telegramChatId)
        });

        for (const student of students) {
            const profile = student.profile ? JSON.stringify(student.profile) : "No profile data";
            const currentTopic = student.currentTopic || "Introduction";

            const prompt = `
                Student name: ${student.name}
                Student profile: ${profile}
                Current topic: ${currentTopic}
                Lesson progress: ${student.lessonProgress}%
                
                Generate a warm, personal good morning message that:
                - Mentions their name
                - Reminds them where they left off (${currentTopic})
                - Tells them what today's focus is
                - Asks ONE question to start the lesson
                Keep it under 3 sentences. Do NOT use markdown formatting.
            `.trim();

            const message = await callGemini(prompt);

            if (message && student.telegramChatId) {
                await sendTelegramMessage(student.telegramChatId, message);

                // Update their state
                await db.update(users)
                    .set({
                        lessonState: 'checking',
                        lessonInProgress: true,
                        lastMessageAt: new Date()
                    })
                    .where(eq(users.id, student.id));
            }
        }
    } catch (e) {
        console.error('[Scheduler] Error in dailyLessonPush:', e);
    }
}
