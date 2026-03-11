import { GoogleGenerativeAI } from "@google/generative-ai";

const getGeminiApiKey = () => process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY;
const getDefaultModel = () => process.env.GEMINI_MODEL || "llama-3.3-70b-versatile";

if (!process.env.GEMINI_API_KEY) {
  console.warn("⚠️  GEMINI_API_KEY not set in environment variables");
}

/**
 * Strip markdown JSON fences from response
 */
const stripJsonFence = (value: string): string => {
  const fencedMatch = value.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch) return fencedMatch[1].trim();
  // Also try plain code fence
  const plainFence = value.match(/```\s*([\s\S]*?)```/);
  if (plainFence) return plainFence[1].trim();
  return value.trim();
};

/**
 * Robustly fix LaTeX backslash escaping in JSON strings.
 * This function properly handles:
 * - Escaped quotes and other escape sequences
 * - Multiline strings
 * - Nested structures
 * - LaTeX commands like \(, \), \vec, etc.
 */
const fixLatexEscaping = (jsonStr: string): string => {
  let result = '';
  let i = 0;
  let inString = false;

  while (i < jsonStr.length) {
    const char = jsonStr[i];
    const nextChar = i + 1 < jsonStr.length ? jsonStr[i + 1] : '';

    if (char === '"') {
      let backslashCount = 0;
      let j = i - 1;
      while (j >= 0 && jsonStr[j] === '\\') {
        backslashCount++;
        j--;
      }

      if (backslashCount % 2 === 0) {
        inString = !inString;
        result += char;
      } else {
        result += char;
      }
      i++;
      continue;
    }

    if (char === '\\' && inString) {
      // We're inside a string and found a backslash
      // Check if it's a valid JSON escape sequence
      // Valid: \", \\, \/, \b, \f, \n, \r, \t, \uXXXX
      if (nextChar.match(/["\\/bfnrtu]/)) {
        // Valid escape sequence, keep it
        result += char;
        i++;
        continue;
      } else {
        // This is likely a LaTeX backslash that needs escaping
        // Escape it: \ becomes \\
        result += '\\\\';
        i++;
        continue;
      }
    }

    // Regular character
    result += char;
    i++;
  }

  return result;
};

/**
 * Fix unescaped newlines and control characters in JSON strings
 */
const fixUnescapedChars = (jsonStr: string): string => {
  let result = '';
  let i = 0;
  let inString = false;
  let escapeNext = false;
  let stringStart = -1;

  while (i < jsonStr.length) {
    const char = jsonStr[i];

    if (escapeNext) {
      result += char;
      escapeNext = false;
      i++;
      continue;
    }

    if (char === '\\') {
      result += char;
      escapeNext = true;
      i++;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      if (inString) {
        stringStart = result.length;
      }
      result += char;
      i++;
      continue;
    }

    if (inString) {
      // Inside a string, escape control characters
      if (char === '\n') {
        result += '\\n';
      } else if (char === '\r') {
        result += '\\r';
      } else if (char === '\t') {
        result += '\\t';
      } else if (char === '\b') {
        result += '\\b';
      } else if (char === '\f') {
        result += '\\f';
      } else if (char.charCodeAt(0) < 32) {
        // Other control characters
        result += `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
      } else {
        result += char;
      }
    } else {
      result += char;
    }

    i++;
  }

  return result;
};

/**
 * Attempt to fix common JSON issues from LLM output
 */
const fixCommonJsonIssues = (jsonStr: string): string => {
  let fixed = jsonStr;

  // Remove any trailing commas before ] or }
  fixed = fixed.replace(/,(\s*[}\]])/g, '$1');

  // Remove trailing commas in objects/arrays (more aggressive)
  fixed = fixed.replace(/,(\s*\n\s*[}\]])/g, '$1');

  // Try to close unclosed arrays/objects at the end
  const openBraces = (fixed.match(/{/g) || []).length;
  const closeBraces = (fixed.match(/}/g) || []).length;
  const openBrackets = (fixed.match(/\[/g) || []).length;
  const closeBrackets = (fixed.match(/]/g) || []).length;

  // Add missing closing brackets/braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    fixed += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    fixed += '}';
  }

  return fixed;
};

/**
 * Extract JSON object from potentially malformed response
 * Tries to find the largest valid JSON structure
 */
const extractJson = (text: string): string => {
  // First, try to find JSON boundaries
  const firstBrace = text.indexOf('{');
  const firstBracket = text.indexOf('[');

  if (firstBrace === -1 && firstBracket === -1) {
    return text;
  }

  // Find the start
  const start = firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)
    ? firstBrace
    : firstBracket;

  // Find matching closing brace/bracket
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let end = start;

  for (let i = start; i < text.length; i++) {
    const char = text[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{' || char === '[') {
        depth++;
      } else if (char === '}' || char === ']') {
        depth--;
        if (depth === 0) {
          end = i + 1;
          break;
        }
      }
    }
  }

  return text.substring(start, end);
};

/**
 * Safely parse JSON, stripping fences and fixing common issues
 * Uses multiple strategies to handle various JSON formatting issues
 */
export const safeJsonParse = <T = unknown>(value: string): T | null => {
  const stripped = stripJsonFence(value);

  // Try parsing strategies in order of preference
  const strategies = [
    // 1. Direct parse (best case)
    () => JSON.parse(stripped),

    // 2. Extract JSON from response (in case there's extra text)
    () => JSON.parse(extractJson(stripped)),

    // 3. Fix LaTeX escaping only
    () => JSON.parse(fixLatexEscaping(stripped)),

    // 4. Fix unescaped characters only
    () => JSON.parse(fixUnescapedChars(stripped)),

    // 5. Fix common JSON issues only
    () => JSON.parse(fixCommonJsonIssues(stripped)),

    // 6. Fix LaTeX + unescaped chars
    () => JSON.parse(fixUnescapedChars(fixLatexEscaping(stripped))),

    // 7. Fix LaTeX + common issues
    () => JSON.parse(fixCommonJsonIssues(fixLatexEscaping(stripped))),

    // 8. Fix unescaped + common issues
    () => JSON.parse(fixCommonJsonIssues(fixUnescapedChars(stripped))),

    // 9. Extract + fix LaTeX
    () => JSON.parse(fixLatexEscaping(extractJson(stripped))),

    // 10. Extract + fix unescaped
    () => JSON.parse(fixUnescapedChars(extractJson(stripped))),

    // 11. Extract + fix common issues
    () => JSON.parse(fixCommonJsonIssues(extractJson(stripped))),

    // 12. All fixes combined
    () => JSON.parse(fixCommonJsonIssues(fixUnescapedChars(fixLatexEscaping(extractJson(stripped))))),
  ];

  for (let i = 0; i < strategies.length; i++) {
    try {
      const result = strategies[i]();
      if (i > 0) {
        console.log(`✓ JSON parsed successfully using strategy ${i + 1}`);
      }
      return result as T;
    } catch (error) {
      // Try next strategy
      if (i === strategies.length - 1) {
        // Last strategy failed, log the error
        console.error(`JSON parse error: All ${strategies.length} strategies failed`);
        console.error("Last error:", error instanceof Error ? error.message : String(error));
        console.error("Raw response (first 500 chars):", stripped.substring(0, 500));
        console.error("Raw response (last 500 chars):", stripped.substring(Math.max(0, stripped.length - 500)));
      }
    }
  }

  return null;
};

/**
 * Check if Gemini API key is configured
 */
export const hasGeminiApiKey = (): boolean => {
  return !!getGeminiApiKey();
};

/**
 * Call Gemini API with a prompt and return raw text response
 * @param prompt The prompt to send to Gemini
 * @param model Optional model name (defaults to env GEMINI_MODEL or gemini-2.0-flash-exp)
 * @param useStructuredOutput Optional: use structured JSON output (requires responseSchema)
 * @param responseSchema Optional: JSON schema for structured output
 * @returns Raw text response from Gemini
 */
export const callGemini = async (
  prompt: string,
  model?: string,
  useStructuredOutput: boolean = false,
  responseSchema?: object
): Promise<string | null> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey && process.env.USE_OLLAMA !== "true" && !process.env.OLLAMA_URL) {
    console.error("Gemini API key or Ollama not configured");
    return null;
  }

  try {
    const modelName = model || getDefaultModel();

    // 1. Ollama Support
    if (process.env.USE_OLLAMA === "true" || process.env.OLLAMA_URL) {
      console.log("🤖 Using local Ollama model...");
      try {
        const ollamaModel = process.env.OLLAMA_MODEL || (modelName.includes("llama") ? modelName : "llama3");
        const payload: any = {
          model: ollamaModel,
          prompt: prompt,
          stream: false,
          options: { temperature: 0.7 }
        };

        if (useStructuredOutput) {
          payload.format = "json";
        }

        const response = await fetch(process.env.OLLAMA_URL || "http://localhost:11434/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Ollama returned status ${response.status}`);
        }
        const data = await response.json() as any;
        return data.response;
      } catch (err: any) {
        console.error("Ollama fallback failed:", err?.message);
        throw err;
      }
    }

    // 4. Defaults to Gemini
    console.log("✨ Using Gemini API...");
    const genAI = new GoogleGenerativeAI(apiKey || "");

    // Configure generation config
    const generationConfig: any = {
      temperature: 0.7,
    };

    // Add structured output if requested and schema provided
    if (useStructuredOutput && responseSchema) {
      generationConfig.responseMimeType = 'application/json';
      generationConfig.responseSchema = responseSchema;
      console.log("Using structured JSON output mode");
    }

    const geminiModel = genAI.getGenerativeModel({
      model: modelName,
      generationConfig
    });

    const result = await geminiModel.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      console.warn("Gemini API returned empty response");
      return null;
    }

    // Check for truncation indicators
    const finishReason = (response as any).candidates?.[0]?.finishReason;
    if (finishReason === 'MAX_TOKENS' || finishReason === 'LENGTH') {
      console.warn("⚠️  Response may be truncated (finishReason: " + finishReason + ")");
    }

    return text;
  } catch (err: any) {
    // Log detailed error information
    console.error("Gemini API call failed:");
    console.error("  Error message:", err?.message || String(err));
    console.error("  Error code:", err?.code);
    console.error("  Error status:", err?.status);
    if (err?.response) {
      console.error("  Response:", err.response);
    }
    throw err;
  }
};

/**
 * Enhance prompt to ensure better JSON output from Gemini
 */
const enhancePromptForJson = (originalPrompt: string, attempt: number): string => {
  if (attempt === 0) {
    return originalPrompt;
  }

  // On retry, add more explicit JSON instructions
  const jsonInstructions = `

CRITICAL: You must output ONLY valid JSON. Follow these rules strictly:
1. Escape ALL backslashes in LaTeX: use \\\\ instead of \\
2. Escape ALL quotes inside strings: use \\" instead of "
3. Escape ALL newlines: use \\n instead of actual newlines
4. Do NOT include any text before or after the JSON
5. Do NOT use markdown code fences
6. Ensure all strings are properly closed
7. Ensure all arrays and objects are properly closed
8. Do NOT truncate the response - output the complete JSON

Example of correct LaTeX escaping:
- Wrong: "formula: \\( x = \\frac{a}{b} \\)"
- Correct: "formula: \\\\( x = \\\\frac{a}{b} \\\\)"

Output ONLY the JSON object, nothing else.`;

  return originalPrompt + jsonInstructions;
};

/**
 * Call Gemini API and parse the response as JSON
 * @param prompt The prompt to send to Gemini (should request JSON output)
 * @param model Optional model name (defaults to env GEMINI_MODEL or gemini-2.0-flash-exp)
 * @param retries Number of retries if JSON parsing fails (default: 2)
 * @returns Parsed JSON object of type T, or null if parsing fails
 */
export const callGeminiJson = async <T = unknown>(
  prompt: string,
  model?: string,
  retries: number = 2
): Promise<T | null> => {
  let lastError: Error | null = null;
  let lastResponse: string | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      console.log(`Retrying Gemini JSON call (attempt ${attempt + 1}/${retries + 1})...`);
      // Enhance prompt on retry with more explicit instructions
      prompt = enhancePromptForJson(prompt, attempt);
    }

    try {
      const text = await callGemini(prompt, model);
      if (!text) {
        lastError = new Error("Empty response from Gemini");
        continue;
      }

      lastResponse = text;

      // Check if response seems truncated (ends abruptly)
      const trimmed = text.trim();
      if (trimmed.length > 0 && !trimmed.endsWith('}') && !trimmed.endsWith(']')) {
        console.warn("⚠️  Response may be truncated (doesn't end with } or ])");
        // Try to find the last complete JSON structure
        const lastBrace = trimmed.lastIndexOf('}');
        const lastBracket = trimmed.lastIndexOf(']');
        const lastComplete = Math.max(lastBrace, lastBracket);
        if (lastComplete > trimmed.length * 0.8) {
          // If we have most of the JSON, try parsing just that part
          console.log("Attempting to parse partial JSON (truncated response)");
          const partialJson = trimmed.substring(0, lastComplete + 1);
          const partialParsed = safeJsonParse<T>(partialJson);
          if (partialParsed !== null) {
            console.warn("⚠️  Successfully parsed truncated response (some data may be missing)");
            return partialParsed;
          }
        }
      }

      const parsed = safeJsonParse<T>(text);
      if (parsed !== null) {
        if (attempt > 0) {
          console.log(`✓ Successfully parsed JSON on retry attempt ${attempt + 1}`);
        }
        return parsed;
      }

      lastError = new Error("Failed to parse JSON response");

      // If we have a response but parsing failed, log more details
      if (lastResponse) {
        const responseLength = lastResponse.length;
        console.error(`Response length: ${responseLength} characters`);
        if (responseLength > 10000) {
          console.warn("⚠️  Very large response - may have been truncated by API");
        }
      }

    } catch (apiError) {
      console.error(`Gemini API error on attempt ${attempt + 1}:`, apiError);
      lastError = apiError instanceof Error ? apiError : new Error(String(apiError));
      // If it's an API error (not a parsing error), wait before retrying
      if (attempt < retries) {
        const waitTime = 1000 * (attempt + 1);
        console.log(`Waiting ${waitTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error(`All ${retries + 1} attempts to get valid JSON failed. Last error:`, lastError?.message);
  if (lastResponse) {
    // Save problematic response to a file for debugging (optional)
    console.error("Last response preview:", lastResponse.substring(0, 1000));
  }
  return null;
};
