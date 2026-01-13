import { BookReader } from './components/BookReader';
import './App.css';

import SAMPLE_STORY from '../book';

function App() {
  return (
    <div className="app">
      <BookReader
        id="sample-story"
        text={SAMPLE_STORY}
        title="The Adventure"
        author="A. N. Storyteller"
        contentRegion={{ top: 6, bottom: 6, left: 6, right: 6 }}
      />
    </div>
  );
}

export default App;
