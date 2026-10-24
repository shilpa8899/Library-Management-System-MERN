const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || "gemini-embedding-2";

const EMBEDDING_DIMENSIONS = 1536;

function getBookText(book) {
  return [
    `Title: ${book.title || ""}`,
    `Author: ${book.author || ""}`,
    `Genre: ${book.genre || ""}`,
    `Description: ${book.description || ""}`,
    `Publication year: ${book.publicationYear || ""}`,
  ]
    .join("\n")
    .trim();
}

async function createEmbedding(text, taskType = "RETRIEVAL_QUERY") {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Add GEMINI_API_KEY to backend .env");
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        content: {
          parts: [
            {
              text:
                (taskType === "RETRIEVAL_DOCUMENT"
                  ? "task: search document | "
                  : "task: search query | ") + String(text).slice(0, 12000),
            },
          ],
        },
        outputDimensionality: EMBEDDING_DIMENSIONS,
      }),
    },
  );

  const result = await response.json();

  if (!response.ok) {
    throw new Error(
      result?.error?.message || "Gemini embedding request failed",
    );
  }

  const vector = result?.embedding?.values;

  if (!Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error("Gemini returned an invalid embedding vector");
  }

  return vector;
}

async function updateBookEmbedding(book) {
  try {
    const vector = await createEmbedding(
      getBookText(book),
      "RETRIEVAL_DOCUMENT",
    );

    book.embedding = vector;
    book.embeddingModel = EMBEDDING_MODEL;
    await book.save();

    return true;
  } catch (error) {
    console.error(
      `Could not create embedding for book ${book._id}: ${error.message}`,
    );
    return false;
  }
}

module.exports = {
  createEmbedding,
  getBookText,
  updateBookEmbedding,
  EMBEDDING_MODEL,
};
