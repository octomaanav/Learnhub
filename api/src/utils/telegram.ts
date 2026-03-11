export async function sendTelegramMessage(chatId: string, text: string) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.warn("[Telegram] TELEGRAM_BOT_TOKEN not configured");
        return;
    }

    try {
        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: text
            })
        });
        console.log(`[Telegram] Successfully sent proactive message to ${chatId}`);
    } catch (e) {
        console.error("[Telegram] Error sending message:", e);
    }
}
