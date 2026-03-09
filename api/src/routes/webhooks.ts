import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

// Endpoint specifically for Telegram Webhooks
router.post("/telegram", async (req, res) => {
    // Send 200 OK early so Telegram doesn't retry while we process
    res.status(200).send("OK");

    try {
        const message = req.body.message;
        if (!message || !message.chat) return;

        const chatId = message.chat.id.toString();
        const firstName = message.from?.first_name || "Student";

        console.log("=========================================");
        console.log(`[Telegram Webhook] Message from ${firstName} (${chatId})`);

        // Check if user exists
        let user = await db.query.users.findFirst({
            where: eq(users.telegramChatId, chatId)
        });

        if (!user) {
            console.log(`[Telegram] New Telegram user. Creating profile...`);
            const [newUser] = await db.insert(users).values({
                name: firstName,
                email: `telegram_${chatId}@learnhub.local`,
                telegramChatId: chatId,
                isProfileComplete: false,
            }).returning();
            user = newUser;
            console.log(`[Telegram] Created user: ${user.id}`);
        } else {
            console.log(`[Telegram] Welcome back, ${user.name} (${user.id})`);
        }

        // We now have the user context! 
        // We will process voice or text in the next step.

        console.log("=========================================");
    } catch (error) {
        console.error("[Telegram Webhook] Error processing update:", error);
    }
});

export default router;
