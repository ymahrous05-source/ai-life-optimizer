// =====================================================================
// embedText()
// Generates a 768-dim embedding via Gemini's free-tier embedding model,
// used to build each task's "DNA" vector for similarity search.
// =====================================================================

const EMBEDDING_MODEL = "text-embedding-004"; // 768-dim, free tier
const EMBEDDING_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`;

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const res = await fetch(`${EMBEDDING_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: `models/${EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini embedding error (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const values: number[] | undefined = data?.embedding?.values;

  if (!values || values.length === 0) {
    throw new Error("Gemini returned no embedding values");
  }

  return values;
}

/** Builds the canonical text representation of a task used for its DNA vector. */
export function buildTaskEmbeddingInput(task: {
  title: string;
  description?: string | null;
  requiredEnergy?: string;
}): string {
  return [task.title, task.description ?? "", task.requiredEnergy ?? ""]
    .filter(Boolean)
    .join(" — ");
}
