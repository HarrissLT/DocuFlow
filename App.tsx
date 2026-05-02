import React, { useState, useEffect } from 'react';
import { Editor } from './components/Editor';
import { Preview } from './components/Preview';
import { LatexPreview } from './components/LatexPreview';
import { Toolbar, EditorMode } from './components/Toolbar';
import { SAMPLE_MARKDOWN, SAMPLE_LATEX, EMPTY_PLACEHOLDER } from './constants';
import { copyContentToWord } from './utils/copyToWord';
import { motion, AnimatePresence } from 'motion/react';

const PREVIEW_ID = 'docuflow-preview-pane';

export default function App() {
  const [mode, setMode] = useState<EditorMode>('markdown');
  const [markdownContent, setMarkdownContent] = useState<string>(SAMPLE_MARKDOWN);
  const [latexContent, setLatexContent] = useState<string>(SAMPLE_LATEX);
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
      if (mode === 'markdown') {
        setMarkdownContent('');
      } else {
        setLatexContent('');
      }
    }
  };

  const handleContentChange = (val: string) => {
    if (mode === 'markdown') {
      setMarkdownContent(val);
    } else {
      setLatexContent(val);
    }
  }

  const currentContent = mode === 'markdown' ? markdownContent : latexContent;

  return (
    <div className={`flex flex-col h-screen w-full overflow-hidden ${isDarkMode ? 'dark' : ''}`}>
      {/* Background with beautiful subtle glow */}
      <div className="absolute inset-0 z-[-1] bg-gray-50 dark:bg-[#0a0a0e] transition-colors duration-500">
        <div className="absolute -top-[30%] -left-[10%] w-[50%] h-[50%] rounded-full bg-brand-400/20 dark:bg-brand-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute top-[20%] -right-[10%] w-[40%] h-[60%] rounded-full bg-blue-400/10 dark:bg-blue-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute -bottom-[20%] left-[20%] w-[60%] h-[40%] rounded-full bg-brand-300/20 dark:bg-brand-800/10 blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.05] mix-blend-overlay pointer-events-none" />
      </div>

      <Toolbar 
        mode={mode}
        onModeChange={setMode}
        onLoadSample={() => {
          if (mode === 'markdown') setMarkdownContent(SAMPLE_MARKDOWN);
          else setLatexContent(SAMPLE_LATEX);
        }}
        onClear={handleClear}
        onCopy={handleCopy}
        isCopied={isCopied}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
      />
      
      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative z-0 max-w-[1920px] mx-auto w-full md:p-4 gap-4">
        {/* Editor Pane */}
        <motion.div 
          layout
          className="w-full md:w-1/2 h-1/2 md:h-full md:rounded-2xl overflow-hidden shadow-2xl shadow-black/5 dark:shadow-none border border-transparent dark:border-gray-800/50"
        >
          <Editor 
            value={currentContent} 
            onChange={handleContentChange} 
          />
        </motion.div>

        {/* Preview Pane */}
        <motion.div 
          layout
          className="w-full md:w-1/2 h-1/2 md:h-full md:rounded-2xl overflow-hidden shadow-2xl shadow-black/5 dark:shadow-none border border-transparent dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm"
        >
          <AnimatePresence mode="wait">
            {mode === 'markdown' ? (
              <motion.div 
                key="markdown-preview" 
                className="h-full"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                {currentContent.trim() ? (
                  <Preview 
                    content={currentContent} 
                    previewId={PREVIEW_ID}
                  />
                ) : (
                  <div className="h-full flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 text-gray-400 dark:text-gray-600 p-8 text-center border-l border-gray-200 dark:border-gray-800">
                    <motion.div 
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="max-w-md space-y-4"
                    >
                      <p className="text-lg whitespace-pre-line font-medium text-gray-400 dark:text-gray-500">{EMPTY_PLACEHOLDER}</p>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div 
                key="latex-preview" 
                className="h-full border-l border-gray-200 dark:border-gray-800"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.3 }}
              >
                <LatexPreview content={latexContent} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </main>
    </div>
  );
}
