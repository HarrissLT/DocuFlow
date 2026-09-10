import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Binary, Info } from 'lucide-react';
import { EditorMode } from './Toolbar';

interface KeepLatexBubbleProps {
  isKeepLatex: boolean;
  onToggle: () => void;
  mode: EditorMode;
}

export const KeepLatexBubble: React.FC<KeepLatexBubbleProps> = ({
  isKeepLatex,
  onToggle,
  mode,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  // Only show in markdown and custom list tabs
  if (mode !== 'markdown' && mode !== 'custom') {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">
      <AnimatePresence>
        {showTooltip && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="mb-3 p-3.5 max-w-xs bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-md text-white text-xs rounded-2xl shadow-xl border border-gray-700/60 pointer-events-auto flex items-start space-x-2.5"
          >
            <Info className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-gray-100">Tính năng Keep LaTeX</p>
              <p className="text-gray-300 mt-1 leading-relaxed">
                {isKeepLatex
                  ? 'Đang BẬT: Các công thức toán LaTeX thô (như \\[...] hay \\(...\\)) được giữ nguyên gốc, không tự động chuyển đổi.'
                  : 'Đang TẮT: Tự động chuyển đổi công thức LaTeX thô sang định dạng KaTeX / Unicode đẹp mắt.'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.06, y: -2 }}
        whileTap={{ scale: 0.94 }}
        onClick={onToggle}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={`pointer-events-auto flex items-center space-x-2.5 px-4 py-3 rounded-full shadow-2xl transition-all duration-300 border backdrop-blur-xl ${
          isKeepLatex
            ? 'bg-amber-500/90 dark:bg-amber-600/90 text-white border-amber-300/60 dark:border-amber-400/50 shadow-amber-500/30 ring-4 ring-amber-500/20'
            : 'bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 border-gray-200/80 dark:border-gray-700/80 hover:border-brand-300 dark:hover:border-brand-600 shadow-black/10'
        }`}
        title="Bật/Tắt giữ nguyên LaTeX"
      >
        <div className="relative flex items-center justify-center">
          <Binary className={`w-5 h-5 ${isKeepLatex ? 'text-white' : 'text-brand-500 dark:text-brand-400'}`} />
          {isKeepLatex && (
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-200 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white"></span>
            </span>
          )}
        </div>

        <span className="text-xs font-bold tracking-wide">
          Keep LaTeX
        </span>

        <span
          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full transition-colors ${
            isKeepLatex
              ? 'bg-white/20 text-white border border-white/30'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
          }`}
        >
          {isKeepLatex ? 'ON' : 'OFF'}
        </span>
      </motion.button>
    </div>
  );
};
