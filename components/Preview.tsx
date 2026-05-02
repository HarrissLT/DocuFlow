import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { motion, AnimatePresence } from 'motion/react';
import { Eye } from 'lucide-react';

interface PreviewProps {
  content: string;
  previewId: string;
}

export const Preview: React.FC<PreviewProps> = ({ content, previewId }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800"
    >
      <div className="px-5 py-3 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center space-x-2">
        <Eye className="w-4 h-4 text-brand-500" />
        <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
          Word Preview
        </span>
      </div>
      
      {/* 
        We use an ID here to target this container for the Clipboard API.
        The classes "prose" come from @tailwindcss/typography.
      */}
      <div 
        id={previewId}
        className="flex-1 w-full p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900 selection:bg-brand-200 dark:selection:bg-brand-900/60 transition-colors"
      >
        <AnimatePresence mode="wait">
          <motion.article 
            key={content}
            initial={{ opacity: 0.8, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-brand-600 hover:prose-a:text-brand-500 prose-img:rounded-xl prose-img:shadow-lg prose-pre:border prose-pre:border-gray-200 dark:prose-pre:border-gray-800 prose-pre:shadow-sm marker:text-brand-500"
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
              rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
              components={{
                // Explicit list handling to ensure structure matches expectation
                ul: ({ node, ...props }) => <ul className="list-disc pl-6 my-4" {...props} />,
                ol: ({ node, ...props }) => <ol className="list-decimal pl-6 my-4" {...props} />,
                li: ({ node, ...props }) => <li className="my-1" {...props} />,
                
                // Custom table rendering to ensure styles are attached for copying
                table: ({ node, ...props }) => (
                  <div className="overflow-x-auto my-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                    <table className="min-w-full m-0 border-collapse" {...props} />
                  </div>
                ),
                th: ({ node, ...props }) => (
                  <th className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 px-4 py-3 font-semibold text-left text-sm" {...props} />
                ),
                td: ({ node, ...props }) => (
                  <td className="border-b border-gray-100 dark:border-gray-800 px-4 py-3 text-sm" {...props} />
                ),
                // Code block styling
                // rehype-highlight handles the coloring inside, we just style the container
                code: ({ node, className, children, ...props }) => {
                  const match = /language-(\w+)/.exec(className || '')
                  const isInline = !match && !String(children).includes('\n');
                  
                  return isInline ? (
                    <code className="bg-brand-50 dark:bg-brand-900/30 rounded-md px-1.5 py-0.5 font-mono text-[0.875em] text-brand-700 dark:text-brand-300 border border-brand-100 dark:border-brand-800/50" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={`${className} block bg-gray-50/50 dark:bg-gray-900/50 p-4 rounded-xl text-sm font-mono overflow-x-auto`} {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {content}
            </ReactMarkdown>
          </motion.article>
        </AnimatePresence>
      </div>
    </motion.div>
  );
};