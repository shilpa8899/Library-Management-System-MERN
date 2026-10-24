
require('dotenv').config();

const mongoose = require('mongoose');
const Book = require('../models/book');
const {
  updateBookEmbedding,
  EMBEDDING_MODEL,
} = require('../services/embeddingService');

async function main() {
  if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is missing from backend/.env');
  }

  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is missing from backend/.env');
  }

  await mongoose.connect(process.env.MONGO_URI);

  let indexed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    const books = await Book.find({}).select(
      '+embedding +embeddingModel'
    );

    console.log(`Found ${books.length} books.`);
    console.log(`Embedding model: ${EMBEDDING_MODEL}`);

    for (const book of books) {
      const hasEmbedding =
        Array.isArray(book.embedding) &&
        book.embedding.length > 0 &&
        book.embeddingModel === EMBEDDING_MODEL;

      if (hasEmbedding) {
        skipped++;
        continue;
      }

      const success = await updateBookEmbedding(book);

      if (success) {
        indexed++;
        console.log(`Indexed: ${book.title}`);
      } else {
        failed++;
        console.error(`Failed: ${book.title}`);
      }

      // Brief pause between API requests.
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('\nEmbedding indexing complete.');
    console.log(`Indexed: ${indexed}`);
    console.log(`Skipped: ${skipped}`);
    console.log(`Failed: ${failed}`);
  } finally {
    await mongoose.disconnect();
  }

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main().catch(async (error) => {
  console.error('Embedding indexing failed:', error.message);

  try {
    await mongoose.disconnect();
  } catch (_) {
    // Ignore disconnect errors.
  }

  process.exitCode = 1;
});
