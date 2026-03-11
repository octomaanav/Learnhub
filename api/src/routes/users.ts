import { Router } from "express";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const allUsers = await db.select().from(users);
    res.json(allUsers);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// Generate a Telegram linking code for the logged-in user
router.post("/telegram-link-code", async (req, res) => {
  try {
    const userId = (req.user as any)?.id || req.body.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Generate random 6-digit code
    const list = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += list.charAt(Math.floor(Math.random() * list.length));
    }

    await db.update(users)
      .set({ telegramLinkingCode: code })
      .where(eq(users.id, userId));

    res.json({ code });
  } catch (error) {
    console.error("Error generating telegram link code:", error);
    res.status(500).json({ error: "Failed to generate code" });
  }
});

export default router;

