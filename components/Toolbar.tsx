import React, { useState } from 'react';
import { FileText, Copy, Trash2, Moon, Sun, Check, FileDown, Code, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

export type EditorMode = 'markdown' | 'latex';

interface ToolbarProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onLoadSample: () => void;
  onClear: () => void;
  onCopy: () => void;
  isCopied: boolean;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  mode,
  onModeChange,
  onLoadSample,
  onClear,
  onCopy,
  isCopied,
  isDarkMode,
  toggleTheme
}) => {
  return (
    <motion.div 
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 sticky top-0 z-10 shadow-sm"
    >
      <div className="flex items-center space-x-3 mb-4 sm:mb-0 w-full sm:w-auto">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center space-x-2 text-brand-600 dark:text-brand-500 font-bold text-xl mr-2 sm:mr-4 ml-2"
        >
          <div className="bg-brand-100 dark:bg-brand-900/40 p-2 rounded-xl text-brand-600 dark:text-brand-400">
            <FileText className="w-5 h-5" />
          </div>
          <span className="hidden sm:inline bg-clip-text text-transparent bg-gradient-to-r from-brand-600 to-brand-400 dark:from-brand-400 dark:to-brand-200 tracking-tight">DocuFlow</span>
        </motion.div>
        
        <div className="flex bg-gray-100/80 dark:bg-gray-800/80 p-1.5 rounded-xl border border-gray-200/50 dark:border-gray-700/50 shadow-inner">
          {(['markdown', 'latex'] as EditorMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onModeChange(m)}
              className={`relative px-4 py-1.5 text-sm font-medium rounded-lg transition-all flex items-center space-x-1 ${
                mode === m 
                  ? 'text-brand-700 dark:text-brand-300' 
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-200/50 dark:hover:bg-gray-700/50'
              }`}
            >
              {mode === m && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 bg-white dark:bg-gray-700 rounded-lg shadow-sm border border-gray-200/50 dark:border-gray-600/50"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <span className="relative z-10 flex items-center gap-2">
                {m === 'markdown' ? <Code className="w-4 h-4" /> : <FileDown className="w-4 h-4" />}
                <span className="capitalize">{m === 'latex' ? 'LaTeX PDF' : m}</span>
              </span>
            </button>
          ))}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onLoadSample}
          className="ml-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 border border-gray-200/50 dark:border-gray-700/50 transition-colors shadow-sm"
        >
          Load Sample
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onClear}
          className="p-2.5 text-gray-400 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Clear Editor"
        >
          <Trash2 className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="flex items-center space-x-3 w-full sm:w-auto justify-end">
        <motion.button
          whileHover={{ scale: 1.05, rotate: 15 }}
          whileTap={{ scale: 0.95 }}
          onClick={toggleTheme}
          className="p-2.5 text-gray-500 dark:text-gray-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-all shadow-sm"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </motion.button>

        {mode === 'markdown' && (
          <motion.button
            whileHover={!isCopied ? { scale: 1.02, y: -1 } : {}}
            whileTap={!isCopied ? { scale: 0.98 } : {}}
            onClick={onCopy}
            disabled={isCopied}
            className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-md group ${
              isCopied
                ? 'bg-green-500 text-white cursor-default shadow-green-500/20'
                : 'bg-gradient-to-r from-brand-600 to-brand-500 hover:from-brand-500 hover:to-brand-400 text-white active:scale-95 shadow-brand-500/25 border border-brand-500/50'
            }`}
          >
            {isCopied ? (
              <motion.div
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center space-x-2"
              >
                <Check className="w-4 h-4 bg-white/20 rounded-full p-0.5" />
                <span>Copied for Word!</span>
              </motion.div>
            ) : (
              <div className="flex items-center space-x-2">
                <Copy className="w-4 h-4 transition-transform group-hover:scale-110" />
                <span>Copy for Word</span>
              </div>
            )}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};
