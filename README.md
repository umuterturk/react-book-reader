# React Book Reader 📖

A beautiful, mobile-first React component for displaying long-form text with a book-like reading experience.

Demo: https://umuterturk.github.io/react-book-reader/

## Features

- 📱 **Mobile-first design** - Optimized for touch devices with swipe navigation
- 📐 **Word-precise pagination** - Text never cuts off mid-word or mid-line
- 💾 **Reading position persistence** - Automatically saves and restores reading position
- 🎨 **Beautiful typography** - Elegant serif fonts with proper line height and spacing
- 🌙 **Dark mode support** - Automatically adapts to system preferences
- ⌨️ **Keyboard navigation** - Arrow keys, space bar for desktop users
- 📍 **Click-to-navigate page numbers** - Jump to any page instantly
- 🔄 **Responsive** - Adapts to any screen size with proper centering on desktop
- ✨ **Smooth animations** - Page turn animations with rubber-band effect at boundaries

## Installation

```bash
npm install react-book-experience
```

## Usage

```tsx
import { BookReader } from 'react-book-experience';
import 'react-book-experience/styles.css';

function App() {
  const bookText = `Your long book text goes here...`;

  return (
    <BookReader
      id="my-book-1"
      text={bookText}
      title="The Great Adventure"
      author="Jane Doe"
    />
  );
}
```

## Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✅ | Unique identifier for the book. Used for storing reading position in localStorage. |
| `text` | `string` | ✅ | The full text content of the book. |
| `title` | `string` | - | Book title. Displayed on the cover page and as a running header. |
| `author` | `string` | - | Author name. Displayed on the cover page. |
| `contentRegion` | `Partial<ContentRegion>` | - | Custom padding for the content area. |

### ContentRegion

```tsx
interface ContentRegion {
  top: number;    // Top padding as % of viewport height (default: 8)
  bottom: number; // Bottom padding as % of viewport height (default: 6)
  left: number;   // Left padding as % of page width (default: 5)
  right: number;  // Right padding as % of page width (default: 5)
}
```

## Examples

### Basic Usage

```tsx
<BookReader
  id="book-1"
  text={myBookText}
/>
```

### With Title and Author (Cover Page)

```tsx
<BookReader
  id="book-1"
  text={myBookText}
  title="Pride and Prejudice"
  author="Jane Austen"
/>
```

### Custom Content Region

```tsx
<BookReader
  id="book-1"
  text={myBookText}
  title="My Book"
  contentRegion={{
    top: 10,
    bottom: 8,
    left: 8,
    right: 8,
  }}
/>
```

### Multiple Books

Each book maintains its own reading position:

```tsx
function Library() {
  return (
    <>
      <BookReader id="book-1" text={book1Text} title="First Book" />
      <BookReader id="book-2" text={book2Text} title="Second Book" />
    </>
  );
}
```

## Navigation

| Action | Mobile | Desktop |
|--------|--------|---------|
| Next page | Swipe left / Tap right side | Arrow Right / Down / Space / Click button |
| Previous page | Swipe right / Tap left side | Arrow Left / Up / Click button |
| Go to page | Click page number | Click page number |

## Styling

The component uses CSS custom properties for theming. You can override these in your CSS:

```css
.book-reader {
  --page-bg: #fdf8f0;
  --text-color: #2d2926;
  --page-shadow: 0 2px 20px rgba(0, 0, 0, 0.08);
  --footer-text: #8a847d;
  --transition-speed: 200ms;
}
```

### Dark Mode

Dark mode is automatic based on system preferences. Override with:

```css
@media (prefers-color-scheme: dark) {
  .book-reader {
    --page-bg: #1a1816;
    --text-color: #d4cfc8;
  }
}
```

### Recommended Global Styles

For the best mobile experience, add these styles to your app to prevent pull-to-refresh interference:

```css
body {
  overscroll-behavior-y: contain;
}
```

## TypeScript

Full TypeScript support with exported types:

```tsx
import { BookReader, BookReaderProps, ContentRegion } from 'react-book-experience';
```

## Browser Support

- Modern browsers (Chrome, Firefox, Safari, Edge)
- iOS Safari
- Android Chrome

## License

MIT © [Umut Erturk](https://github.com/umuterturk/react-book-reader)
