import { db } from '../db/index.js';
import { scheduledReviews, users } from '../db/schema.js';
import { callGemini } from '../utils/gemini.js';
import { eq } from 'drizzle-orm';
import { sendTelegramMessage } from '../utils/telegram.js';

export async function scheduleReviews(studentId: string, concept: string, masteryScore: number) {
    const reviewIntervals = [1, 3, 7, 14, 30]; // days
    const difficulty = masteryScore > 80 ? 1 : masteryScore > 50 ? 2 : 3;

    for (const days of reviewIntervals) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);

        await db.insert(scheduledReviews).values({
            studentId,
            concept,
            dueDate,
            difficulty,
            sent: false
        });
    }
}

export async function sendDueReviews() {
    try {
        console.log('[Scheduler] Checking for due spaced repetition reviews...');

        const now = new Date();

        const allPending = await db.query.scheduledReviews.findMany({
            where: eq(scheduledReviews.sent, false),
            with: {
                student: true
            }
        });

        const dueToday = allPending.filter(r => r.dueDate <= now);

        for (const review of dueToday) {
            const student = review.student;
            if (!student || !student.telegramChatId) continue;

            const question = await callGemini(`
                Create a single quiz question testing this concept: ${review.concept}
                Difficulty level (1=easy, 3=hard): ${review.difficulty}
                Format: conversational, not exam-like
                End with "Reply with your answer when ready!"
                Keep it under 3 sentences. Do NOT use markdown formatting.
            `.trim());

            if (question) {
                await sendTelegramMessage(student.telegramChatId, question);

                await db.update(scheduledReviews)
                    .set({ sent: true })
                    .where(eq(scheduledReviews.id, review.id));

                await db.update(users)
                    .set({
                        lessonState: 'reviewing',
                        lessonInProgress: true,
                        lastMessageAt: new Date()
                    })
                    .where(eq(users.id, student.id));
            }
        }
    } catch (e) {
        console.error('[Scheduler] Error in sendDueReviews:', e);
    }
}
