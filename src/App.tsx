import React, { useState } from 'react';
import { BookReader } from './components/BookReader';
import { ConfirmModal } from './components/ConfirmModal';
import { useBooks } from './hooks/useBooks';
import { Book } from './types';
import { useTheme } from './hooks/useTheme';
import './App.css';

type View = 'library' | 'editor' | 'reader' | 'edit';

function App() {
  const { theme, toggleTheme } = useTheme();
  const { books, addBook, removeBook, updateBook, addBookmark, removeBookmark, updateBookmark } = useBooks();
  const [currentView, setCurrentView] = useState<View>('library');
  const [activeBookId, setActiveBookId] = useState<string | null>(null);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [readerControlsVisible, setReaderControlsVisible] = useState(false);

  const activeBook = books.find(b => b.id === activeBookId);

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    author: '',
    text: '',
  });

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.text) return;

    if (currentView === 'edit') {
      setIsSaveModalOpen(true);
    } else {
      executeSave();
    }
  };

  const executeSave = () => {
    if (currentView === 'edit' && editingBookId) {
      updateBook(editingBookId, formData);
    } else {
      addBook(formData);
    }

    setFormData({ title: '', author: '', text: '' });
    setEditingBookId(null);
    setIsSaveModalOpen(false);
    setCurrentView('library');
  };

  const handleDeleteBook = () => {
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (editingBookId) {
      removeBook(editingBookId);
      setEditingBookId(null);
      setFormData({ title: '', author: '', text: '' });
      setCurrentView('library');
      setIsDeleteModalOpen(false);
    }
  };

  const openBook = (book: Book) => {
    setActiveBookId(book.id);
    setCurrentView('reader');
  };

  const closeReader = () => {
    setCurrentView('library');
    setActiveBookId(null);
  };

  const navToEditor = () => {
    setEditingBookId(null);
    setFormData({ title: '', author: '', text: '' });
    setCurrentView('editor');
  };

  const navToEdit = (e: React.MouseEvent, book: Book) => {
    e.stopPropagation();
    setEditingBookId(book.id);
    setFormData({
      title: book.title,
      author: book.author || '',
      text: book.text,
    });
    setCurrentView('edit');
  };

  const navToLibrary = () => {
    setCurrentView('library');
    setEditingBookId(null);
    setFormData({ title: '', author: '', text: '' });
  };

  return (
    <div className="app">
      {currentView !== 'reader' && (
        <header className="showcase-header">
          <div className="logo" onClick={() => setCurrentView('library')} style={{ cursor: 'pointer' }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 19.5C4 18.1193 5.11929 17 6.5 17H20" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M6.5 2H20V22H6.5C5.11929 22 4 20.8807 4 19.5V4.5C4 3.11929 5.11929 2 6.5 2Z" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Readnice
          </div>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={toggleTheme} title="Toggle Theme">
              {theme === 'dark' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
            {currentView === 'library' ? (
              <button className="btn btn-primary" onClick={navToEditor}>
                New Book
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={navToLibrary}>
                Back to Library
              </button>
            )}
          </div>
        </header>
      )}

      <main className="main-content">
        {currentView === 'library' && (
          <div className="library-view">
            {books.length === 0 ? (
              <div className="empty-state">
                <h2>No books yet</h2>
                <p>Start your collection by creating your first digital book.</p>
                <button className="btn btn-primary" onClick={navToEditor}>
                  Create My First Book
                </button>
              </div>
            ) : (
              <div className="library-grid">
                {books.map((book) => (
                  <div key={book.id} className="book-card" onClick={() => openBook(book)}>
                    <div>
                      <h3>{book.title}</h3>
                      <p className="author">by {book.author || 'Anonymous'}</p>
                    </div>
                    <div className="meta">
                      <span>{new Date(book.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                      <button
                        className="edit-btn"
                        onClick={(e) => navToEdit(e, book)}
                        title="Edit book"
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(currentView === 'editor' || currentView === 'edit') && (
          <div className="editor-view">
            <div className="editor-container">
              <h2 className="editor-title">{currentView === 'edit' ? 'Edit Book' : 'New Book'}</h2>
              <form onSubmit={handleSaveBook}>
                <div className="form-group">
                  <label>Book Title</label>
                  <input
                    type="text"
                    placeholder="Enter title..."
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Author</label>
                  <input
                    type="text"
                    placeholder="Enter author name..."
                    value={formData.author}
                    onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Content</label>
                  <textarea
                    placeholder="Paste your story here..."
                    required
                    value={formData.text}
                    onChange={(e) => setFormData({ ...formData, text: e.target.value })}
                  />
                </div>
                <div className="editor-actions">
                  <div className="left-actions">
                    {currentView === 'edit' && (
                      <button type="button" className="btn btn-danger" onClick={handleDeleteBook}>
                        Delete Book
                      </button>
                    )}
                  </div>
                  <div className="right-actions">
                    <button type="button" className="btn btn-secondary" onClick={navToLibrary}>
                      Cancel
                    </button>
                    <button type="submit" className="btn btn-primary">
                      {currentView === 'edit' ? 'Save Changes' : 'Create Book'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {currentView !== 'reader' && (
        <footer className="showcase-footer">
          <div className="footer-content">
            <p className="copyright">© {new Date().getFullYear()} Readnice. <span>Crafted with passion.</span></p>
            <div className="footer-links">
              <div className="promotion">
                <span>Curated by</span>
                <a href="https://github.com/umuterturk" target="_blank" rel="noopener noreferrer" className="promoted-user">
                  Umut Erturk
                </a>
              </div>
              <span className="divider">/</span>
              <a href="https://buymeacoffee.com/codeonbrew" target="_blank" rel="noopener noreferrer" className="coffee-link">
                ☕ Buy Coffee
              </a>
            </div>
          </div>
        </footer>
      )}

      {currentView === 'reader' && activeBook && (
        <div className="reader-wrapper">
          <button className={`reader-close-btn ${readerControlsVisible ? 'is-visible' : ''}`} onClick={closeReader}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <BookReader
            id={activeBook.id}
            text={activeBook.text}
            title={activeBook.title}
            author={activeBook.author}
            bookmarks={activeBook.bookmarks || []}
            onAddBookmark={(pos: number, label: string) => addBookmark(activeBook.id, pos, label)}
            onRemoveBookmark={(bookmarkId: string) => removeBookmark(activeBook.id, bookmarkId)}
            onUpdateBookmark={(bookmarkId: string, newLabel: string) => updateBookmark(activeBook.id, bookmarkId, newLabel)}
            onControlsVisibilityChange={setReaderControlsVisible}
            theme={theme}
            onToggleTheme={toggleTheme}
            contentRegion={{ top: 6, bottom: 6, left: 6, right: 6 }}
          />
        </div>
      )}

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Book"
        message={`Are you sure you want to delete "${formData.title}"? This action cannot be undone.`}
        confirmLabel="Delete Forever"
        onConfirm={confirmDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
        isDanger={true}
      />

      <ConfirmModal
        isOpen={isSaveModalOpen}
        title="Save Changes"
        message="Are you sure you want to save the changes made to this book?"
        confirmLabel="Save"
        onConfirm={executeSave}
        onCancel={() => setIsSaveModalOpen(false)}
      />
    </div>
  );
}

export default App;
