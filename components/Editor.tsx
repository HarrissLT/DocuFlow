import React from 'react';
import { motion } from 'motion/react';
import { PenLine } from 'lucide-react';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

export const Editor: React.FC<EditorProps> = ({ value, onChange }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="h-full flex flex-col bg-white dark:bg-gray-900/60 backdrop-blur-sm"
    >
      <div className="px-5 py-3 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-2">
        <PenLine className="w-4 h-4 text-brand-500" />
        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          Input (Markdown/LaTeX)
        </span>
      </div>
      <div className="flex-1 relative group">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full p-6 resize-none outline-none font-mono text-sm bg-transparent text-gray-800 dark:text-gray-300 leading-relaxed custom-scrollbar selection:bg-brand-200 dark:selection:bg-brand-900/60 transition-colors"
          placeholder="Paste your content from ChatGPT, Claude, or Gemini here..."
          spellCheck={false}
        />
        <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white dark:from-gray-900 to-transparent pointer-events-none opacity-50"></div>
      </div>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.4);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(156, 163, 175, 0.6);
        }
      `}</style>
    </motion.div>
  );
};
