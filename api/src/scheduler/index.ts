import cron from 'node-cron';
import { dailyLessonPush } from './dailyPush.js';
import { checkSilentStudents } from './silenceDetection.js';
import { sendDueReviews } from './spacedRepetition.js';

export function startScheduler() {
    console.log('[Scheduler] Starting background jobs...');

    // Run daily push every morning at 8:00 AM
    cron.schedule('0 8 * * *', async () => {
        console.log('[Scheduler] Running daily lesson push...');
        await dailyLessonPush();
    });

    // Run silence detection every 2 hours
    cron.schedule('0 */2 * * *', async () => {
        console.log('[Scheduler] Running silence detection...');
        await checkSilentStudents();
    });

    // Run spaced repetition review send out every day at 10:00 AM
    cron.schedule('0 10 * * *', async () => {
        console.log('[Scheduler] Running spaced repetition reviews...');
        await sendDueReviews();
    });

    console.log('[Scheduler] Background jobs scheduled.');
}
