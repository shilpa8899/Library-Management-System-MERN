const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Book = require('../models/book');
const Borrowing = require('../models/Borrowing');
const { createEmbedding } = require('../services/embeddingService');

const VECTOR_INDEX = process.env.MONGODB_VECTOR_INDEX || 'book_embedding_index';

async function vectorSearch(vector, { limit = 12, excludeIds = [] } = {}) {
  // Filter excluded books after retrieval so the index does not need an extra filter field.
  const candidates = await Book.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX,
        path: 'embedding',
        queryVector: vector,
        numCandidates: Math.max((limit + excludeIds.length) * 10, 100),
        limit: Math.max(limit + excludeIds.length, limit * 2),
      },
    },
    { $addFields: { similarityScore: { $meta: 'vectorSearchScore' } } },
    { $project: { embedding: 0, embeddingModel: 0 } },
  ]);
  const excluded = new Set(excludeIds.map((id) => id.toString()));
  return candidates.filter((book) => !excluded.has(book._id.toString())).slice(0, limit);
}

const semanticSearch = asyncHandler(async (req, res) => {
  const query = String(req.query.q || '').trim();
  if (!query) return res.status(400).json({ success: false, message: 'Enter a search phrase.' });
  if (query.length > 500) return res.status(400).json({ success: false, message: 'Search phrase must be 500 characters or fewer.' });

  let queryVector;
  try {
    queryVector = await createEmbedding(query);
    const books = await vectorSearch(queryVector, { limit: 20 });
    return res.json({ success: true, mode: 'semantic', count: books.length, data: books });
  } catch (error) {
    console.error('Semantic search failed:', error.message);
    const missingKey = !process.env.GEMINI_API_KEY;
    return res.status(503).json({
      success: false,
      message: missingKey
        ? 'Semantic search is not configured. Add OPENAI_API_KEY to the backend .env file.'
        : 'Semantic search is not ready. Check the embedding provider and MongoDB Atlas Vector Search index configuration.',
    });
  }
});

const similarBooks = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id).select('+embedding');
  if (!book) return res.status(404).json({ success: false, message: 'Book not found.' });

  let recommendations = [];
  if (book.embedding?.length) {
    try {
      recommendations = await vectorSearch(book.embedding, { limit: 8, excludeIds: [book._id] });
    } catch (error) {
      console.warn('Vector similarity unavailable; using genre fallback:', error.message);
    }
  }

  if (!recommendations.length) {
    recommendations = await Book.find({
      _id: { $ne: book._id },
      $or: [{ genre: book.genre }, { author: book.author }],
    }).sort('-createdAt').limit(8).select('-embedding -embeddingModel');
  }

  res.json({ success: true, data: recommendations });
});

const popularBooks = asyncHandler(async (req, res) => {
  const popular = await Borrowing.aggregate([
    { $group: { _id: '$book', borrowCount: { $sum: 1 } } },
    { $sort: { borrowCount: -1 } },
    { $limit: 8 },
    { $lookup: { from: 'books', localField: '_id', foreignField: '_id', as: 'book' } },
    { $unwind: '$book' },
    { $replaceRoot: { newRoot: { $mergeObjects: ['$book', { borrowCount: '$borrowCount' }] } } },
    { $project: { embedding: 0, embeddingModel: 0 } },
  ]);

  if (popular.length) return res.json({ success: true, data: popular });
  const recent = await Book.find({}).sort('-createdAt').limit(8).select('-embedding -embeddingModel');
  res.json({ success: true, data: recent, fallback: 'recently-added' });
});

const recommendationsForUser = asyncHandler(async (req, res) => {
  const history = await Borrowing.find({ user: req.user._id })
    .sort('-createdAt')
    .limit(30)
    .populate({ path: 'book', select: '+embedding title author genre description coverImage availableCopies createdAt' });

  const historyBooks = history.map((record) => record.book).filter(Boolean);
  const excludeIds = [...new Set(historyBooks.map((book) => book._id.toString()))];
  const vectors = historyBooks.map((book) => book.embedding).filter((vector) => Array.isArray(vector) && vector.length);
  let recommendations = [];

  if (vectors.length && process.env.GEMINI_API_KEY) {
    const dimensions = vectors[0].length;
    const compatible = vectors.filter((vector) => vector.length === dimensions);
    const average = Array(dimensions).fill(0);
    compatible.forEach((vector) => vector.forEach((value, index) => { average[index] += value / compatible.length; }));
    try {
      recommendations = await vectorSearch(average, { limit: 10, excludeIds });
    } catch (error) {
      console.warn('Personalized vector recommendations unavailable:', error.message);
    }
  }

  if (!recommendations.length && historyBooks.length) {
    const genres = [...new Set(historyBooks.map((book) => book.genre).filter(Boolean))];
    if (genres.length) {
      recommendations = await Book.find({ _id: { $nin: excludeIds }, genre: { $in: genres } })
        .sort('-createdAt').limit(10).select('-embedding -embeddingModel');
    }
  }

  if (!recommendations.length) {
    recommendations = await Book.find({ _id: { $nin: excludeIds } })
      .sort('-createdAt').limit(10).select('-embedding -embeddingModel');
  }

  res.json({ success: true, data: recommendations, personalized: vectors.length > 0 && recommendations.length > 0 });
});

module.exports = { semanticSearch, similarBooks, popularBooks, recommendationsForUser };
