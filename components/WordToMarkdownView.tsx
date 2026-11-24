import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FileUp,
  ClipboardPaste,
  Copy,
  Check,
  Download,
  ArrowRight,
  FileText,
  Eye,
  Code,
  AlertCircle,
  Sparkles,
  Trash2,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkBreaks from 'remark-breaks';
import rehypeKatex from 'rehype-katex';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import {
  WordConversionOptions,
  WordScanStats,
  DEFAULT_WORD_OPTIONS,
  convertDocxArrayBufferToMarkdown,
  convertWordHtmlToMarkdown,
  generateSampleDocxBuffer,
} from '../utils/wordToMarkdown';

interface WordToMarkdownViewProps {
  markdownOutput: string;
  onMarkdownChange: (md: string) => void;
  onSendToMarkdownTab: (md: string) => void;
  registerExternalActions?: (actions: {
    loadSample: () => void;
    clear: () => void;
    copy: () => Promise<boolean>;
  }) => void;
}

type SourceSnapshot =
  | { type: 'docx'; buffer: ArrayBuffer; fileName: string; fileSize: number }
  | { type: 'html'; html: string }
  | { type: 'plain'; text: string }
  | null;

type OutputTab = 'raw' | 'preview';

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const WordToMarkdownView: React.FC<WordToMarkdownViewProps> = ({
  markdownOutput,
  onMarkdownChange,
  onSendToMarkdownTab,
  registerExternalActions,
}) => {
  const [options, setOptions] = useState<WordConversionOptions>(DEFAULT_WORD_OPTIONS);
  const [sourceSnapshot, setSourceSnapshot] = useState<SourceSnapshot>(null);
  const [stats, setStats] = useState<WordScanStats | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [outputTab, setOutputTab] = useState<OutputTab>('raw');
  const [isCopiedLocal, setIsCopiedLocal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pasteAreaRef = useRef<HTMLDivElement>(null);

  const runConversion = useCallback(
    async (snapshot: SourceSnapshot, opts: WordConversionOptions) => {
      if (!snapshot) return;
      setIsProcessing(true);
      setErrorMsg(null);
      try {
        if (snapshot.type === 'docx') {
          const res = await convertDocxArrayBufferToMarkdown(snapshot.buffer, opts, {
            name: snapshot.fileName,
            size: snapshot.fileSize,
          });
          onMarkdownChange(res.markdown);
          setStats(res.stats);
        } else if (snapshot.type === 'html') {
          const res = convertWordHtmlToMarkdown(snapshot.html, opts);
          onMarkdownChange(res.markdown);
          setStats(res.stats);
        } else {
          onMarkdownChange(snapshot.text);
          setStats({
            sourceType: 'plain-text',
            paragraphs: snapshot.text.split(/\n\s*\n/).filter(Boolean).length,
            headings: 0,
            tables: 0,
            mathEquations: 0,
            listItems: 0,
            links: 0,
            footnotes: 0,
            textBoxes: 0,
            images: 0,
          });
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Không thể đọc dữ liệu Word.';
        setErrorMsg(msg);
      } finally {
        setIsProcessing(false);
      }
    },
    [onMarkdownChange]
  );

  // Re-run automatically when options change if we have a source loaded
  const handleOptionChange = (updater: (prev: WordConversionOptions) => WordConversionOptions) => {
    setOptions(prev => {
      const next = updater(prev);
      if (sourceSnapshot) {
        void runConversion(sourceSnapshot, next);
      }
      return next;
    });
  };

  const processFile = useCallback(
    async (file: File) => {
      setErrorMsg(null);
      const lower = file.name.toLowerCase();

      if (lower.endsWith('.doc')) {
        setErrorMsg(
          'Định dạng .doc cũ (nhị phân 97-2003) không hỗ trợ giải mã trực tiếp. Hãy mở trong Word chọn Lưu dạng .docx, hoặc Ctrl+A → Ctrl+C nội dung trong Word rồi Ctrl+V vào khung bên cạnh.'
        );
        return;
      }

      if (lower.endsWith('.html') || lower.endsWith('.htm')) {
        const html = await file.text();
        const snap: SourceSnapshot = { type: 'html', html };
        setSourceSnapshot(snap);
        await runConversion(snap, options);
        return;
      }

      if (!lower.endsWith('.docx')) {
        setErrorMsg('Vui lòng chọn file Word định dạng .docx (hoặc dán trực tiếp từ Microsoft Word).');
        return;
      }

      const buffer = await file.arrayBuffer();
      const snap: SourceSnapshot = {
        type: 'docx',
        buffer,
        fileName: file.name,
        fileSize: file.size,
      };
      setSourceSnapshot(snap);
      await runConversion(snap, options);
    },
    [options, runConversion]
  );

  const handleLoadSample = useCallback(async () => {
    setIsProcessing(true);
    setErrorMsg(null);
    try {
      const buffer = await generateSampleDocxBuffer();
      const snap: SourceSnapshot = {
        type: 'docx',
        buffer,
        fileName: 'Chuyen-de-Cap-so-nhan-Mau.docx',
        fileSize: buffer.byteLength,
      };
      setSourceSnapshot(snap);
      await runConversion(snap, options);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tạo file mẫu.');
      setIsProcessing(false);
    }
  }, [options, runConversion]);

  const handleClear = useCallback(() => {
    setSourceSnapshot(null);
    setStats(null);
    setErrorMsg(null);
    onMarkdownChange('');
  }, [onMarkdownChange]);

  const handleCopyMarkdown = useCallback(async () => {
    if (!markdownOutput.trim()) return false;
    try {
      await navigator.clipboard.writeText(markdownOutput);
      setIsCopiedLocal(true);
      setTimeout(() => setIsCopiedLocal(false), 2000);
      return true;
    } catch {
      return false;
    }
  }, [markdownOutput]);

  useEffect(() => {
    if (registerExternalActions) {
      registerExternalActions({
        loadSample: handleLoadSample,
        clear: handleClear,
        copy: handleCopyMarkdown,
      });
    }
  }, [registerExternalActions, handleLoadSample, handleClear, handleCopyMarkdown]);

  const handleClipboardData = useCallback(
    async (dt: DataTransfer | null) => {
      if (!dt) return;

      // 1. Check if user copied a .docx file in Explorer/Finder
      if (dt.files && dt.files.length > 0) {
        await processFile(dt.files[0]);
        return;
      }

      // 2. Check rich HTML copied from Microsoft Word / Docs
      const html = dt.getData('text/html');
      if (html && html.trim()) {
        const snap: SourceSnapshot = { type: 'html', html };
        setSourceSnapshot(snap);
        await runConversion(snap, options);
        return;
      }

      // 3. Fallback plain text
      const plain = dt.getData('text/plain');
      if (plain && plain.trim()) {
        const snap: SourceSnapshot = { type: 'plain', text: plain };
        setSourceSnapshot(snap);
        await runConversion(snap, options);
      }
    },
    [options, processFile, runConversion]
  );

  const handlePasteEvent = async (e: React.ClipboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await handleClipboardData(e.clipboardData);
  };

  useEffect(() => {
    const onWindowPaste = (e: ClipboardEvent) => {
      const active = document.activeElement;
      if (
        active &&
        (active.tagName === 'TEXTAREA' || active.tagName === 'INPUT')
      ) {
        return;
      }
      // If pasteAreaRef is handling it directly, avoid double trigger
      if (pasteAreaRef.current && pasteAreaRef.current.contains(e.target as Node)) {
        return;
      }
      e.preventDefault();
      void handleClipboardData(e.clipboardData);
    };
    window.addEventListener('paste', onWindowPaste);
    return () => window.removeEventListener('paste', onWindowPaste);
  }, [handleClipboardData]);

  const handleClipboardButtonClick = async () => {
    setErrorMsg(null);
    try {
      if (navigator.clipboard && 'read' in navigator.clipboard) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          if (item.types.includes('text/html')) {
            const blob = await item.getType('text/html');
            const html = await blob.text();
            if (html.trim()) {
              const snap: SourceSnapshot = { type: 'html', html };
              setSourceSnapshot(snap);
              await runConversion(snap, options);
              return;
            }
          }
          if (item.types.includes('text/plain')) {
            const blob = await item.getType('text/plain');
            const text = await blob.text();
            if (text.trim()) {
              const snap: SourceSnapshot = { type: 'plain', text };
              setSourceSnapshot(snap);
              await runConversion(snap, options);
              return;
            }
          }
        }
      }
      // Fallback to readText
      const txt = await navigator.clipboard.readText();
      if (txt.trim()) {
        const snap: SourceSnapshot = { type: 'plain', text: txt };
        setSourceSnapshot(snap);
        await runConversion(snap, options);
      } else {
        pasteAreaRef.current?.focus();
        setErrorMsg('Clipboard trống. Hãy copy nội dung trong Word (Ctrl+C) rồi nhấn Ctrl+V vào vùng nhập.');
      }
    } catch {
      pasteAreaRef.current?.focus();
      setErrorMsg('Trình duyệt chặn đọc Clipboard tự động — bạn chỉ cần bấm vào vùng nhập và nhấn Ctrl+V (hoặc Cmd+V).');
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
      return;
    }

    const html = e.dataTransfer?.getData('text/html');
    if (html && html.trim()) {
      const snap: SourceSnapshot = { type: 'html', html };
      setSourceSnapshot(snap);
      await runConversion(snap, options);
    }
  };

  const handleDownloadMd = () => {
    if (!markdownOutput.trim()) return;
    const baseName =
      sourceSnapshot?.type === 'docx'
        ? sourceSnapshot.fileName.replace(/\.docx$/i, '')
        : 'word-converted';
    const blob = new Blob([markdownOutput], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${baseName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden w-full h-full gap-4">
      {/* LEFT PANE: Word Input (Upload, Drag & Drop, Copy-Paste) */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
          }
        }}
        onDrop={handleDrop}
        className={`w-full md:w-1/2 h-1/2 md:h-full md:rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-gray-900 border transition-colors ${
          isDragging
            ? 'border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/30 dark:bg-brand-900/20'
            : 'border-gray-200 dark:border-gray-800'
        }`}
      >
        {/* Header */}
        <div className="px-5 py-3 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2 min-w-0">
            <FileText className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
              Nguồn Word (.docx / Copy-Paste)
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleLoadSample}
              className="px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Mẫu .docx</span>
            </button>
            {sourceSnapshot && (
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="Xóa nguồn hiện tại"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Options Strip */}
        <div className="px-5 py-2.5 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-gray-500 dark:text-gray-400 whitespace-nowrap">Công thức:</span>
            <div className="flex items-center p-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <button
                type="button"
                onClick={() => handleOptionChange(o => ({ ...o, mathStyle: 'dollar' }))}
                className={`px-2.5 py-1 rounded-md font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  options.mathStyle === 'dollar'
                    ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                $ ... $
              </button>
              <button
                type="button"
                onClick={() => handleOptionChange(o => ({ ...o, mathStyle: 'latex' }))}
                className={`px-2.5 py-1 rounded-md font-mono font-medium transition-colors whitespace-nowrap shrink-0 ${
                  options.mathStyle === 'latex'
                    ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-300 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                \( ... \)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300 select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={options.preserveUnderline}
                onChange={(e) =>
                  handleOptionChange(o => ({ ...o, preserveUnderline: e.target.checked }))
                }
                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span>Giữ gạch chân (&lt;u&gt;)</span>
            </label>

            <label className="flex items-center gap-1.5 cursor-pointer text-gray-600 dark:text-gray-300 select-none whitespace-nowrap">
              <input
                type="checkbox"
                checked={options.imageMode === 'placeholder'}
                onChange={(e) =>
                  handleOptionChange(o => ({
                    ...o,
                    imageMode: e.target.checked ? 'placeholder' : 'ignore',
                  }))
                }
                className="rounded border-gray-300 dark:border-gray-600 text-brand-600 focus:ring-brand-500"
              />
              <span>Ghi chú ảnh</span>
            </label>
          </div>
        </div>

        {/* Interactive Drop + Paste Area */}
        <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
          <input
            ref={fileInputRef}
            type="file"
            accept=".docx,.doc,.htm,.html"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void processFile(f);
              e.target.value = '';
            }}
            className="hidden"
          />

          {/* Primary Drop & Paste Surface */}
          <div
            ref={pasteAreaRef}
            tabIndex={0}
            onPaste={handlePasteEvent}
            className={`relative flex-1 min-h-[220px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center p-6 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-500 ${
              isDragging
                ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20'
                : 'border-gray-300 dark:border-gray-700 hover:border-brand-400 dark:hover:border-brand-600 bg-gray-50/60 dark:bg-gray-800/30'
            }`}
          >
            {isProcessing ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-9 h-9 border-3 border-brand-500/30 border-t-brand-500 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Đang quét sâu cấu trúc XML, công thức OMML và bảng biểu...
                </p>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center mb-4">
                  <FileUp className="w-6 h-6" />
                </div>

                <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                  Kéo thả file Word (.docx) hoặc nhấn Ctrl+V để dán trực tiếp
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5 max-w-md leading-relaxed">
                  Quét sâu 100% cục bộ trên trình duyệt: giữ nguyên tiêu đề, bảng biểu căn lề, danh sách đa cấp, liên kết, ghi chú và chuyển công thức toán Word (OMML) sang LaTeX.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mt-5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-500 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0 shadow-sm"
                  >
                    <FileUp className="w-4 h-4" />
                    <span>Chọn file .docx</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleClipboardButtonClick}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors flex items-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <ClipboardPaste className="w-4 h-4 text-brand-500" />
                    <span>Dán từ Clipboard</span>
                  </button>
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
                  Mẹo nhanh: Chọn nội dung trong Microsoft Word → <span className="font-mono">Ctrl+C</span> → Click vào khung này → <span className="font-mono">Ctrl+V</span>
                </p>
              </>
            )}
          </div>

          {/* Error Notice */}
          {errorMsg && (
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/30 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Real Scan Summary (clean unboxed metadata, tabular numerals) */}
          {stats && (
            <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-gray-200 truncate">
                  {stats.sourceType === 'docx'
                    ? `${stats.fileName || 'Tài liệu Word'}`
                    : stats.sourceType === 'clipboard-html'
                    ? 'Nội dung Rich HTML dán từ Word'
                    : 'Văn bản thuần từ Clipboard'}
                </span>
                {stats.fileSizeBytes ? (
                  <span className="font-mono tabular-nums text-gray-500">
                    {formatBytes(stats.fileSizeBytes)}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                <span>
                  <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.paragraphs}</strong> đoạn văn
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.headings}</strong> tiêu đề
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.tables}</strong> bảng
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.mathEquations}</strong> công thức toán
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.listItems}</strong> mục danh sách
                </span>
                {stats.links > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.links}</strong> liên kết
                    </span>
                  </>
                )}
                {stats.textBoxes > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.textBoxes}</strong> text box
                    </span>
                  </>
                )}
                {stats.footnotes > 0 && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      <strong className="text-gray-800 dark:text-gray-200 font-semibold">{stats.footnotes}</strong> chú thích
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PANE: Markdown Output + Live Preview */}
      <div className="w-full md:w-1/2 h-1/2 md:h-full md:rounded-2xl overflow-hidden flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
        {/* Header with Segmented View Switch & Actions */}
        <div className="px-4 py-2.5 bg-gray-50/80 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center p-1 bg-gray-200/70 dark:bg-gray-800 rounded-lg">
            <button
              type="button"
              onClick={() => setOutputTab('raw')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                outputTab === 'raw'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Mã Markdown</span>
            </button>
            <button
              type="button"
              onClick={() => setOutputTab('preview')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                outputTab === 'preview'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Xem trước</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => markdownOutput.trim() && onSendToMarkdownTab(markdownOutput)}
              disabled={!markdownOutput.trim()}
              className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 whitespace-nowrap shrink-0"
              title="Đưa nội dung Markdown này sang Tab Markdown chính"
            >
              <span>Mở ở Tab Markdown</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleDownloadMd}
              disabled={!markdownOutput.trim()}
              className="p-1.5 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              title="Tải xuống file .md"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleCopyMarkdown}
              disabled={!markdownOutput.trim()}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isCopiedLocal
                  ? 'bg-green-600 text-white'
                  : 'bg-brand-600 hover:bg-brand-500 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {isCopiedLocal ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Đã copy!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Markdown</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Output Content */}
        <div className="flex-1 relative overflow-hidden">
          {!markdownOutput.trim() ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center text-gray-400 dark:text-gray-500">
              <p className="text-base font-medium">Kết quả Markdown sẽ xuất hiện tại đây</p>
              <p className="text-xs mt-1.5 max-w-sm">
                Tải file .docx, kéo thả vào khung bên trái, hoặc copy nội dung từ Word và dán trực tiếp để quét và xuất Markdown.
              </p>
            </div>
          ) : outputTab === 'raw' ? (
            <textarea
              value={markdownOutput}
              onChange={(e) => onMarkdownChange(e.target.value)}
              spellCheck={false}
              className="w-full h-full p-6 resize-none outline-none font-mono text-sm bg-transparent text-gray-800 dark:text-gray-200 leading-relaxed custom-scrollbar selection:bg-brand-200 dark:selection:bg-brand-900/60"
            />
          ) : (
            <div className="h-full overflow-y-auto p-6 custom-scrollbar">
              <article className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-brand-600 dark:prose-a:text-brand-400">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath, remarkBreaks]}
                  rehypePlugins={[rehypeRaw, rehypeKatex, rehypeHighlight]}
                >
                  {markdownOutput}
                </ReactMarkdown>
              </article>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
