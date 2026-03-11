import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { agentHub } from "../agent/AgentHub.js";

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

        const rawText = message.text?.trim() || "";
        const textBody = rawText.toUpperCase();
        console.log("[Telegram] Raw text:", JSON.stringify(rawText));

        // 1. Special dev helper: show a "Call LearnHub" button.
        // Handle variants like "/call", "/call@YourBot", "call".
        const commandToken = textBody.split(/\s+/)[0];
        if (
            commandToken === "CALL" ||
            commandToken === "/CALL" ||
            commandToken.startsWith("/CALL@")
        ) {
            console.log("[Telegram] Detected /call command, sending call button...");
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            if (!botToken) {
                console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured");
                return;
            }

            // Telegram does not allow localhost/HTTP URLs for inline button links.
            // Use your public HTTPS dev URL (ngrok) here so Telegram accepts it.
            const callUrl = process.env.TELEGRAM_CALL_URL || process.env.FRONTEND_URL || "https://example.com/call";
            const resp = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: "Tap below to talk to the LearnHub voice tutor:",
                    reply_markup: {
                        inline_keyboard: [[
                            {
                                text: "📞 Call LearnHub",
                                url: callUrl
                            }
                        ]]
                    }
                })
            }).catch(e => console.error("[Telegram] Error sending call button (network error):", e));

            try {
                if (resp) {
                    const text = await resp.text();
                    console.log("[Telegram] sendMessage status:", resp.status, "body:", text.slice(0, 200));
                }
            } catch (e) {
                console.error("[Telegram] Error reading sendMessage response:", e);
            }
            return;
        }

        // 2. Linking code flow (only if not a command)
        if (!commandToken.startsWith("/")) {
            if (textBody.length >= 6) {
                const linkUser = await db.query.users.findFirst({
                    where: eq(users.telegramLinkingCode, textBody)
                });

                if (linkUser) {
                    console.log(`[Telegram] Linking user ${linkUser.id} to chat ${chatId}`);

                    // Clear any temporary user that might have captured this chat ID
                    // (e.g., if they sent /start before sending the code)
                    await db.update(users)
                        .set({ telegramChatId: null })
                        .where(eq(users.telegramChatId, chatId));

                    // Assign the chat ID to the real user
                    await db.update(users)
                        .set({ telegramChatId: chatId, telegramLinkingCode: null })
                        .where(eq(users.id, linkUser.id));

                    console.log(`[Telegram] Successfully linked!`);
                    // We can also send a success message via Telegram API here later
                    return;
                }
            }
        }

        // 3. Normal flow: Check if user already exists
        let user = await db.query.users.findFirst({
            where: eq(users.telegramChatId, chatId)
        });

        if (!user) {
            console.log(`[Telegram] Unlinked user ${chatId}. Rejecting message and prompting link...`);
            // TODO: Send Telegram message "Welcome! Please log into the LearnHub web app and generate a 6-digit link code to connect your account."
            return;
        } else {
            console.log(`[Telegram] Welcome back, ${user.name} (${user.id})`);
        }

        // Update lastMessageAt so silence detection resets
        await db.update(users)
            .set({ lastMessageAt: new Date() })
            .where(eq(users.id, user.id));

        // We now have the user context! 
        // 3. Process with the Agent Hub
        const agentResponse = await agentHub.processInteraction({
            userId: user.id,
            channel: 'telegram',
            modality: 'text', // Assuming text for now, we will add voice check later
            payload: {
                text: textBody
            }
        });

        // 4. Send response back to Telegram
        if (agentResponse.text) {
            const botToken = process.env.TELEGRAM_BOT_TOKEN;
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text: agentResponse.text
                })
            }).catch(e => console.error("[Telegram] Error sending reply:", e));
            console.log(`[Telegram] Sent reply to ${user.name}`);
        }

        console.log("=========================================");
    } catch (error) {
        console.error("[Telegram Webhook] Error processing update:", error);
    }
});

export default router;
