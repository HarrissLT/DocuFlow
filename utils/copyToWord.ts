/**
 * Copies the content of a specific HTML element to the clipboard
 * formatted specifically for Microsoft Word / RTF compatibility.
 */
export const copyContentToWord = async (elementId: string): Promise<boolean> => {
  const element = document.getElementById(elementId);
  if (!element) return false;

  // 1. Get the HTML content and detect mode
  const htmlContent = element.innerHTML;
  const isCustom = element.classList.contains('custom-list-type');

  // 2. Construct a Word-friendly HTML wrapper.
  // Microsoft Word handles HTML on the clipboard well, but it needs specific
  // XML namespaces and styles to look right (especially tables and borders).
  const fullHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset='utf-8'>
      <title>Export To Word</title>
      <style>
        /* Base typography */
        body {
          font-family: Calibri, Arial, sans-serif;
          font-size: 11pt;
          line-height: 1.5;
          color: #000000;
        }
        
        /* Headers */
        h1, h2, h3, h4, h5, h6 {
          font-family: 'Calibri Light', Calibri, sans-serif;
          color: #2E74B5; /* Word standard blue */
          margin-top: 12pt;
          margin-bottom: 3pt;
        }
        h1 { font-size: 16pt; }
        h2 { font-size: 14pt; }
        h3 { font-size: 12pt; }
        
        /* Tables - Critical for Word */
        table {
          border-collapse: collapse;
          width: 100%;
          margin-bottom: 10pt;
        }
        th {
          background-color: #f2f2f2;
          font-weight: bold;
          text-align: left;
          border: 1px solid #000000;
          padding: 5pt;
        }
        td {
          border: 1px solid #000000;
          padding: 5pt;
          vertical-align: top;
        }
        
        /* Code blocks */
        pre {
          background-color: #f0f0f0;
          padding: 10pt;
          border: 1px solid #cccccc;
          border-radius: 4px;
          margin-bottom: 10pt;
        }
        code {
          font-family: Consolas, 'Courier New', monospace;
          font-size: 10pt;
        }

        /* Math / KaTeX adjustments */
        .katex {
          font-size: 1.1em;
        }
        .katex-mathml {
          display: none !important;
        }
        /* Ensure math symbols are visible */
        .katex-html {
          display: inline-block;
        }
        
        /* Lists General */
        ul, ol {
          margin-top: 0;
          margin-bottom: 10pt;
          padding-left: 24pt; /* Indentation for Word */
        }
        li {
          margin-bottom: 3pt;
        }

        /* Hanging Indents for Custom Mode Word Compatibility */
        ${isCustom ? `
          /* Reset all list styles */
          ul, ol, li { list-style-type: none !important; margin: 0 !important; padding: 0 !important; }
          
          /* Style each list item as a paragraph with hanging indent */
          li.custom-li { 
            display: block !important;
            margin-left: 25pt !important;
            text-indent: -15pt !important;
            margin-top: 3pt !important;
            margin-bottom: 3pt !important;
            line-height: 1.2 !important;
          }
          
          /* Ensure the marker and content stay on the same line */
          .custom-content, .custom-content p { 
            display: inline !important; 
            margin: 0 !important; 
            padding: 0 !important; 
          }
          
          /* The marker span */
          .text-brand-500 { 
            color: #6366f1 !important; 
            font-weight: bold !important;
          }
        ` : `
          ul { list-style-type: disc; }
          ul ul { list-style-type: circle; margin-top: 3pt; margin-bottom: 3pt; }
          ul ul ul { list-style-type: square; }
        `}
        
        ol { list-style-type: decimal; }
        ol ol { list-style-type: lower-alpha; margin-top: 3pt; margin-bottom: 3pt; }
        ol ol ol { list-style-type: lower-roman; }
      </style>
    </head>
    <body>
      <!-- The actual content from React -->
      ${htmlContent}
    </body>
    </html>
  `;

  try {
    // 3. Create a ClipboardItem with text/html type
    // This allows Word to interpret the styles and structure
    const blob = new Blob([fullHtml], { type: 'text/html' });
    const textBlob = new Blob([element.innerText], { type: 'text/plain' });
    
    const data = [new ClipboardItem({ 
        'text/html': blob,
        'text/plain': textBlob 
    })];

    await navigator.clipboard.write(data);
    return true;
  } catch (err) {
    console.error('Failed to copy: ', err);
    // Fallback for older browsers
    try {
        await navigator.clipboard.writeText(element.innerText);
        alert("Rich copy failed. Copied as plain text instead.");
        return true;
    } catch (e) {
        return false;
    }
  }
};