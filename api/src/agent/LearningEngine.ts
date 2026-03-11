import { AgentResponse } from './types.js';
import { db } from '../db/index.js';
import { users, userChapters, lessons } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { callGemini } from '../utils/gemini.js';

export class LearningEngine {
    async determineNextAction(userId: string, userIntent: string): Promise<AgentResponse> {
        // 1. Consult the Student Profile DB
        console.log(`[LearningEngine] Fetching profile for user ${userId}`);
        const user = await db.query.users.findFirst({
            where: eq(users.id, userId)
        });

        const profileData = user?.profile ? JSON.stringify(user.profile) : "No specific profile data (disability/modality/progress) available.";
        const state = user?.lessonState || "idle";
        let currentTopic = user?.currentTopic || "Introduction";
        const progress = user?.lessonProgress || 0;
        let lessonContext = "";

        // Fetch actual lesson content from DB if enrolled
        try {
            const enrolledChapter = await db.query.userChapters.findFirst({
                where: eq(userChapters.userId, userId),
                with: { chapter: true }
            });

            if (enrolledChapter) {
                const chapterLessons = await db.query.lessons.findMany({
                    where: eq(lessons.chapterId, enrolledChapter.chapterId)
                });
                chapterLessons.sort((a: any, b: any) => a.sortOrder - b.sortOrder);

                if (chapterLessons.length > 0) {
                    const currentLessonIndex = Math.min(progress, chapterLessons.length - 1);
                    const currentLesson = chapterLessons[currentLessonIndex];

                    const newTopic = `${enrolledChapter.chapter.name} - ${currentLesson.title}`;
                    lessonContext = `\nLesson Material to Teach:\n${JSON.stringify(currentLesson.content).substring(0, 1000)}`;

                    if (currentTopic !== newTopic) {
                        currentTopic = newTopic;
                        await db.update(users).set({ currentTopic }).where(eq(users.id, userId));
                    }
                }
            }
        } catch (e) {
            console.error("[LearningEngine] Error fetching lesson context:", e);
        }
        const recentHistory = user?.recentHistory || [];
        const historyFormatted = recentHistory.map((m: any) => `${m.role}: ${m.content}`).join('\n');

        // 2. Build the orchestration prompt
        const systemPrompt = `
You are LearnHub, an ambient AI educational agent. Your goal is to provide concise, heavily contextualized teaching.
Here is the user's profile context:
${profileData}

Current topic: ${currentTopic}
Lesson progress: ${progress}%
Current state: ${state}
${lessonContext}

Recent Conversation History:
${historyFormatted || "No recent history."}

RULES:
1. You MUST start your response with exactly ONE of these state tags on its own line:
[STATE: introducing] (if starting a new topic)
[STATE: teaching] (if explaining a concept or answering a question about the topic)
[STATE: checking] (if asking a checking question to the student)
[STATE: celebrating] (if they mastered the checking question)
2. Follow up your tag with your concise response to the user.
3. Never ask more than ONE question at a time
4. Keep responses under 3 sentences unless explaining a concept
5. If state is 'checking', evaluate their answer based on the CURRENT TOPIC before moving on. If they are wrong, explain it and use [STATE: teaching].
6. Do NOT hallucinate or change the subject to something wildly unrelated to the current topic.
7. Adapt language complexity to their profile
8. Do NOT use markdown code blocks or large formatting unreadable by TTS.

The student has just said/asked:
"${userIntent}"
        `.trim();

        console.log(`[LearningEngine] Analyzing intent from user ${userId}: "${userIntent}"`);

        // 3. Call Gemini 2.0 Flash
        let responseText = `(Fallback) I heard you say: ${userIntent}`;
        let nextState = state;
        try {
            const geminiResult = await callGemini(systemPrompt);
            if (geminiResult) {
                // Parse the state tag, e.g. [STATE: teaching]
                const stateMatch = geminiResult.match(/\[STATE:\s*([a-zA-Z]+)\]/i);
                if (stateMatch) {
                    nextState = stateMatch[1].toLowerCase();
                    // Remove the tag from the final spoken text
                    responseText = geminiResult.replace(/\[STATE:\s*[a-zA-Z]+\]/i, '').trim();
                } else {
                    responseText = geminiResult.trim();
                    // Fallback state progression if AI forgets tag
                    if (state === 'idle') nextState = 'introducing';
                    else if (state === 'introducing') nextState = 'teaching';
                    else if (state === 'teaching') nextState = 'checking';
                    else if (state === 'checking') nextState = 'teaching';
                    else if (state === 'reviewing') nextState = 'celebrating';
                }
            }

            // Generate updated history (keep max last 6 messages)
            const updatedHistory = [
                ...recentHistory,
                { role: 'student', content: userIntent },
                { role: 'teacher', content: responseText }
            ];
            if (updatedHistory.length > 6) {
                updatedHistory.splice(0, updatedHistory.length - 6);
            }

            await db.update(users)
                .set({
                    lessonState: nextState,
                    lessonInProgress: true,
                    recentHistory: updatedHistory
                })
                .where(eq(users.id, userId));

        } catch (error) {
            console.error("[LearningEngine] Error calling Gemini:", error);
        }

        // 4. Return the decision
        return {
            text: responseText,
            action: 'chat'
        };
    }
}
