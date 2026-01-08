import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface PreviewProps {
  content: string;
  previewId: string;
}

export const Preview: React.FC<PreviewProps> = ({ content, previewId }) => {
  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700">
      <div className="px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Word Preview
      </div>
      
      {/* 
        We use an ID here to target this container for the Clipboard API.
        The classes "prose" come from @tailwindcss/typography.
      */}
      <div 
        id={previewId}
        className="flex-1 w-full p-8 overflow-y-auto custom-scrollbar bg-white dark:bg-gray-900"
      >
        <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-brand-600 hover:prose-a:text-brand-500 prose-img:rounded-lg">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              // Custom table rendering to ensure styles are attached for copying
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4">
                  <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />
                </div>
              ),
              th: ({ node, ...props }) => (
                <th className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 px-4 py-2 font-semibold" {...props} />
              ),
              td: ({ node, ...props }) => (
                <td className="border border-gray-300 dark:border-gray-600 px-4 py-2" {...props} />
              ),
              // Code block styling
              code: ({ node, className, children, ...props }) => {
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match && !String(children).includes('\n');
                
                return isInline ? (
                  <code className="bg-gray-100 dark:bg-gray-800 rounded px-1 py-0.5 font-mono text-sm text-pink-600 dark:text-pink-400" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={`${className} block bg-gray-50 dark:bg-gray-800 p-4 rounded-md text-sm font-mono overflow-x-auto border border-gray-200 dark:border-gray-700`} {...props}>
                    {children}
                  </code>
                )
              }
            }}
          >
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
};
