// =====================================================================
// Minimal Gemini API client — free tier (https://ai.google.dev)
// Wraps generateContent and enforces "JSON only" structured output,
// since Gemini's REST API (unlike the Anthropic API) doesn't have a
// native forced-JSON tool-call mode on the free tier.
// =====================================================================

const GEMINI_MODEL = "gemini-2.0-flash"; // free-tier friendly, fast + cheap
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class GeminiJsonError extends Error {}

/**
 * Calls Gemini with a system-style instruction forcing raw JSON output,
 * then safely parses the response. Throws GeminiJsonError on any
 * malformed output rather than silently returning partial data.
 */
export async function generateStructuredJson<T>(params: {
  systemInstruction: string;
  userPrompt: string;
  temperature?: number;
}): Promise<T> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const body = {
    system_instruction: {
      parts: [
        {
          text:
            params.systemInstruction +
            "\n\nCRITICAL: Respond with ONLY raw JSON. No markdown fences, " +
            "no preamble, no trailing commentary. The response must be " +
            "valid JSON and nothing else.",
        },
      ],
    },
    contents: [{ role: "user", parts: [{ text: params.userPrompt }] }],
    generationConfig: {
      temperature: params.temperature ?? 0.4,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const text: string | undefined =
    data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new GeminiJsonError("Gemini returned no text content");
  }

  const cleaned = text.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new GeminiJsonError(`Gemini returned invalid JSON: ${cleaned}`);
  }
}
