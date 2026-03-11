import { db } from "../db/index.js";
import {
  contentVersions,
  contentTranslations,
  storyPlans,
  storySlides,
  storyAudio,
  brailleExports,
} from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { claimJob, markJobFailed, markJobSucceeded } from "../utils/jobQueue.js";
import { sha256Json, sha256Text } from "../utils/hash.js";
import { callGeminiJson } from "../utils/gemini.js";
import { synthesizeSpeech } from "../utils/tts.js";
import { saveBufferFile } from "../utils/storage.js";
import { generateImage } from "../utils/imageGen.js";
import { convertMixedLesson } from "../utils/braille/parseLesson.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getCanonical = async (contentKey: string, version: number) => {
  const rows = await db
    .select()
    .from(contentVersions)
    .where(and(eq(contentVersions.contentKey, contentKey), eq(contentVersions.version, version)))
    .limit(1);
  return rows[0];
};

const getTranslation = async (contentKey: string, version: number, locale: string) => {
  const rows = await db
    .select()
    .from(contentTranslations)
    .where(and(
      eq(contentTranslations.contentKey, contentKey),
      eq(contentTranslations.version, version),
      eq(contentTranslations.locale, locale)
    ))
    .limit(1);
  return rows[0];
};

const buildStoryPlan = async (payload: any, locale: string) => {
  const prompt = `Create a story plan (max 8 slides) for this lesson. Return ONLY JSON.
Include fields: style, slides[{index, caption, imagePrompt, onScreenText}].
Locale: ${locale}

Payload:
${JSON.stringify(payload)}
`;
  return callGeminiJson(prompt);
};

const processJob = async (job: any) => {
  const { jobType, contentKey, version, locale, slideIndex } = job;
  if (jobType === "translate_content") {
    const canonical = await getCanonical(contentKey, version);
    if (!canonical) return;
    const prompt = `Translate the payload to ${locale}. Return ONLY JSON.
Payload:
${JSON.stringify(canonical.payloadJson)}
`;
    const translated = await callGeminiJson(prompt);
    const translatedHash = sha256Json(translated);
    await db
      .insert(contentTranslations)
      .values({
        contentKey,
        version,
        locale: locale!,
        translatedPayloadJson: translated,
        translatedHash,
        model: "gemini",
      })
      .onConflictDoNothing();
    return;
  }

  if (jobType === "build_story_plan") {
    const canonical = await getCanonical(contentKey, version);
    if (!canonical) return;
    const payload = locale && locale !== canonical.canonicalLocale
      ? (await getTranslation(contentKey, version, locale))?.translatedPayloadJson || canonical.payloadJson
      : canonical.payloadJson;
    const plan = await buildStoryPlan(payload, locale || canonical.canonicalLocale);
    const planHash = sha256Json(plan);
    await db
      .insert(storyPlans)
      .values({
        contentKey,
        version,
        locale: locale || canonical.canonicalLocale,
        planJson: plan,
        planHash,
        model: "gemini",
      })
      .onConflictDoNothing();

    const slides = (plan as any)?.slides && Array.isArray((plan as any).slides) ? (plan as any).slides : [];
    for (const slide of slides) {
      const promptHash = sha256Text(slide.imagePrompt || "");
      const captionHash = sha256Text(slide.caption || "");
      await db
        .insert(storySlides)
        .values({
          contentKey,
          version,
          locale: locale || canonical.canonicalLocale,
          slideIndex: slide.index,
          prompt: slide.imagePrompt || "",
          promptHash,
          caption: slide.caption || "",
          captionHash,
        })
        .onConflictDoNothing();
    }
    return;
  }

  if (jobType === "generate_story_image") {
    const [slide] = await db
      .select()
      .from(storySlides)
      .where(and(
        eq(storySlides.contentKey, contentKey),
        eq(storySlides.version, version),
        eq(storySlides.locale, locale!),
        eq(storySlides.slideIndex, slideIndex!)
      ))
      .limit(1);
    if (!slide || slide.imagePath) return;
    const images = await generateImage(slide.prompt);
    if (!images || images.length === 0) return;
    const imageData = images[0]; // This is a base64 string
    const key = `generated/${contentKey}/${version}/${locale}/story/slide_${slideIndex}.svg`;
    const saved = await saveBufferFile(Buffer.from(imageData, "base64"), key);
    await db
      .update(storySlides)
      .set({
        imagePath: saved.publicUrl,
        imageMime: "image/svg+xml", // generateImage returns SVGs now

        imageHash: sha256Text(imageData),
        updatedAt: new Date(),
      })
      .where(eq(storySlides.id, slide.id));
    return;
  }

  if (jobType === "generate_story_audio") {
    const [slide] = await db
      .select()
      .from(storySlides)
      .where(and(
        eq(storySlides.contentKey, contentKey),
        eq(storySlides.version, version),
        eq(storySlides.locale, locale!),
        eq(storySlides.slideIndex, slideIndex!)
      ))
      .limit(1);
    if (!slide) return;
    const audio = await synthesizeSpeech(slide.caption, { languageCode: locale! });
    const key = `generated/${contentKey}/${version}/${locale}/audio/slide_${slideIndex}.wav`;
    const saved = await saveBufferFile(audio, key);
    await db
      .insert(storyAudio)
      .values({
        contentKey,
        version,
        locale: locale!,
        slideIndex: slideIndex!,
        voiceId: "default",
        ttsProvider: "gemini",
        audioPath: saved.publicUrl,
        audioMime: "audio/wav",
        audioHash: sha256Text(audio.toString("base64")),
      })
      .onConflictDoNothing();
    return;
  }

  if (jobType === "build_braille_export") {
    const canonical = await getCanonical(contentKey, version);
    if (!canonical) return;
    const payload = locale && locale !== canonical.canonicalLocale
      ? (await getTranslation(contentKey, version, locale))?.translatedPayloadJson || canonical.payloadJson
      : canonical.payloadJson;
    const braille = await convertMixedLesson(typeof payload === "string" ? payload : JSON.stringify(payload));
    const scope = job.scope || "microsection";
    const format = job.format || "full";
    await db
      .insert(brailleExports)
      .values({
        contentKey,
        version,
        locale: locale || canonical.canonicalLocale,
        scope,
        format,
        brailleText: format === "brf" ? (braille.brf || "") : (braille.fullBraille || ""),
        brailleHash: sha256Text(format === "brf" ? (braille.brf || "") : (braille.fullBraille || "")),
      })
      .onConflictDoNothing();
    return;
  }
};

export const startWorkerLoop = async () => {
  while (true) {
    const job = await claimJob();
    if (!job) {
      await sleep(500);
      continue;
    }
    try {
      await processJob(job);
      await markJobSucceeded(job.id);
    } catch (error) {
      await markJobFailed(job.id, error instanceof Error ? error.message : String(error));
    }
  }
};
