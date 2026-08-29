/**
 * Auto-detects and converts raw LaTeX math expressions, arrow commands,
 * and formula notations such as `\[\text{The} + \text{Adjective} + \text{Noun Phrase}\]`
 * and `\(\rightarrow\)` into clean, beautifully formatted Markdown & KaTeX math syntax.
 * 
 * Preserves Markdown Table structures by keeping inline formulas on single lines.
 */

export function convertLatexToSmartMarkdown(input: string): string {
  if (!input) return input;

  // Split text by code blocks so we don't convert code blocks or inline code
  const codeBlockRegex = /(```[\s\S]*?```|`[^`\n]+`)/g;
  const parts = input.split(codeBlockRegex);

  return parts.map((part, index) => {
    // Keep code blocks untouched
    if (index % 2 === 1) return part;

    let text = part;

    // 1. Normalize multiple backslashes before LaTeX delimiters
    // e.g. \\[ -> \[, \\] -> \], \\( -> \(, \\) -> \)
    text = text.replace(/\\+\[/g, '\\[');
    text = text.replace(/\\+\]/g, '\\]');
    text = text.replace(/\\+\(/g, '\\(');
    text = text.replace(/\\+\)/g, '\\)');

    // 2. Normalize backslashes before LaTeX arrow commands
    text = text.replace(/\\+(rightarrow|to|Rightarrow|leftrightarrow|leftarrow|gets)\b/g, '\\$1');

    // 3. Convert explicit inline arrow expressions like \(\rightarrow\), \(\to\), \( \rightarrow \) to '→'
    text = text.replace(/\\\(\s*\\(rightarrow|to)\s*\\\)/g, '→');
    text = text.replace(/\\\(\s*\\Rightarrow\s*\\\)/g, '⇒');
    text = text.replace(/\\\(\s*\\leftrightarrow\s*\\\)/g, '↔');
    text = text.replace(/\\\(\s*\\(leftarrow|gets)\s*\\\)/g, '←');

    // 4. Convert general \( ... \) inline math blocks
    text = text.replace(/\\\(\s*([\s\S]*?)\s*\\\)/g, (_match, p1) => {
      let content = p1.trim();
      // Replace arrows inside \( ... \)
      content = content.replace(/\\(rightarrow|to)\b/g, '→');
      content = content.replace(/\\Rightarrow\b/g, '⇒');
      content = content.replace(/\\leftrightarrow\b/g, '↔');
      content = content.replace(/\\(leftarrow|gets)\b/g, '←');

      if (content === '→' || content === '⇒' || content === '↔' || content === '←') {
        return content;
      }
      return `$ ${content} $`;
    });

    // 5. Convert LaTeX display math \[ ... \] into $$ ... $$ or $ ... $
    text = text.replace(/\\\[\s*([\s\S]*?)\s*\\\]/g, (match, p1, offset, fullStr) => {
      let content = p1.trim();

      // Convert arrows inside math block if any
      content = content.replace(/\\(rightarrow|to)\b/g, '\\rightarrow');

      // Check if this match is inside a table line (contains '|')
      // Or if it's strictly isolated on its own line
      const lineStart = fullStr.lastIndexOf('\n', offset);
      const currentLineStart = lineStart === -1 ? 0 : lineStart + 1;
      const nextLineEnd = fullStr.indexOf('\n', offset + match.length);
      const currentLineEnd = nextLineEnd === -1 ? fullStr.length : nextLineEnd;
      const currentLine = fullStr.slice(currentLineStart, currentLineEnd);

      const isInsideTable = currentLine.includes('|');
      const isStartOfLine = fullStr.slice(currentLineStart, offset).trim() === '';
      const isEndOfLine = fullStr.slice(offset + match.length, currentLineEnd).trim() === '';

      if (!isInsideTable && isStartOfLine && isEndOfLine) {
        return `$$\n${content}\n$$`;
      } else {
        return `$ ${content} $`;
      }
    });

    // 6. Convert standalone arrow commands outside math blocks
    text = text.replace(/\\(rightarrow|to)\b/g, '→');
    text = text.replace(/\\Rightarrow\b/g, '⇒');
    text = text.replace(/\\leftrightarrow\b/g, '↔');
    text = text.replace(/\\(leftarrow|gets)\b/g, '←');

    // 7. Clean up any trailing backslashes left after arrow conversions (e.g. →\ or →\\)
    text = text.replace(/([→⇒↔←])\\+/g, '$1');

    // 8. Convert other standalone LaTeX math symbols
    text = text.replace(/\\times\b/g, '×');
    text = text.replace(/\\div\b/g, '÷');
    text = text.replace(/\\pm\b/g, '±');
    text = text.replace(/\\neq\b/g, '≠');
    text = text.replace(/\\(le|leq)\b/g, '≤');
    text = text.replace(/\\(ge|geq)\b/g, '≥');
    text = text.replace(/\\quad\b/g, ' ');
    text = text.replace(/\\qquad\b/g, '  ');

    // 9. Handle any orphan \text{...} patterns outside $...$ or $$...$$
    text = text.split('\n').map(line => {
      if (/\\text\{/.test(line) && !line.includes('$')) {
        return line.replace(/(\\text\{[^{}]+\}(?:\s*[\+\-\=\>\<\/\*\;]\s*(?:\\text\{[^{}]+\}|[a-zA-Z0-9_\-]+))*)/g, (m) => {
          return `$ ${m.trim()} $`;
        });
      }
      return line;
    }).join('\n');

    return text;
  }).join('');
}
