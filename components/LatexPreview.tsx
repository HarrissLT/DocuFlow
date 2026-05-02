import React, { useRef, useState } from 'react';
import { Play, FileText } from 'lucide-react';
import { motion } from 'motion/react';

interface LatexPreviewProps {
  content: string;
}

export const LatexPreview: React.FC<LatexPreviewProps> = ({ content }) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isCompiling, setIsCompiling] = useState(false);

  const handleCompile = () => {
    setIsCompiling(true);
    if (formRef.current) {
      formRef.current.submit();
    }
    setTimeout(() => setIsCompiling(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="flex flex-col h-full bg-white dark:bg-gray-900 relative"
    >
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-gray-50/80 dark:bg-gray-800/50">
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-brand-500" />
          <h2 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">LaTeX PDF Preview</h2>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCompile}
          disabled={isCompiling}
          className="flex items-center space-x-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm shadow-brand-500/20 text-sm font-medium transition-colors"
        >
          {isCompiling ? (
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            </motion.div>
          ) : (
            <Play className="w-4 h-4 fill-current" />
          )}
          <span>{isCompiling ? 'Compiling...' : 'Compile PDF'}</span>
        </motion.button>
      </div>

      <div className="flex-1 w-full bg-gray-100 dark:bg-gray-900 relative">
        <iframe
          name="latex-preview-frame"
          className="w-full h-full border-none bg-white rounded-bl-xl md:rounded-bl-none"
          title="LaTeX Preview"
        />
        {isCompiling && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-white/50 dark:bg-black/50 backdrop-blur-sm flex items-center justify-center"
          >
            <div className="flex flex-col items-center space-y-4">
               <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                >
                  <div className="w-10 h-10 border-4 border-brand-500/30 border-t-brand-500 rounded-full" />
                </motion.div>
                <div className="text-brand-600 dark:text-brand-400 font-semibold">Tuning the LaTeX engine...</div>
            </div>
          </motion.div>
        )}
        {/* Hidden form to post the LaTeX document to the compiling service */}
        <form
          ref={formRef}
          action="https://latexonline.cc/compile"
          method="POST"
          target="latex-preview-frame"
          className="hidden"
        >
          <input type="hidden" name="text" value={content} />
        </form>
      </div>
    </motion.div>
  );
};
