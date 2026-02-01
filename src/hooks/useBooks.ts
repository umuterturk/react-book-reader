import { useState, useEffect } from 'react';
import { Book } from '../types';

const STORAGE_KEY = 'book-reader-library';

export function useBooks() {
    const [books, setBooks] = useState<Book[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                setBooks(JSON.parse(saved));
            } catch (e) {
                console.error('Failed to load books from localStorage', e);
            }
        } else {
            // First time use, add a sample book
            import('../../book').then((module) => {
                const sampleBook: Book = {
                    id: 'sample-adventure',
                    title: 'The Adventure of the Missing Letter',
                    author: 'A. N. Storyteller',
                    text: module.default,
                    createdAt: Date.now(),
                };
                saveBooks([sampleBook]);
            });
        }
    }, []);

    const saveBooks = (newBooks: Book[]) => {
        setBooks(newBooks);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newBooks));
    };

    const addBook = (book: Omit<Book, 'id' | 'createdAt'>) => {
        const newBook: Book = {
            ...book,
            id: crypto.randomUUID(),
            createdAt: Date.now(),
        };
        saveBooks([newBook, ...books]);
        return newBook;
    };

    const removeBook = (id: string) => {
        saveBooks(books.filter((b: Book) => b.id !== id));
    };

    const updateBook = (id: string, updates: Partial<Book>) => {
        saveBooks(books.map((b: Book) => (b.id === id ? { ...b, ...updates } : b)));
    };

    const addBookmark = (bookId: string, position: number, label: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book) return;
        const newBookmark = {
            id: crypto.randomUUID(),
            position,
            label,
            createdAt: Date.now(),
        };
        const updatedBookmarks = [...(book.bookmarks || []), newBookmark];
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    const removeBookmark = (bookId: string, bookmarkId: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book || !book.bookmarks) return;
        const updatedBookmarks = book.bookmarks.filter((b) => b.id !== bookmarkId);
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    const updateBookmark = (bookId: string, bookmarkId: string, newLabel: string) => {
        const book = books.find((b: Book) => b.id === bookId);
        if (!book || !book.bookmarks) return;
        const updatedBookmarks = book.bookmarks.map((b) =>
            b.id === bookmarkId ? { ...b, label: newLabel } : b
        );
        updateBook(bookId, { bookmarks: updatedBookmarks });
    };

    return { books, addBook, removeBook, updateBook, addBookmark, removeBookmark, updateBookmark };
}
