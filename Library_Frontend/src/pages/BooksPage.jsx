
import React, { useEffect, useMemo, useState } from "react";
import api from "../utils/api";
import BookCard from "../components/BookCard";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../context/AuthContext";
import "./BooksPage.css";

const BooksPage = () => {
  const { user } = useAuth();

  const [books, setBooks] = useState([]);
  const [popularBooks, setPopularBooks] = useState([]);
  const [recommendedBooks, setRecommendedBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [searchMode, setSearchMode] = useState("keyword");
  const [semanticResults, setSemanticResults] = useState(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [semanticError, setSemanticError] = useState("");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const booksPerPage = 16;

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const response = await api.get("/books");
        setBooks(response.data.data || []);
        setError(null);
      } catch (err) {
        console.error("Error fetching books:", err);
        setError("Failed to load books. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, []);

  useEffect(() => {
    api
      .get("/books/recommendations/popular")
      .then((response) =>
        setPopularBooks(response.data.data || [])
      )
      .catch((err) =>
        console.warn("Could not load popular books:", err.message)
      );
  }, []);

  useEffect(() => {
    if (!user) {
      setRecommendedBooks([]);
      return;
    }

    api
      .get("/books/recommendations/for-you")
      .then((response) =>
        setRecommendedBooks(response.data.data || [])
      )
      .catch((err) =>
        console.warn("Could not load recommendations:", err.message)
      );
  }, [user]);

  const runSemanticSearch = async (event) => {
    event?.preventDefault();

    if (!searchTerm.trim()) {
      setSemanticError("Enter a phrase to search by meaning.");
      setSemanticResults([]);
      setCurrentPage(1);
      return;
    }

    try {
      setSemanticLoading(true);
      setSemanticError("");
      setCurrentPage(1);

      const response = await api.get("/books/semantic-search", {
        params: { q: searchTerm.trim() },
      });

      setSemanticResults(response.data.data || []);
    } catch (err) {
      setSemanticResults([]);
      setSemanticError(
        err.response?.data?.message ||
          "Semantic search failed. Check the backend configuration."
      );
    } finally {
      setSemanticLoading(false);
    }
  };

  const filteredBooks = useMemo(() => {
    if (searchMode === "semantic") {
      return semanticResults || [];
    }

    const lowerTerm = searchTerm.toLowerCase().trim();

    if (!lowerTerm) return books;

    return books.filter((book) =>
      [
        book.title,
        book.author,
        book.genre,
        book.isbn,
        book.description,
      ].some((value) =>
        String(value || "").toLowerCase().includes(lowerTerm)
      )
    );
  }, [books, searchTerm, searchMode, semanticResults]);

  const totalPages = Math.ceil(filteredBooks.length / booksPerPage);

  // Keep the current page valid when the result count changes.
  useEffect(() => {
    setCurrentPage((page) =>
      Math.max(1, Math.min(page, totalPages || 1))
    );
  }, [totalPages]);

  const startIndex = (currentPage - 1) * booksPerPage;

  const currentBooks = filteredBooks.slice(
    startIndex,
    startIndex + booksPerPage
  );

  const changeSearchMode = (mode) => {
    setSearchMode(mode);
    setSemanticResults(null);
    setSemanticError("");
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="books-loading">
        <LoadingSpinner />
        <p>Loading books...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="books-error">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="books-page">
      <h2 className="books-title">Our Book Collection</h2>

      <form
        className="book-search-form"
        onSubmit={
          searchMode === "semantic"
            ? runSemanticSearch
            : (event) => event.preventDefault()
        }
      >
        <input
          type="text"
          placeholder={
            searchMode === "semantic"
              ? "Try: books that explain computer security..."
              : "Search by title, author, genre, or ISBN..."
          }
          value={searchTerm}
          onChange={(event) => {
            setSearchTerm(event.target.value);
            setCurrentPage(1);

            if (searchMode === "semantic") {
              setSemanticResults(null);
            }
          }}
          className="books-search-bar"
        />

        <select
          value={searchMode}
          onChange={(event) => changeSearchMode(event.target.value)}
          aria-label="Search type"
          className="book-search-mode"
        >
          <option value="keyword">Keyword search</option>
          <option value="semantic">Semantic search</option>
        </select>

        {searchMode === "semantic" && (
          <button
            className="book-search-button"
            type="submit"
            disabled={semanticLoading}
          >
            {semanticLoading ? "Searching..." : "Search by meaning"}
          </button>
        )}

        {searchMode === "keyword" && searchTerm && (
          <button
            className="book-search-button"
            type="button"
            onClick={() => {
              setSearchTerm("");
              setCurrentPage(1);
            }}
          >
            Clear
          </button>
        )}
      </form>

      {searchMode === "semantic" && (
        <p className="search-help">
          Describe the topic you want to learn about. Semantic search
          compares meaning, not only exact words.
        </p>
      )}

      {semanticError && (
        <p className="books-search-error">{semanticError}</p>
      )}

      {searchMode === "keyword" &&
        !searchTerm.trim() &&
        popularBooks.length > 0 && (
          <section className="book-discovery-section">
            <h3>Popular Books</h3>
            <div className="books-grid">
              {popularBooks.slice(0, 4).map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          </section>
        )}

      {searchMode === "keyword" &&
        !searchTerm.trim() &&
        user &&
        recommendedBooks.length > 0 && (
          <section className="book-discovery-section">
            <h3>Recommended for You</h3>
            <p className="search-help">
              Suggestions based on your borrowing history when available.
            </p>
            <div className="books-grid">
              {recommendedBooks.slice(0, 4).map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>
          </section>
        )}

      <section className="book-discovery-section">
        <h3>
          {searchMode === "semantic"
            ? "Semantic Search Results"
            : searchTerm.trim()
              ? "Search Results"
              : "All Books"}
        </h3>

        {searchMode === "semantic" && semanticLoading ? (
          <p className="books-empty">
            Searching for books with a similar meaning...
          </p>
        ) : filteredBooks.length === 0 ? (
          <p className="books-empty">
            {searchMode === "semantic" && semanticResults === null
              ? "Enter a phrase and select Search by meaning."
              : "No books match your search."}
          </p>
        ) : (
          <>
            <div className="books-grid">
              {currentBooks.map((book) => (
                <BookCard key={book._id} book={book} />
              ))}
            </div>

            {totalPages > 1 && (
              <nav className="pagination" aria-label="Book pages">
                <button
                  type="button"
                  className="pagination-button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  disabled={currentPage === 1}
                  aria-label="Previous page"
                >
                  &larr; Previous
                </button>

                <span className="pagination-info" aria-live="polite">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  className="pagination-button"
                  onClick={() =>
                    setCurrentPage((page) =>
                      Math.min(page + 1, totalPages)
                    )
                  }
                  disabled={currentPage === totalPages}
                  aria-label="Next page"
                >
                  Next &rarr;
                </button>
              </nav>
            )}
          </>
        )}
      </section>
    </div>
  );
};

export default BooksPage;
