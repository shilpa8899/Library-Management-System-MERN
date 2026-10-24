// controllers/bookController.js

const asyncHandler = require("express-async-handler");
const Book = require("../models/book"); // Your Mongoose Book model
const { updateBookEmbedding } = require("../services/embeddingService");

/**
 * @desc    Get all books with optional filtering, sorting, and pagination
 * @route   GET /api/books
 * @access  Public
 */
const getBooks = asyncHandler(async (req, res) => {
  let query;

  const reqQuery = { ...req.query };
  const removeFields = ["select", "sort", "page", "limit"];
  removeFields.forEach((param) => delete reqQuery[param]);

  let queryStr = JSON.stringify(reqQuery);
  queryStr = queryStr.replace(
    /\b(gt|gte|lt|lte|in)\b/g,
    (match) => `$${match}`,
  );

  query = Book.find(JSON.parse(queryStr));

  if (req.query.select) {
    const fields = req.query.select.split(",").join(" ");
    query = query.select(fields);
  }

  if (req.query.sort) {
    const sortBy = req.query.sort.split(",").join(" ");
    query = query.sort(sortBy);
  } else {
    query = query.sort("-createdAt");
  }

  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 50; // ✅ updated default limit
  const startIndex = (page - 1) * limit;
  const endIndex = page * limit;
  const total = await Book.countDocuments(JSON.parse(queryStr));

  query = query.skip(startIndex).limit(limit);

  const books = await query;

  const pagination = {};
  if (endIndex < total) {
    pagination.next = { page: page + 1, limit };
  }
  if (startIndex > 0) {
    pagination.prev = { page: page - 1, limit };
  }

  res.status(200).json({
    success: true,
    count: books.length,
    total,
    pagination,
    data: books,
  });
});

/**
 * @desc    Get a single book by ID
 * @route   GET /api/books/:id
 * @access  Public
 */
const getBookById = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    res.status(404);
    throw new Error("Book not found");
  }

  res.status(200).json({
    success: true,
    data: book,
  });
});

/**
 * @desc    Add a new book
 * @route   POST /api/books
 * @access  Private (Admin/Librarian)
 */
const addBook = asyncHandler(async (req, res) => {
  const {
    title,
    author,
    isbn,
    genre,
    publicationYear,
    description,
    quantity,
    isDigital,
    digitalLink,
    coverImage,
  } = req.body;

  // Check for duplicate ISBN
  const existingBook = await Book.findOne({ isbn });
  if (existingBook) {
    res.status(400);
    throw new Error("Book with this ISBN already exists");
  }

  const book = await Book.create({
    title,
    author,
    isbn,
    genre,
    publicationYear,
    description,
    quantity,
    availableCopies: quantity,
    isDigital,
    digitalLink,
    coverImage,
  });

  // Embeddings are optional: a missing API key must not block ordinary book management.
  if (process.env.GEMINI_API_KEY) {
    await updateBookEmbedding(book);
  }

  res.status(201).json({
    success: true,
    data: book,
  });
});

/**
 * @desc    Update a book by ID
 * @route   PUT /api/books/:id
 * @access  Private (Admin/Librarian)
 */

const updateBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);

  if (!book) {
    res.status(404);
    throw new Error("Book not found");
  }

  // Update inventory while preserving the number of borrowed copies.
  if (
    req.body.quantity !== undefined &&
    Number(req.body.quantity) !== book.quantity
  ) {
    const newQuantity = Number(req.body.quantity);

    if (!Number.isInteger(newQuantity) || newQuantity < 0) {
      res.status(400);
      throw new Error("Quantity must be a non-negative integer");
    }

    const borrowedCopies = book.quantity - book.availableCopies;

    if (newQuantity < borrowedCopies) {
      res.status(400);
      throw new Error("Quantity cannot be less than borrowed copies");
    }

    book.quantity = newQuantity;
    book.availableCopies = newQuantity - borrowedCopies;
  }

  // Only these fields affect the book's embedding.
  const searchableFields = [
    "title",
    "author",
    "genre",
    "description",
    "publicationYear",
  ];

  const searchableChanged = searchableFields.some(
    (field) =>
      req.body[field] !== undefined &&
      String(req.body[field]) !== String(book[field] ?? "")
  );

  // Never allow client requests to overwrite generated embeddings.
  const protectedFields = new Set([
    "_id",
    "embedding",
    "embeddingModel",
    "quantity",
    "availableCopies",
  ]);

  for (const [field, value] of Object.entries(req.body)) {
    if (!protectedFields.has(field)) {
      book[field] = value;
    }
  }

  await book.save();

  // Regenerate only if searchable metadata changed.
  if (searchableChanged && process.env.GEMINI_API_KEY) {
    const success = await updateBookEmbedding(book);

    if (!success) {
      console.error(
        `Book ${book._id} was updated, but its embedding could not be refreshed.`
      );
    }
  }

  res.status(200).json({
    success: true,
    data: book,
  });
});

/**
 * @desc    Delete a book by ID
 * @route   DELETE /api/books/:id
 * @access  Private (Admin/Librarian)
 */
const deleteBook = asyncHandler(async (req, res) => {
  const book = await Book.findById(req.params.id);
  if (!book) {
    res.status(404);
    throw new Error("Book not found");
  }

  await book.deleteOne();

  res.status(200).json({
    success: true,
    data: {},
  });
});

module.exports = {
  getBooks,
  getBookById,
  addBook,
  updateBook,
  deleteBook,
};
