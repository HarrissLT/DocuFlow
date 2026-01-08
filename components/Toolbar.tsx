import React from 'react';
import { FileText, Copy, Trash2, Moon, Sun, Check } from 'lucide-react';

interface ToolbarProps {
  onLoadSample: () => void;
  onClear: () => void;
  onCopy: () => void;
  isCopied: boolean;
  isDarkMode: boolean;
  toggleTheme: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  onLoadSample,
  onClear,
  onCopy,
  isCopied,
  isDarkMode,
  toggleTheme
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center space-x-2 mb-2 sm:mb-0">
        <div className="flex items-center space-x-2 text-brand-600 dark:text-brand-500 font-bold text-xl mr-4">
          <FileText className="w-6 h-6" />
          <span>DocuFlow</span>
        </div>
        
        <button
          onClick={onLoadSample}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          Load Sample
        </button>
        <button
          onClick={onClear}
          className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded hover:bg-red-50 dark:hover:bg-red-900/20"
          title="Clear Editor"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex items-center space-x-3">
        <button
          onClick={toggleTheme}
          className="p-2 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        <button
          onClick={onCopy}
          disabled={isCopied}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md font-semibold transition-all shadow-sm ${
            isCopied
              ? 'bg-green-600 text-white cursor-default'
              : 'bg-brand-600 hover:bg-brand-500 text-white active:scale-95'
          }`}
        >
          {isCopied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copied for Word!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copy for Word</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
