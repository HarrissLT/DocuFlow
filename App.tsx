import React, { useState, useEffect } from 'react';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { Toolbar } from './components/Toolbar';
import { SAMPLE_MARKDOWN, EMPTY_PLACEHOLDER } from './constants';
import { copyContentToWord } from './utils/copyToWord';

const PREVIEW_ID = 'docuflow-preview-pane';

export default function App() {
  const [content, setContent] = useState<string>(SAMPLE_MARKDOWN);
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Initialize theme based on system preference
  useEffect(() => {
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
      document.documentElement.classList.add('dark');
    }
  }, []);

  const toggleTheme = () => {
    setIsDarkMode((prev) => {
      const newMode = !prev;
      if (newMode) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return newMode;
    });
  };

  const handleCopy = async () => {
    const success = await copyContentToWord(PREVIEW_ID);
    if (success) {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  const handleClear = () => {
    if (window.confirm('Are you sure you want to clear the editor?')) {
      setContent('');
    }
  };

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      <Toolbar 
        onLoadSample={() => setContent(SAMPLE_MARKDOWN)}
        onClear={handleClear}
        onCopy={handleCopy}
        isCopied={isCopied}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* Editor Pane */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-700">
          <Editor 
            value={content} 
            onChange={setContent} 
          />
        </div>

        {/* Preview Pane */}
        <div className="w-full md:w-1/2 h-1/2 md:h-full">
          {content.trim() ? (
            <Preview 
              content={content} 
              previewId={PREVIEW_ID}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900 text-gray-400 dark:text-gray-600 p-8 text-center">
              <div className="max-w-md space-y-4">
                <p className="text-lg whitespace-pre-line">{EMPTY_PLACEHOLDER}</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
