import { callGemini } from "./gemini.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY not set in environment variables");
}

/**
 * Generate an image using Gemini to create an SVG diagram
 * @param prompt The description/prompt for the image
 * @param numberOfImages Number of images to generate (1-4, default: 1)
 * @returns Array of base64-encoded SVG data
 */
export const generateImage = async (
  prompt: string,
  numberOfImages: number = 1
): Promise<string[]> => {
  if (!prompt || prompt.trim().length === 0) {
    throw new Error("Prompt is required");
  }

  try {
    const aiPrompt = `You are an expert educational graphic designer. Create a clean, beautiful, scalable vector graphic (SVG) diagram that represents the following concept. 
The canvas size should be exactly 800x600.
Use modern typography, attractive colors, and clear shapes.
Include text labels where appropriate.
Return ONLY valid SVG code. No markdown fences, no explanations, just the raw SVG XML code starting with <svg> and ending with </svg>.

Concept: ${prompt}`;

    console.log(`Generating diagram with Gemini: "${prompt.substring(0, 100)}..."`);
    const svgCode = await callGemini(aiPrompt);

    if (!svgCode || !svgCode.includes("<svg") || !svgCode.includes("</svg>")) {
      throw new Error("Gemini failed to generate valid SVG code");
    }

    // Extract just the SVG part (in case it added markdown despite instructions)
    const svgMatch = svgCode.match(/<svg[\s\S]*?<\/svg>/i);
    if (!svgMatch) {
      throw new Error("Could not extract SVG from Gemini response");
    }

    const cleanSvg = svgMatch[0];

    // Convert to base64
    const base64Svg = Buffer.from(cleanSvg, 'utf-8').toString('base64');

    // Return an array of size `numberOfImages` to maintain the API shape
    return Array(numberOfImages).fill(base64Svg);
  } catch (error) {
    console.error("Error generating image:", error);
    if (error instanceof Error) {
      throw new Error(`Failed to generate image: ${error.message}`);
    }
    throw new Error("Failed to generate image: Unknown error");
  }
};

/**
 * Generate a single SVG and return it as base64 data URL
 * @param prompt The description/prompt for the image
 * @returns Base64 data URL (data:image/svg+xml;base64,...)
 */
export const generateImageAsDataUrl = async (
  prompt: string
): Promise<string> => {
  const images = await generateImage(prompt, 1);
  if (images.length === 0) {
    throw new Error("No image was generated");
  }
  return `data:image/svg+xml;base64,${images[0]}`;
};

