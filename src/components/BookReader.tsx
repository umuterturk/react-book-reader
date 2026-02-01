import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { useSwipeable } from 'react-swipeable';
import './BookReader.css';

interface PageBounds {
  start: number;
  end: number;
}

import { Bookmark } from '../types';

export interface BookReaderProps {
  /** Unique identifier for the book - used for storing reading position */
  id: string;
  /** The full text content of the book */
  text: string;
  /** Book title - displayed on cover page and as running header */
  title?: string;
  /** Author name - displayed on cover page */
  author?: string;
  /** Custom content region padding (percentage-based) */
  contentRegion?: Partial<ContentRegion>;
  /** Current bookmarks for this book */
  bookmarks?: Bookmark[];
  /** Callback when user adds a bookmark at current position */
  onAddBookmark?: (position: number, label: string) => void;
  /** Callback when user removes a bookmark */
  onRemoveBookmark?: (bookmarkId: string) => void;
  /** Callback when user updates a bookmark label */
  onUpdateBookmark?: (bookmarkId: string, newLabel: string) => void;
  /** Callback when controls visibility changes (for show/hide close button) */
  onControlsVisibilityChange?: (visible: boolean) => void;
  /** Current theme */
  theme?: 'light' | 'dark';
  /** Callback to toggle theme */
  onToggleTheme?: () => void;
}

const STORAGE_KEY_PREFIX = 'book-reader-pos-';

const waitForResources = (): Promise<void> => {
  return new Promise((resolve) => {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve());
        });
      });
    } else {
      setTimeout(resolve, 500);
    }
  });
};

export interface ContentRegion {
  /** Top padding as percentage of viewport height */
  top: number;
  /** Bottom padding as percentage of viewport height */
  bottom: number;
  /** Left padding as percentage of page width */
  left: number;
  /** Right padding as percentage of page width */
  right: number;
}

const DEFAULT_REGION: ContentRegion = {
  top: 8,
  bottom: 6,
  left: 5,
  right: 5,
};

export const BookReader: React.FC<BookReaderProps> = ({
  id,
  text,
  title,
  author,
  contentRegion,
  bookmarks = [],
  onAddBookmark,
  onRemoveBookmark,
  onUpdateBookmark,
  onControlsVisibilityChange,
  theme = 'light',
  onToggleTheme,
}) => {

  // Bookmark editing state
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingBookmarkLabel, setEditingBookmarkLabel] = useState('');

  // Tokenize text into words
  const words = useMemo(() => {
    if (!text) return [];
    return text.match(/\S+\s*/g) || [];
  }, [text]);

  // State
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pages, setPages] = useState<PageBounds[]>([]); // All pre-computed page bounds
  const [isResourcesReady, setIsResourcesReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isPaginating, setIsPaginating] = useState(false); // Show during pagination
  const [isAnimating, setIsAnimating] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0);
  const [isEditingPage, setIsEditingPage] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');
  const [isBookmarksVisible, setIsBookmarksVisible] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const hasCover = Boolean(title || author);

  // Helper: jump to a specific word index
  const goToWordIndex = useCallback((wordIndex: number) => {
    const allPages = pagesRef.current;
    if (allPages.length === 0) return;

    let targetPage = 1;
    for (let i = 0; i < allPages.length; i++) {
      if (wordIndex >= allPages[i].start && wordIndex < allPages[i].end) {
        targetPage = hasCover ? i + 2 : i + 1;
        break;
      }
    }
    setCurrentPage(targetPage);
    // Persist position
    try {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${id}`, String(wordIndex));
    } catch (e) { }
    setIsBookmarksVisible(false);
  }, [id, hasCover]);

  // Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const pageStackRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const pagesRef = useRef<PageBounds[]>([]);
  const lastTapRef = useRef<number>(0);
  const lastZoneRef = useRef<'left' | 'right' | null>(null);

  const fullStorageKey = `${STORAGE_KEY_PREFIX}${id}`;

  // Resolve content region
  const region = useMemo<ContentRegion>(() => {
    const merged: ContentRegion = {
      top: contentRegion?.top ?? DEFAULT_REGION.top,
      bottom: contentRegion?.bottom ?? DEFAULT_REGION.bottom,
      left: contentRegion?.left ?? DEFAULT_REGION.left,
      right: contentRegion?.right ?? DEFAULT_REGION.right,
    };
    const clamp01 = (v: number) => Math.min(100, Math.max(0, v));
    merged.top = clamp01(merged.top);
    merged.bottom = clamp01(merged.bottom);
    merged.left = clamp01(merged.left);
    merged.right = clamp01(merged.right);
    if (merged.top + merged.bottom >= 95) {
      const reduce = (merged.top + merged.bottom - 90) / 2;
      merged.top = clamp01(merged.top - reduce);
      merged.bottom = clamp01(merged.bottom - reduce);
    }
    if (merged.left + merged.right >= 95) {
      const reduce = (merged.left + merged.right - 90) / 2;
      merged.left = clamp01(merged.left - reduce);
      merged.right = clamp01(merged.right - reduce);
    }
    return merged;
  }, [contentRegion]);

  // Pre-compute ALL pages using the actual content element
  const computeAllPages = useCallback((): PageBounds[] => {
    const content = contentRef.current;
    if (!content || words.length === 0) return [];

    // Content element has fixed height from flexbox - use it directly
    const availableHeight = content.clientHeight;

    if (availableHeight <= 0) return [];

    const allPages: PageBounds[] = [];
    let startIndex = 0;

    // Helper: check if content fits
    const fits = (start: number, end: number): boolean => {
      if (start >= end) return true;
      content.textContent = words.slice(start, end).join('');
      return content.scrollHeight <= availableHeight;
    };

    // Compute each page using binary search
    while (startIndex < words.length) {
      let low = startIndex + 1;
      let high = words.length;
      let bestEnd = startIndex + 1;

      // Quick check: can all remaining words fit?
      if (fits(startIndex, words.length)) {
        allPages.push({ start: startIndex, end: words.length });
        break;
      }

      // Binary search for max words that fit
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (fits(startIndex, mid)) {
          bestEnd = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (bestEnd <= startIndex) {
        bestEnd = startIndex + 1;
      }

      allPages.push({ start: startIndex, end: bestEnd });
      startIndex = bestEnd;
    }

    // Clear content after measurement
    content.textContent = '';

    return allPages;
  }, [words]);

  // Get bounds for a page (1-indexed, page 1 is cover if hasCover)
  const getPageBounds = useCallback((pageNum: number): PageBounds => {
    if (hasCover) {
      if (pageNum === 1) return { start: 0, end: 0 }; // Cover
      const idx = pageNum - 2; // Offset by 2 (1 for 1-index, 1 for cover)
      return pages[idx] ?? { start: 0, end: 0 };
    } else {
      const idx = pageNum - 1;
      return pages[idx] ?? { start: 0, end: 0 };
    }
  }, [pages, hasCover]);

  // Total page count
  const totalPages = hasCover ? pages.length + 1 : pages.length;

  // Current bounds
  const currentBounds = getPageBounds(currentPage);

  const currentBookmark = useMemo(() => {
    return bookmarks.find(b => b.position >= currentBounds.start && b.position < currentBounds.end);
  }, [bookmarks, currentBounds]);

  // Navigate to page with full slide animation (like swipe)
  const goToPage = useCallback((targetPage: number, skipAnimation = false) => {
    const clamped = Math.max(1, Math.min(targetPage, totalPages));
    if (clamped === currentPage) return;
    if (!skipAnimation && isAnimating) return;

    const container = containerRef.current;
    const performUpdate = () => {
      setCurrentPage(clamped);
      const bounds = getPageBounds(clamped);
      try {
        localStorage.setItem(fullStorageKey, String(bounds.start));
      } catch (e) { }
    };

    if (skipAnimation || !container) {
      performUpdate();
    } else {
      // Use full slide animation like swipe
      const pageWidth = container.clientWidth;
      const parentWidth = pageStackRef.current?.clientWidth ?? pageWidth;
      const direction = clamped > currentPage ? -1 : 1; // -1 = left (next), 1 = right (prev)

      // On desktop, page is centered with margin: 0 auto, so we need more distance
      // to fully exit the viewport. Calculate: (parentWidth + pageWidth) / 2 + gap
      const isCentered = pageWidth < parentWidth;
      const animationOffset = isCentered
        ? (parentWidth + pageWidth) / 2 + 16
        : pageWidth + 16;

      // First, enable transition and set direction
      setSlideDirection(direction > 0 ? 'right' : 'left');
      setIsAnimating(true);

      // Then, on next frame, change position (so transition is already active)
      requestAnimationFrame(() => {
        const finalOffset = direction * animationOffset;
        setDragOffset(finalOffset);
      });

      setTimeout(() => {
        performUpdate();
        setDragOffset(0);
        setSlideDirection(null);
        setIsAnimating(false);
      }, 220);
    }
  }, [currentPage, totalPages, isAnimating, getPageBounds, fullStorageKey]);

  // Go to next/prev
  const goToNextPage = useCallback((skipAnimation = false) => {
    goToPage(currentPage + 1, skipAnimation);
  }, [currentPage, goToPage]);

  const goToPrevPage = useCallback((skipAnimation = false) => {
    goToPage(currentPage - 1, skipAnimation);
  }, [currentPage, goToPage]);

  // Swipe handlers
  const swipeHandlers = useSwipeable({
    onSwiping: (eventData) => {
      if (isAnimating) return;
      const deltaX = eventData.deltaX;

      // At first page, allow slight resistance drag but cap it
      if (deltaX > 0 && currentPage <= 1) {
        // Rubber band effect - diminishing returns
        setDragOffset(Math.min(deltaX * 0.3, 50));
        return;
      }
      // At last page, allow slight resistance drag but cap it
      if (deltaX < 0 && currentPage >= totalPages) {
        // Rubber band effect - diminishing returns
        setDragOffset(Math.max(deltaX * 0.3, -50));
        return;
      }
      setDragOffset(deltaX);
    },
    onSwiped: (eventData) => {
      if (isAnimating) return;
      const container = containerRef.current;
      if (!container) {
        setDragOffset(0);
        return;
      }

      const direction = eventData.deltaX > 0 ? 1 : -1; // 1 = right (prev), -1 = left (next)

      // Check if we're at boundaries - snap back with animation
      const tryingPrevOnFirst = direction > 0 && currentPage <= 1;
      const tryingNextOnLast = direction < 0 && currentPage >= totalPages;

      if (tryingPrevOnFirst || tryingNextOnLast) {
        // Snap back to center with animation
        setIsAnimating(true);
        setDragOffset(0);
        setTimeout(() => {
          setIsAnimating(false);
        }, 220);
        return;
      }

      const threshold = container.clientWidth * 0.2;
      const absDeltaX = Math.abs(eventData.deltaX);
      const pageWidth = container.clientWidth;
      const parentWidth = pageStackRef.current?.clientWidth ?? pageWidth;

      // On desktop, page is centered with margin: 0 auto, so we need more distance
      const isCentered = pageWidth < parentWidth;
      const animationOffset = isCentered
        ? (parentWidth + pageWidth) / 2 + 16
        : pageWidth + 16;

      if (absDeltaX >= threshold) {
        setIsAnimating(true);
        setSlideDirection(direction > 0 ? 'right' : 'left');
        const finalOffset = direction * animationOffset;
        setDragOffset(finalOffset);

        setTimeout(() => {
          const newPage = direction > 0 ? currentPage - 1 : currentPage + 1;
          setCurrentPage(Math.max(1, Math.min(newPage, totalPages)));
          const bounds = getPageBounds(newPage);
          try {
            localStorage.setItem(fullStorageKey, String(bounds.start));
          } catch (e) { }
          setDragOffset(0);
          setSlideDirection(null);
          setIsAnimating(false);
        }, 220);
      } else {
        // Didn't swipe far enough, snap back
        setIsAnimating(true);
        setSlideDirection(eventData.deltaX > 0 ? 'right' : 'left');
        setDragOffset(0);
        setTimeout(() => {
          setSlideDirection(null);
          setIsAnimating(false);
        }, 220);
      }
    },
    onTap: () => setDragOffset(0),
    trackMouse: true,
    trackTouch: true,
    delta: 10,
    preventScrollOnSwipe: true,
  });

  // Tap zone handlers
  const handleTapZone = useCallback(
    (e: React.MouseEvent | React.TouchEvent, zone: 'left' | 'right') => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      const DOUBLE_TAP_DELAY = 300;

      if (lastZoneRef.current === zone && now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        if (zone === 'left') goToPrevPage();
        else goToNextPage();
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
        lastZoneRef.current = zone;
      }
    },
    [goToPrevPage, goToNextPage]
  );

  // Center tap handler - toggle controls visibility with auto-hide
  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hideControls = useCallback(() => {
    setShowControls(false);
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
      autoHideTimerRef.current = null;
    }
  }, []);

  const showControlsWithAutoHide = useCallback(() => {
    setShowControls(true);
    // Clear any existing auto-hide timer
    if (autoHideTimerRef.current) {
      clearTimeout(autoHideTimerRef.current);
    }
    // Auto-hide after 3 seconds
    autoHideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const handleCenterTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Clear any pending show timer
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }

    if (showControls) {
      // Hide immediately
      hideControls();
    } else {
      // Show immediately and start auto-hide timer
      showControlsWithAutoHide();
    }
  }, [showControls, hideControls, showControlsWithAutoHide]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      if (autoHideTimerRef.current) {
        clearTimeout(autoHideTimerRef.current);
      }
    };
  }, []);

  // Notify parent when controls visibility changes
  useEffect(() => {
    onControlsVisibilityChange?.(showControls);
  }, [showControls, onControlsVisibilityChange]);

  // Page number editing handlers
  const handlePageNumberClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPageInputValue(String(currentPage));
    setIsEditingPage(true);
    // Focus input after render
    setTimeout(() => pageInputRef.current?.select(), 0);
  }, [currentPage]);

  const handlePageInputSubmit = useCallback(() => {
    const parsed = parseInt(pageInputValue, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
      goToPage(parsed, true); // Skip animation for direct navigation
    }
    setIsEditingPage(false);
    setPageInputValue('');
  }, [pageInputValue, totalPages, goToPage]);

  const handlePageInputKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handlePageInputSubmit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingPage(false);
      setPageInputValue('');
    }
  }, [handlePageInputSubmit]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isAnimating || isEditingPage) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        goToPrevPage();
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        goToNextPage();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnimating, isEditingPage, goToPrevPage, goToNextPage]);

  // Wait for fonts
  useEffect(() => {
    let cancelled = false;
    waitForResources().then(() => {
      if (!cancelled) setIsResourcesReady(true);
    });
    return () => { cancelled = true; };
  }, []);

  // Initial pagination
  useEffect(() => {
    if (!isResourcesReady || !containerRef.current || !contentRef.current) return;
    if (words.length === 0) {
      setPages([]);
      setCurrentPage(1);
      setIsReady(true);
      return;
    }

    let rafId: number;
    let timerId: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const tryPaginate = () => {
      attempts++;
      const content = contentRef.current;
      // Wait for content element to have layout (flexbox gives it fixed height)
      if (!content || content.clientHeight === 0) {
        if (attempts < 20) {
          timerId = setTimeout(() => {
            rafId = requestAnimationFrame(tryPaginate);
          }, 50);
        }
        return;
      }

      setIsPaginating(true);

      // Use requestAnimationFrame to allow UI to update
      requestAnimationFrame(() => {
        const allPages = computeAllPages();
        setPages(allPages);

        // Restore position from localStorage
        let targetWordIndex = 0;
        try {
          const stored = localStorage.getItem(fullStorageKey);
          if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed >= 0) {
              targetWordIndex = parsed;
            }
          }
        } catch (e) { }

        // Find page for word index
        let targetPage = 1;
        if (targetWordIndex > 0 && allPages.length > 0) {
          for (let i = 0; i < allPages.length; i++) {
            if (targetWordIndex >= allPages[i].start && targetWordIndex < allPages[i].end) {
              targetPage = hasCover ? i + 2 : i + 1;
              break;
            }
          }
        }

        setCurrentPage(targetPage);
        setIsPaginating(false);
        setIsReady(true);
      });
    };

    rafId = requestAnimationFrame(tryPaginate);
    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(timerId);
    };
  }, [isResourcesReady, words.length, fullStorageKey, computeAllPages, hasCover]);

  // Keep pages ref in sync for use in resize handler
  useEffect(() => {
    pagesRef.current = pages;
  }, [pages]);

  // Handle resize - recompute all pages
  const lastDimensionsRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isResourcesReady || !isReady) return;

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const newWidth = container.clientWidth;
        const newHeight = container.clientHeight;
        const last = lastDimensionsRef.current;

        if (last && Math.abs(last.width - newWidth) < 1 && Math.abs(last.height - newHeight) < 1) {
          return;
        }

        lastDimensionsRef.current = { width: newWidth, height: newHeight };

        // Save current word position
        const wordIndex = currentBounds.start;

        setIsPaginating(true);
        requestAnimationFrame(() => {
          const allPages = computeAllPages();

          // If computeAllPages returns empty but we had valid pages,
          // skip this resize - viewport is likely in a transient state
          // (common on mobile when browser reopens with address bar animating)
          if (allPages.length === 0 && pagesRef.current.length > 0) {
            setIsPaginating(false);
            return;
          }

          setPages(allPages);

          // Find new page for word index
          let targetPage = 1;
          if (wordIndex > 0 && allPages.length > 0) {
            for (let i = 0; i < allPages.length; i++) {
              if (wordIndex >= allPages[i].start && wordIndex < allPages[i].end) {
                targetPage = hasCover ? i + 2 : i + 1;
                break;
              }
            }
          }

          setCurrentPage(targetPage);
          setIsPaginating(false);
        });
      }, 100);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }

    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, [isReady, isResourcesReady, currentBounds.start, computeAllPages, hasCover]);

  // Get page text
  const pageText = useMemo(() => {
    if (!isReady || isPaginating) return '';
    if (hasCover && currentPage === 1) return '';
    return words.slice(currentBounds.start, currentBounds.end).join('');
  }, [words, currentBounds, isReady, isPaginating, hasCover, currentPage]);

  const canGoNext = currentPage < totalPages;
  const canGoPrev = currentPage > 1;
  const isCoverPage = hasCover && currentPage === 1;

  const regionStyle = useMemo(() => ({
    paddingTop: `${region.top}vh`,
    paddingBottom: `${region.bottom}vh`,
    paddingLeft: `${region.left}%`,
    paddingRight: `${region.right}%`,
  }), [region]);

  const dragTransform = useMemo(() => ({
    transform: `translateX(${dragOffset}px)`,
    transition: isAnimating ? 'transform 220ms ease' : 'none',
  }), [dragOffset, isAnimating]);

  const followerStyle = useMemo(() => {
    if (dragOffset === 0 && !isAnimating) return { display: 'none' };

    const pageWidth = containerRef.current?.clientWidth ?? 0;
    const parentWidth = pageStackRef.current?.clientWidth ?? pageWidth;
    const gap = 16;

    // Calculate the base offset for follower positioning
    // On desktop, when page is centered, use the full animation distance
    const isCentered = pageWidth < parentWidth;
    const baseOffset = isCentered
      ? (parentWidth + pageWidth) / 2 + gap
      : pageWidth + gap;

    const isLeft = dragOffset > 0 || slideDirection === 'right';
    // Follower starts at -baseOffset (for left) or +baseOffset (for right) from center
    // then moves with dragOffset
    const transform = isLeft
      ? `translateX(${-baseOffset + dragOffset}px)`
      : `translateX(${baseOffset + dragOffset}px)`;
    return {
      ...regionStyle,
      transform,
      transition: isAnimating ? 'transform 220ms ease' : 'none',
    };
  }, [dragOffset, isAnimating, slideDirection, regionStyle]);

  const followerPageNum = useMemo(() => {
    const effectiveOffset = dragOffset !== 0 ? dragOffset : (slideDirection === 'right' ? 1 : (slideDirection === 'left' ? -1 : 0));
    return effectiveOffset > 0 ? currentPage - 1 : currentPage + 1;
  }, [dragOffset, slideDirection, currentPage]);

  const followerIsCover = hasCover && followerPageNum === 1;

  const followerText = useMemo(() => {
    if (!isReady || isPaginating) return '';
    const effectiveOffset = dragOffset !== 0 ? dragOffset : (slideDirection === 'right' ? 1 : (slideDirection === 'left' ? -1 : 0));
    if (effectiveOffset === 0) return '';

    // Cover page has no text content
    if (followerIsCover) return '';

    if (effectiveOffset > 0 && canGoPrev) {
      const bounds = getPageBounds(currentPage - 1);
      return words.slice(bounds.start, bounds.end).join('');
    }
    if (effectiveOffset < 0 && canGoNext) {
      const bounds = getPageBounds(currentPage + 1);
      return words.slice(bounds.start, bounds.end).join('');
    }
    return '';
  }, [isReady, isPaginating, dragOffset, slideDirection, canGoPrev, canGoNext, currentPage, getPageBounds, words, followerIsCover]);

  // Determine if follower should be shown (has content OR is cover page)
  const showFollower = useMemo(() => {
    if (dragOffset === 0 && !isAnimating) return false;
    const effectiveOffset = dragOffset !== 0 ? dragOffset : (slideDirection === 'right' ? 1 : (slideDirection === 'left' ? -1 : 0));
    if (effectiveOffset === 0) return false;
    if (effectiveOffset > 0 && !canGoPrev) return false;
    if (effectiveOffset < 0 && !canGoNext) return false;
    return true;
  }, [dragOffset, isAnimating, slideDirection, canGoPrev, canGoNext]);

  return (
    <div className="book-reader" {...swipeHandlers}>
      {/* Page stack */}
      <div ref={pageStackRef} className="book-reader__page-stack">
        {/* Follower page */}
        {showFollower && (
          <div
            className={`book-reader__page-follower ${(dragOffset > 0 || slideDirection === 'right') ? 'book-reader__page-follower--left' : 'book-reader__page-follower--right'
              }`}
            style={followerStyle}
          >
            {!followerIsCover && title && <span className="book-reader__header">{title}</span>}
            {followerIsCover ? (
              <div className="book-reader__cover">
                {title && <h1 className="book-reader__cover-title">{title}</h1>}
                {author && <p className="book-reader__cover-author">by {author}</p>}
              </div>
            ) : (
              <div className="book-reader__content book-reader__content--preview">{followerText}</div>
            )}
            <span className="book-reader__page-number">{followerPageNum} / {totalPages}</span>
          </div>
        )}

        {/* Main page */}
        <div
          ref={containerRef}
          className="book-reader__page"
          style={{ ...regionStyle, ...dragTransform }}
        >
          {!isCoverPage && title && (
            <span className="book-reader__header">{title}</span>
          )}



          {/* Content element - ALWAYS rendered for measurement, fills flex space */}
          <div
            ref={contentRef}
            className="book-reader__content"
            style={{
              visibility: (isPaginating || isCoverPage || !isReady) ? 'hidden' : 'visible',
            }}
          >
            {pageText}
          </div>



          {/* Overlay states - positioned absolutely over the content area */}
          {!isResourcesReady && (
            <div className="book-reader__loading" style={{ position: 'absolute', inset: 0 }}>
              Loading fonts...
            </div>
          )}
          {isResourcesReady && isPaginating && (
            <div className="book-reader__loading" style={{ position: 'absolute', inset: 0 }}>
              Calculating pages...
            </div>
          )}
          {isResourcesReady && !isPaginating && isCoverPage && (
            <div className="book-reader__cover" style={{ position: 'absolute', inset: 0 }}>
              {title && <h1 className="book-reader__cover-title">{title}</h1>}
              {author && <p className="book-reader__cover-author">by {author}</p>}
            </div>
          )}
          {isResourcesReady && !isPaginating && !isCoverPage && !isReady && (
            <div className="book-reader__loading" style={{ position: 'absolute', inset: 0 }}>
              Preparing pages...
            </div>
          )}

          {/* Page number with total - clickable to edit */}
          {isEditingPage ? (
            <span className="book-reader__page-number book-reader__page-number--editing">
              <input
                ref={pageInputRef}
                type="number"
                min={1}
                max={totalPages}
                value={pageInputValue}
                onChange={(e) => setPageInputValue(e.target.value)}
                onBlur={handlePageInputSubmit}
                onKeyDown={handlePageInputKeyDown}
                className="book-reader__page-input"
              />
              <span className="book-reader__page-total"> / {totalPages || '?'}</span>
            </span>
          ) : (
            <span
              className="book-reader__page-number book-reader__page-number--clickable"
              onClick={handlePageNumberClick}
              title="Click to go to page"
            >
              {currentPage} / {totalPages || '?'}
            </span>
          )}
        </div>
      </div>

      {/* Bookmark toggle - positioned at bottom right, outside page for z-index */}
      {!isCoverPage && isReady && !isPaginating && showControls && (
        <button
          className={`book-reader__bookmark-toggle ${currentBookmark ? 'is-active' : ''}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (currentBookmark) {
              onRemoveBookmark?.(currentBookmark.id);
            } else {
              const percentage = words.length > 0
                ? ((currentBounds.start / words.length) * 100).toFixed(2)
                : '0.00';
              onAddBookmark?.(currentBounds.start, `${percentage}%`);
            }
          }}
          title={currentBookmark ? 'Remove bookmark' : 'Add bookmark'}
        >
          <svg viewBox="0 0 24 24" fill={currentBookmark ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Tap zones */}
      <div
        className={`book-reader__tap-zone book-reader__tap-zone--left ${!canGoPrev ? 'book-reader__tap-zone--disabled' : ''}`}
        onClick={(e) => handleTapZone(e, 'left')}
        onTouchEnd={(e) => handleTapZone(e, 'left')}
        aria-label="Previous page"
      />
      <div
        className="book-reader__tap-zone book-reader__tap-zone--center"
        onClick={handleCenterTap}
        onTouchEnd={handleCenterTap}
        aria-label="Toggle controls"
      />
      <div
        className={`book-reader__tap-zone book-reader__tap-zone--right ${!canGoNext ? 'book-reader__tap-zone--disabled' : ''}`}
        onClick={(e) => handleTapZone(e, 'right')}
        onTouchEnd={(e) => handleTapZone(e, 'right')}
        aria-label="Next page"
      />

      {/* Navigation buttons */}
      <button
        className={`book-reader__nav-btn book-reader__nav-btn--left ${!canGoPrev ? 'book-reader__nav-btn--disabled' : ''} ${showControls ? 'is-visible' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          goToPrevPage();
          showControlsWithAutoHide();
        }}
        disabled={!canGoPrev || isAnimating}
        aria-label="Previous page"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        className={`book-reader__nav-btn book-reader__nav-btn--right ${!canGoNext ? 'book-reader__nav-btn--disabled' : ''} ${showControls ? 'is-visible' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          goToNextPage();
          showControlsWithAutoHide();
        }}
        disabled={!canGoNext || isAnimating}
        aria-label="Next page"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {/* Floating navigation and control */}
      <div className={`book-reader__floating-nav ${showControls ? 'is-visible' : ''}`}>
        <button
          className="book-reader__control-btn"
          onClick={() => {
            setIsBookmarksVisible(true);
            setShowControls(false); // Hide controls when opening bookmarks
          }}
          title="Show bookmarks"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Bookmarks Panel Backdrop */}
      <div
        className={`book-reader__bookmarks-backdrop ${isBookmarksVisible ? 'is-visible' : ''}`}
        onClick={() => setIsBookmarksVisible(false)}
      />

      {/* Bookmarks Panel */}
      <div className={`book-reader__bookmarks-panel ${isBookmarksVisible ? 'is-visible' : ''}`}>
        <div className="book-reader__bookmarks-header">
          <h2>Bookmarks</h2>
          <div className="book-reader__header-actions">
            {onToggleTheme && (
              <button className="book-reader__theme-toggle" onClick={onToggleTheme} title="Toggle Theme">
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
            )}
            <button className="book-reader__bookmarks-close" onClick={() => setIsBookmarksVisible(false)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="book-reader__bookmarks-list">
          {bookmarks.length === 0 ? (
            <div className="book-reader__loading">No bookmarks yet</div>
          ) : (
            bookmarks.map(bookmark => (
              <div key={bookmark.id} className="book-reader__bookmark-item" onClick={() => goToWordIndex(bookmark.position)}>
                <div className="book-reader__bookmark-info">
                  {editingBookmarkId === bookmark.id ? (
                    <input
                      type="text"
                      className="book-reader__bookmark-input"
                      value={editingBookmarkLabel}
                      onChange={(e) => setEditingBookmarkLabel(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          onUpdateBookmark?.(bookmark.id, editingBookmarkLabel);
                          setEditingBookmarkId(null);
                        } else if (e.key === 'Escape') {
                          setEditingBookmarkId(null);
                        }
                      }}
                      onBlur={() => {
                        onUpdateBookmark?.(bookmark.id, editingBookmarkLabel);
                        setEditingBookmarkId(null);
                      }}
                      autoFocus
                    />
                  ) : (
                    <span className="book-reader__bookmark-label">{bookmark.label}</span>
                  )}
                  <span className="book-reader__bookmark-date">{new Date(bookmark.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="book-reader__bookmark-actions">
                  <button
                    className="book-reader__bookmark-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingBookmarkId(bookmark.id);
                      setEditingBookmarkLabel(bookmark.label);
                    }}
                    title="Edit bookmark"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className="book-reader__bookmark-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveBookmark?.(bookmark.id);
                    }}
                    title="Delete bookmark"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default BookReader;
