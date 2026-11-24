import JSZip from 'jszip';
import { ommlElementToLatex, ommlStringToLatex } from './ommlToLatex';

export type MathDelimiterStyle = 'dollar' | 'latex';
export type ImageHandlingMode = 'placeholder' | 'ignore';

export interface WordConversionOptions {
  mathStyle: MathDelimiterStyle; // 'dollar' ($...$ / $$...$$) | 'latex' (\(...\) / \[...\])
  preserveUnderline: boolean;
  imageMode: ImageHandlingMode;
}

export const DEFAULT_WORD_OPTIONS: WordConversionOptions = {
  mathStyle: 'dollar',
  preserveUnderline: false,
  imageMode: 'placeholder',
};

export interface WordScanStats {
  sourceType: 'docx' | 'clipboard-html' | 'plain-text';
  fileName?: string;
  fileSizeBytes?: number;
  paragraphs: number;
  headings: number;
  tables: number;
  mathEquations: number;
  listItems: number;
  links: number;
  footnotes: number;
  textBoxes: number;
  images: number;
}

export interface WordConversionResult {
  markdown: string;
  stats: WordScanStats;
  warnings: string[];
}

interface StyleInfo {
  id: string;
  name: string;
  type: string;
  basedOn?: string;
  outlineLvl?: number;
  headingLevel?: number;
  isCode?: boolean;
  isQuote?: boolean;
  numId?: string;
  ilvl?: number;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  fontFamily?: string;
}

interface NumberingLevel {
  numFmt: string;
  lvlText: string;
  start: number;
}

interface RunFormat {
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  underline: boolean;
  sup: boolean;
  sub: boolean;
  highlight: boolean;
}

interface InlineSegment {
  kind: 'text' | 'raw' | 'break';
  text: string;
  format?: RunFormat;
}

const MONOSPACE_FONTS = [
  'consolas',
  'courier new',
  'courier',
  'jetbrains mono',
  'fira code',
  'cascadia code',
  'cascadia mono',
  'menlo',
  'monaco',
  'source code pro',
  'dejavu sans mono',
  'liberation mono',
  'ubuntu mono',
  'lucida console',
  'roboto mono',
  'sf mono',
];

function isMonospaceFont(font?: string): boolean {
  if (!font) return false;
  const lower = font.toLowerCase().replace(/['"]/g, '').trim();
  return MONOSPACE_FONTS.some(m => lower.includes(m));
}

function lName(node: Node | null | undefined): string {
  if (!node || node.nodeType !== 1) return '';
  const el = node as Element;
  const raw = el.localName || el.tagName || '';
  const idx = raw.indexOf(':');
  return (idx >= 0 ? raw.slice(idx + 1) : raw).toLowerCase();
}

function wAttr(el: Element | null, attr: string): string {
  if (!el) return '';
  return (
    el.getAttribute(`w:${attr}`) ??
    el.getAttribute(`r:${attr}`) ??
    el.getAttribute(attr) ??
    ''
  );
}

function directChildren(el: Element, name?: string): Element[] {
  const out: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const c = el.children[i];
    if (!name || lName(c) === name.toLowerCase()) out.push(c);
  }
  return out;
}

function firstChild(el: Element, name: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    if (lName(el.children[i]) === name.toLowerCase()) return el.children[i];
  }
  return null;
}

function parseXmlSafe(xmlText: string): Document | null {
  if (!xmlText) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) return null;
  return doc;
}

function parseBoolProp(pr: Element | null, propName: string): boolean | undefined {
  if (!pr) return undefined;
  const el = firstChild(pr, propName);
  if (!el) return undefined;
  const val = wAttr(el, 'val').toLowerCase();
  if (val === '0' || val === 'false' || val === 'off' || val === 'none') return false;
  return true;
}

function formatMath(latex: string, isBlock: boolean, style: MathDelimiterStyle): string {
  const trimmed = latex.trim();
  if (!trimmed) return '';
  if (style === 'latex') {
    return isBlock ? `\\[\n${trimmed}\n\\]` : `\\(${trimmed}\\)`;
  }
  return isBlock ? `$$\n${trimmed}\n$$` : `$${trimmed}$`;
}

function wrapInlineFormatting(text: string, fmt: RunFormat, preserveUnderline: boolean): string {
  if (!text) return '';

  // Extract leading/trailing whitespace so markers tightly hug content
  const match = text.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!match) return text;
  const [, lead, core, trail] = match;
  if (!core) return text;

  let res = core;

  if (fmt.code) {
    // Escape backticks inside inline code
    const fence = core.includes('`') ? '`` ' : '`';
    const fenceEnd = core.includes('`') ? ' ``' : '`';
    res = `${fence}${core}${fenceEnd}`;
  } else {
    if (fmt.bold && fmt.italic) {
      res = `***${res}***`;
    } else if (fmt.bold) {
      res = `**${res}**`;
    } else if (fmt.italic) {
      res = `*${res}*`;
    }
    if (fmt.strike) {
      res = `~~${res}~~`;
    }
    if (fmt.underline && preserveUnderline) {
      res = `<u>${res}</u>`;
    }
    if (fmt.highlight) {
      res = `==${res}==`;
    }
    if (fmt.sup) {
      res = `<sup>${res}</sup>`;
    } else if (fmt.sub) {
      res = `<sub>${res}</sub>`;
    }
  }

  return `${lead}${res}${trail}`;
}

function sameFormat(a: RunFormat, b: RunFormat): boolean {
  return (
    a.bold === b.bold &&
    a.italic === b.italic &&
    a.strike === b.strike &&
    a.code === b.code &&
    a.underline === b.underline &&
    a.sup === b.sup &&
    a.sub === b.sub &&
    a.highlight === b.highlight
  );
}

function renderSegments(segments: InlineSegment[], preserveUnderline: boolean, insideTable = false): string {
  // Merge adjacent text segments with identical formatting
  const merged: InlineSegment[] = [];
  for (const seg of segments) {
    if (seg.kind === 'break') {
      merged.push(seg);
      continue;
    }
    if (seg.kind === 'text' && seg.format && merged.length > 0) {
      const prev = merged[merged.length - 1];
      if (prev.kind === 'text' && prev.format && sameFormat(prev.format, seg.format)) {
        prev.text += seg.text;
        continue;
      }
    }
    merged.push({ ...seg });
  }

  let out = '';
  for (const seg of merged) {
    if (seg.kind === 'break') {
      out += insideTable ? '<br>' : '  \n';
    } else if (seg.kind === 'raw') {
      out += seg.text;
    } else if (seg.format) {
      out += wrapInlineFormatting(seg.text, seg.format, preserveUnderline);
    } else {
      out += seg.text;
    }
  }
  return out;
}

function emptyFormat(): RunFormat {
  return {
    bold: false,
    italic: false,
    strike: false,
    code: false,
    underline: false,
    sup: false,
    sub: false,
    highlight: false,
  };
}

function detectHeadingLevelFromName(nameOrId: string): number | undefined {
  const s = nameOrId.toLowerCase().trim();
  if (s === 'title') return 1;
  if (s === 'subtitle') return 2;
  const m = s.match(/^(?:heading|tiêu đề|tieu de|título|überschrift)\s*([1-6])$/i) || s.match(/^h([1-6])$/i);
  if (m) return parseInt(m[1], 10);
  return undefined;
}

function parseStylesXml(doc: Document | null): Map<string, StyleInfo> {
  const map = new Map<string, StyleInfo>();
  if (!doc) return map;

  const styleEls = doc.getElementsByTagName('*');
  for (let i = 0; i < styleEls.length; i++) {
    const el = styleEls[i];
    if (lName(el) !== 'style') continue;

    const id = wAttr(el, 'styleId');
    if (!id) continue;
    const type = wAttr(el, 'type') || 'paragraph';
    const nameEl = firstChild(el, 'name');
    const name = wAttr(nameEl, 'val') || id;
    const basedOnEl = firstChild(el, 'basedOn');
    const basedOn = wAttr(basedOnEl, 'val') || undefined;

    const pPr = firstChild(el, 'pPr');
    const rPr = firstChild(el, 'rPr');

    let outlineLvl: number | undefined;
    if (pPr) {
      const olEl = firstChild(pPr, 'outlineLvl');
      if (olEl) {
        const v = parseInt(wAttr(olEl, 'val'), 10);
        if (!isNaN(v) && v >= 0 && v <= 5) outlineLvl = v + 1;
      }
    }

    let numId: string | undefined;
    let ilvl: number | undefined;
    if (pPr) {
      const numPr = firstChild(pPr, 'numPr');
      if (numPr) {
        numId = wAttr(firstChild(numPr, 'numId'), 'val') || undefined;
        const ilvlStr = wAttr(firstChild(numPr, 'ilvl'), 'val');
        if (ilvlStr) ilvl = parseInt(ilvlStr, 10);
      }
    }

    const rFonts = rPr ? firstChild(rPr, 'rFonts') : null;
    const fontFamily = rFonts
      ? wAttr(rFonts, 'ascii') || wAttr(rFonts, 'hAnsi') || wAttr(rFonts, 'cs')
      : undefined;

    const headingLevel = detectHeadingLevelFromName(name) || detectHeadingLevelFromName(id) || outlineLvl;
    const lowerName = `${name} ${id}`.toLowerCase();
    const isCode =
      /\b(code|source|preformatted|verbatim|listing|monospace|htmlpre)\b/.test(lowerName) ||
      isMonospaceFont(fontFamily);
    const isQuote = /\b(quote|intensequote|blockquote|citation)\b/.test(lowerName);

    map.set(id, {
      id,
      name,
      type,
      basedOn,
      outlineLvl,
      headingLevel,
      isCode,
      isQuote,
      numId,
      ilvl,
      bold: parseBoolProp(rPr, 'b'),
      italic: parseBoolProp(rPr, 'i'),
      strike: parseBoolProp(rPr, 'strike') ?? parseBoolProp(rPr, 'dstrike'),
      underline: parseBoolProp(rPr, 'u'),
      fontFamily,
    });
  }

  // Resolve style inheritance
  const resolved = new Map<string, StyleInfo>();
  const resolveStyle = (id: string, depth = 0): StyleInfo | undefined => {
    if (resolved.has(id)) return resolved.get(id);
    const s = map.get(id);
    if (!s) return undefined;
    if (!s.basedOn || depth > 10 || !map.has(s.basedOn)) {
      resolved.set(id, s);
      return s;
    }
    const parent = resolveStyle(s.basedOn, depth + 1);
    if (!parent) {
      resolved.set(id, s);
      return s;
    }
    const merged: StyleInfo = {
      ...parent,
      ...s,
      headingLevel: s.headingLevel ?? parent.headingLevel,
      outlineLvl: s.outlineLvl ?? parent.outlineLvl,
      isCode: s.isCode || parent.isCode,
      isQuote: s.isQuote || parent.isQuote,
      numId: s.numId ?? parent.numId,
      ilvl: s.ilvl ?? parent.ilvl,
      bold: s.bold ?? parent.bold,
      italic: s.italic ?? parent.italic,
      strike: s.strike ?? parent.strike,
      underline: s.underline ?? parent.underline,
      fontFamily: s.fontFamily ?? parent.fontFamily,
    };
    resolved.set(id, merged);
    return merged;
  };

  for (const id of map.keys()) resolveStyle(id);
  return resolved;
}

function parseNumberingXml(doc: Document | null): Map<string, Map<number, NumberingLevel>> {
  const numMap = new Map<string, Map<number, NumberingLevel>>();
  if (!doc) return numMap;

  const abstractMap = new Map<string, Map<number, NumberingLevel>>();
  const all = doc.getElementsByTagName('*');

  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (lName(el) !== 'abstractnum') continue;
    const absId = wAttr(el, 'abstractNumId');
    if (!absId) continue;

    const lvls = new Map<number, NumberingLevel>();
    for (const lvlEl of directChildren(el, 'lvl')) {
      const ilvl = parseInt(wAttr(lvlEl, 'ilvl') || '0', 10);
      const numFmt = wAttr(firstChild(lvlEl, 'numFmt'), 'val') || 'decimal';
      const lvlText = wAttr(firstChild(lvlEl, 'lvlText'), 'val') || '';
      const start = parseInt(wAttr(firstChild(lvlEl, 'start'), 'val') || '1', 10);
      lvls.set(ilvl, { numFmt, lvlText, start: isNaN(start) ? 1 : start });
    }
    abstractMap.set(absId, lvls);
  }

  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (lName(el) !== 'num') continue;
    const numId = wAttr(el, 'numId');
    const absRef = wAttr(firstChild(el, 'abstractNumId'), 'val');
    if (!numId || !absRef) continue;

    const base = abstractMap.get(absRef);
    const cloned = new Map<number, NumberingLevel>();
    if (base) {
      base.forEach((v, k) => cloned.set(k, { ...v }));
    }

    for (const ov of directChildren(el, 'lvlOverride')) {
      const ilvl = parseInt(wAttr(ov, 'ilvl') || '0', 10);
      const startOv = wAttr(firstChild(ov, 'startOverride'), 'val');
      const lvlEl = firstChild(ov, 'lvl');
      if (lvlEl) {
        const numFmt = wAttr(firstChild(lvlEl, 'numFmt'), 'val') || 'decimal';
        const lvlText = wAttr(firstChild(lvlEl, 'lvlText'), 'val') || '';
        const start = parseInt(wAttr(firstChild(lvlEl, 'start'), 'val') || startOv || '1', 10);
        cloned.set(ilvl, { numFmt, lvlText, start: isNaN(start) ? 1 : start });
      } else if (startOv && cloned.has(ilvl)) {
        const prev = cloned.get(ilvl)!;
        cloned.set(ilvl, { ...prev, start: parseInt(startOv, 10) || prev.start });
      }
    }

    numMap.set(numId, cloned);
  }

  return numMap;
}

function parseRelsXml(doc: Document | null): Map<string, { target: string; type: string }> {
  const rels = new Map<string, { target: string; type: string }>();
  if (!doc) return rels;

  const all = doc.getElementsByTagName('*');
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (lName(el) !== 'relationship') continue;
    const id = el.getAttribute('Id') || '';
    const target = el.getAttribute('Target') || '';
    const type = el.getAttribute('Type') || '';
    if (id) rels.set(id, { target, type });
  }
  return rels;
}

function mapWingdingOrSymbolChar(font: string, charHex: string): string {
  const code = parseInt(charHex, 16);
  if (isNaN(code)) return '';
  const f = font.toLowerCase();
  const masked = code & 0xff;
  if (f.includes('wingdings')) {
    const map: Record<number, string> = {
      0x6e: '▪',
      0x6f: '▫',
      0x70: '▪',
      0x71: '▫',
      0x75: '◆',
      0x76: '❖',
      0x9f: '•',
      0xa7: '▪',
      0xa8: '▫',
      0xd8: '➢',
      0xe0: '➔',
      0xe8: '➔',
      0xf0: '➔',
      0xfc: '✓',
      0xfb: '✗',
      0xfe: '☑',
    };
    if (map[masked]) return map[masked];
  }
  if (f.includes('symbol')) {
    const map: Record<number, string> = {
      0xae: '→',
      0xac: '←',
      0xde: '⇒',
      0xdb: '⇔',
      0xa3: '≤',
      0xb3: '≥',
      0xb9: '≠',
      0xb1: '±',
      0xb4: '×',
      0xb8: '÷',
      0xa5: '∞',
      0xb7: '•',
    };
    if (map[masked]) return map[masked];
  }
  return masked >= 32 && masked <= 126 ? String.fromCharCode(masked) : '•';
}

export async function convertDocxArrayBufferToMarkdown(
  buffer: ArrayBuffer,
  options: WordConversionOptions = DEFAULT_WORD_OPTIONS,
  fileMeta?: { name: string; size: number }
): Promise<WordConversionResult> {
  const zip = await JSZip.loadAsync(buffer);
  const warnings: string[] = [];

  const docXml = await zip.file('word/document.xml')?.async('string');
  if (!docXml) {
    throw new Error('Không tìm thấy word/document.xml. File có thể bị hỏng hoặc không phải định dạng .docx chuẩn.');
  }

  const documentDoc = parseXmlSafe(docXml);
  if (!documentDoc) {
    throw new Error('Không thể giải mã XML trong file Word (.docx).');
  }

  const stylesXml = await zip.file('word/styles.xml')?.async('string');
  const numberingXml = await zip.file('word/numbering.xml')?.async('string');
  const relsXml = await zip.file('word/_rels/document.xml.rels')?.async('string');
  const footnotesXml = await zip.file('word/footnotes.xml')?.async('string');
  const endnotesXml = await zip.file('word/endnotes.xml')?.async('string');

  const stylesMap = parseStylesXml(stylesXml ? parseXmlSafe(stylesXml) : null);
  const numberingMap = parseNumberingXml(numberingXml ? parseXmlSafe(numberingXml) : null);
  const relsMap = parseRelsXml(relsXml ? parseXmlSafe(relsXml) : null);
  const footnotesDoc = footnotesXml ? parseXmlSafe(footnotesXml) : null;
  const endnotesDoc = endnotesXml ? parseXmlSafe(endnotesXml) : null;

  const stats: WordScanStats = {
    sourceType: 'docx',
    fileName: fileMeta?.name,
    fileSizeBytes: fileMeta?.size,
    paragraphs: 0,
    headings: 0,
    tables: 0,
    mathEquations: 0,
    listItems: 0,
    links: 0,
    footnotes: 0,
    textBoxes: 0,
    images: 0,
  };

  // Footnotes / Endnotes content map
  const footnoteNotes = new Map<string, string>();
  const endnoteNotes = new Map<string, string>();
  const usedFootnoteOrder: { key: string; label: string; text: string }[] = [];

  const listCounters = new Map<string, number>();

  const extractInlineRunFormat = (rEl: Element, pStyle?: StyleInfo): RunFormat => {
    const rPr = firstChild(rEl, 'rPr');
    const rStyleId = wAttr(firstChild(rPr || rEl, 'rStyle'), 'val');
    const cStyle = rStyleId ? stylesMap.get(rStyleId) : undefined;

    const rFonts = rPr ? firstChild(rPr, 'rFonts') : null;
    const fontFamily =
      (rFonts && (wAttr(rFonts, 'ascii') || wAttr(rFonts, 'hAnsi') || wAttr(rFonts, 'cs'))) ||
      cStyle?.fontFamily ||
      pStyle?.fontFamily;

    const vertAlign = wAttr(rPr ? firstChild(rPr, 'vertAlign') : null, 'val');
    const highlightEl = rPr ? firstChild(rPr, 'highlight') : null;
    const highlightVal = wAttr(highlightEl, 'val');

    const bold = parseBoolProp(rPr, 'b') ?? cStyle?.bold ?? pStyle?.bold ?? false;
    const italic = parseBoolProp(rPr, 'i') ?? cStyle?.italic ?? pStyle?.italic ?? false;
    const strike =
      parseBoolProp(rPr, 'strike') ??
      parseBoolProp(rPr, 'dstrike') ??
      cStyle?.strike ??
      pStyle?.strike ??
      false;
    const underline = parseBoolProp(rPr, 'u') ?? cStyle?.underline ?? false;
    const code = Boolean(cStyle?.isCode || isMonospaceFont(fontFamily));

    return {
      bold,
      italic,
      strike,
      code,
      underline,
      sup: vertAlign === 'superscript',
      sub: vertAlign === 'subscript',
      highlight: Boolean(highlightEl && highlightVal !== 'none'),
    };
  };

  const extractTextBoxesFromElement = (el: Element): string[] => {
    const blocks: string[] = [];
    const walkForBoxes = (node: Element) => {
      const name = lName(node);
      // Avoid double-scanning mc:Fallback when mc:Choice is present
      if (name === 'alternatecontent') {
        const choice = firstChild(node, 'choice');
        if (choice) {
          walkForBoxes(choice);
          return;
        }
      }
      if (name === 'txbxcontent') {
        stats.textBoxes++;
        const innerLines = processBlockContainer(node, false);
        if (innerLines.length > 0) {
          const quoted = innerLines
            .join('\n')
            .split('\n')
            .map(l => (l.trim() ? `> ${l}` : '>'))
            .join('\n');
          blocks.push(quoted);
        }
        return;
      }
      for (let i = 0; i < node.children.length; i++) {
        walkForBoxes(node.children[i]);
      }
    };
    walkForBoxes(el);
    return blocks;
  };

  const extractParagraphSegments = (
    pEl: Element,
    pStyle: StyleInfo | undefined,
    insideTable: boolean
  ): { segments: InlineSegment[]; extraTextBoxes: string[]; hasOnlyMath: boolean } => {
    const segments: InlineSegment[] = [];
    const extraTextBoxes: string[] = [];
    let mathCountInPara = 0;
    let nonMathContent = false;

    // Complex field tracking (e.g. HYPERLINK "https://...")
    let inField = false;
    let fieldPhase: 'instr' | 'result' | null = null;
    let fieldInstr = '';
    let fieldSegments: InlineSegment[] = [];

    const walkInline = (node: Element) => {
      const name = lName(node);

      if (name === 'ppr' || name === 'del') {
        return;
      }

      if (name === 'ins' || name === 'smarttag' || name === 'sdt' || name === 'sdtcontent') {
        for (let i = 0; i < node.children.length; i++) {
          walkInline(node.children[i]);
        }
        return;
      }

      if (name === 'omathpara') {
        const latex = ommlElementToLatex(node);
        if (latex) {
          stats.mathEquations++;
          mathCountInPara++;
          segments.push({
            kind: 'raw',
            text: formatMath(latex, !insideTable, options.mathStyle),
          });
        }
        return;
      }

      if (name === 'omath') {
        const latex = ommlElementToLatex(node);
        if (latex) {
          stats.mathEquations++;
          mathCountInPara++;
          segments.push({
            kind: 'raw',
            text: formatMath(latex, false, options.mathStyle),
          });
        }
        return;
      }

      if (name === 'hyperlink') {
        const rId = wAttr(node, 'id');
        const anchor = wAttr(node, 'anchor');
        const rel = rId ? relsMap.get(rId) : undefined;
        const url = rel?.target || (anchor ? `#${anchor}` : '');

        const linkSegs: InlineSegment[] = [];
        for (let i = 0; i < node.children.length; i++) {
          const child = node.children[i];
          if (lName(child) === 'r') {
            const fmt = extractInlineRunFormat(child, pStyle);
            // Strip default hyperlink underline
            fmt.underline = false;
            const txt = extractRunPlainText(child);
            if (txt) {
              linkSegs.push({ kind: 'text', text: txt, format: fmt });
            }
          }
        }
        const label = renderSegments(linkSegs, false, insideTable).trim();
        if (label || url) {
          nonMathContent = true;
          stats.links++;
          const safeUrl = url.replace(/\s+/g, '%20');
          segments.push({
            kind: 'raw',
            text: safeUrl ? `[${label || safeUrl}](${safeUrl})` : label,
          });
        }
        return;
      }

      if (name === 'fldsimple') {
        const instr = wAttr(node, 'instr');
        const urlMatch = instr.match(/HYPERLINK\s+"([^"]+)"/i);
        const linkSegs: InlineSegment[] = [];
        for (let i = 0; i < node.children.length; i++) {
          if (lName(node.children[i]) === 'r') {
            const fmt = extractInlineRunFormat(node.children[i], pStyle);
            fmt.underline = false;
            const txt = extractRunPlainText(node.children[i]);
            if (txt) linkSegs.push({ kind: 'text', text: txt, format: fmt });
          }
        }
        const label = renderSegments(linkSegs, false, insideTable).trim();
        if (urlMatch) {
          nonMathContent = true;
          stats.links++;
          segments.push({ kind: 'raw', text: `[${label || urlMatch[1]}](${urlMatch[1]})` });
        } else if (label) {
          nonMathContent = true;
          segments.push({ kind: 'raw', text: label });
        }
        return;
      }

      if (name === 'r') {
        // Check for fldChar / instrText inside run
        const fldChar = firstChild(node, 'fldChar');
        if (fldChar) {
          const fldType = wAttr(fldChar, 'fldCharType');
          if (fldType === 'begin') {
            inField = true;
            fieldPhase = 'instr';
            fieldInstr = '';
            fieldSegments = [];
            return;
          }
          if (fldType === 'separate' && inField) {
            fieldPhase = 'result';
            return;
          }
          if (fldType === 'end' && inField) {
            const urlMatch = fieldInstr.match(/HYPERLINK\s+(?:\\l\s+)?"([^"]+)"/i);
            const label = renderSegments(fieldSegments, options.preserveUnderline, insideTable).trim();
            if (urlMatch) {
              nonMathContent = true;
              stats.links++;
              const isBookmark = /HYPERLINK\s+\\l\s+/i.test(fieldInstr);
              const href = isBookmark ? `#${urlMatch[1]}` : urlMatch[1];
              segments.push({ kind: 'raw', text: `[${label || href}](${href})` });
            } else if (fieldSegments.length > 0) {
              nonMathContent = true;
              segments.push(...fieldSegments);
            }
            inField = false;
            fieldPhase = null;
            fieldInstr = '';
            fieldSegments = [];
            return;
          }
        }

        if (inField && fieldPhase === 'instr') {
          const instrEl = firstChild(node, 'instrText');
          if (instrEl) fieldInstr += instrEl.textContent || '';
          return;
        }

        const fmt = extractInlineRunFormat(node, pStyle);
        const targetArr = inField && fieldPhase === 'result' ? fieldSegments : segments;

        for (let i = 0; i < node.children.length; i++) {
          const c = node.children[i];
          const cn = lName(c);

          if (cn === 't' || cn === 'deltext') {
            const txt = c.textContent || '';
            if (txt) {
              if (txt.trim()) nonMathContent = true;
              targetArr.push({ kind: 'text', text: txt, format: fmt });
            }
          } else if (cn === 'tab') {
            targetArr.push({ kind: 'raw', text: ' ' });
          } else if (cn === 'br' || cn === 'cr') {
            const brType = wAttr(c, 'type');
            if (brType !== 'page') {
              targetArr.push({ kind: 'break', text: '' });
            }
          } else if (cn === 'nobreakhyphen') {
            nonMathContent = true;
            targetArr.push({ kind: 'text', text: '-', format: fmt });
          } else if (cn === 'sym') {
            const font = wAttr(c, 'font');
            const charHex = wAttr(c, 'char');
            const mapped = mapWingdingOrSymbolChar(font, charHex);
            if (mapped) {
              nonMathContent = true;
              targetArr.push({ kind: 'text', text: mapped, format: fmt });
            }
          } else if (cn === 'footnotereference') {
            const id = wAttr(c, 'id');
            if (id && footnoteNotes.has(id)) {
              nonMathContent = true;
              stats.footnotes++;
              const label = `fn-${id}`;
              if (!usedFootnoteOrder.some(x => x.key === label)) {
                usedFootnoteOrder.push({ key: label, label: `${usedFootnoteOrder.length + 1}`, text: footnoteNotes.get(id)! });
              }
              const numLabel = usedFootnoteOrder.find(x => x.key === label)!.label;
              targetArr.push({ kind: 'raw', text: `[^${numLabel}]` });
            }
          } else if (cn === 'endnotereference') {
            const id = wAttr(c, 'id');
            if (id && endnoteNotes.has(id)) {
              nonMathContent = true;
              stats.footnotes++;
              const label = `en-${id}`;
              if (!usedFootnoteOrder.some(x => x.key === label)) {
                usedFootnoteOrder.push({ key: label, label: `${usedFootnoteOrder.length + 1}`, text: endnoteNotes.get(id)! });
              }
              const numLabel = usedFootnoteOrder.find(x => x.key === label)!.label;
              targetArr.push({ kind: 'raw', text: `[^${numLabel}]` });
            }
          } else if (cn === 'drawing' || cn === 'pict' || cn === 'alternatecontent') {
            // Check if this drawing/shape contains a textbox!
            const txbxs = extractTextBoxesFromElement(c);
            if (txbxs.length > 0) {
              extraTextBoxes.push(...txbxs);
            } else {
              // Check for image
              const docPr = c.getElementsByTagName('*');
              let alt = '';
              let hasImage = false;
              for (let j = 0; j < docPr.length; j++) {
                const dn = lName(docPr[j]);
                if (dn === 'blip' || dn === 'imagedata') hasImage = true;
                if (dn === 'docpr') {
                  alt = docPr[j].getAttribute('descr') || docPr[j].getAttribute('title') || docPr[j].getAttribute('name') || '';
                }
              }
              if (hasImage) {
                stats.images++;
                if (options.imageMode === 'placeholder') {
                  nonMathContent = true;
                  const cleanAlt = alt.replace(/[\[\]\n\r]/g, ' ').trim() || `image-${stats.images}`;
                  targetArr.push({ kind: 'raw', text: `![${cleanAlt}](image-${stats.images}.png)` });
                }
              }
            }
          }
        }
        return;
      }

      for (let i = 0; i < node.children.length; i++) {
        walkInline(node.children[i]);
      }
    };

    for (let i = 0; i < pEl.children.length; i++) {
      walkInline(pEl.children[i]);
    }

    return {
      segments,
      extraTextBoxes,
      hasOnlyMath: mathCountInPara === 1 && !nonMathContent,
    };
  };

  const extractRunPlainText = (rEl: Element): string => {
    let txt = '';
    for (let i = 0; i < rEl.children.length; i++) {
      const c = rEl.children[i];
      if (lName(c) === 't') txt += c.textContent || '';
      else if (lName(c) === 'tab') txt += ' ';
    }
    return txt;
  };

  const convertParagraph = (pEl: Element, insideTable: boolean): { md: string; isCode: boolean; codeText?: string; extraBoxes: string[] } => {
    const pPr = firstChild(pEl, 'pPr');
    const styleId = wAttr(pPr ? firstChild(pPr, 'pStyle') : null, 'val');
    const pStyle = styleId ? stylesMap.get(styleId) : undefined;

    const { segments, extraTextBoxes, hasOnlyMath } = extractParagraphSegments(pEl, pStyle, insideTable);
    const rendered = renderSegments(segments, options.preserveUnderline, insideTable);
    const trimmed = rendered.trim();

    // Check horizontal rule (empty paragraph with bottom border)
    if (!trimmed && pPr) {
      const pBdr = firstChild(pPr, 'pBdr');
      if (pBdr && firstChild(pBdr, 'bottom') && !firstChild(pBdr, 'top')) {
        return { md: insideTable ? '' : '---', isCode: false, extraBoxes: extraTextBoxes };
      }
    }

    if (!trimmed) {
      return { md: '', isCode: false, extraBoxes: extraTextBoxes };
    }

    stats.paragraphs++;

    // Detect if all runs use monospace font or Code style
    const runs = directChildren(pEl, 'r');
    const allRunsMono =
      runs.length > 0 &&
      runs.every(r => {
        const rPr = firstChild(r, 'rPr');
        const rFonts = rPr ? firstChild(rPr, 'rFonts') : null;
        const f = rFonts ? wAttr(rFonts, 'ascii') || wAttr(rFonts, 'hAnsi') : '';
        return isMonospaceFont(f);
      });

    if (!insideTable && (pStyle?.isCode || allRunsMono) && !hasOnlyMath) {
      const plainCode = runs.map(extractRunPlainText).join('');
      return { md: plainCode, isCode: true, codeText: plainCode, extraBoxes: extraTextBoxes };
    }

    // Check standalone display math paragraph
    if (!insideTable && hasOnlyMath) {
      // Already formatted as $$...$$ or \[...\] if oMathPara, otherwise upgrade inline $...$ to display
      if (trimmed.startsWith('$') && !trimmed.startsWith('$$') && trimmed.endsWith('$')) {
        const inner = trimmed.slice(1, -1).trim();
        return { md: formatMath(inner, true, options.mathStyle), isCode: false, extraBoxes: extraTextBoxes };
      }
      if (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) {
        const inner = trimmed.slice(2, -2).trim();
        return { md: formatMath(inner, true, options.mathStyle), isCode: false, extraBoxes: extraTextBoxes };
      }
      return { md: trimmed, isCode: false, extraBoxes: extraTextBoxes };
    }

    // Heading detection
    let headingLevel = pStyle?.headingLevel;
    if (!headingLevel && pPr) {
      const olEl = firstChild(pPr, 'outlineLvl');
      if (olEl) {
        const v = parseInt(wAttr(olEl, 'val'), 10);
        if (!isNaN(v) && v >= 0 && v <= 5) headingLevel = v + 1;
      }
    }

    if (!insideTable && headingLevel && headingLevel >= 1 && headingLevel <= 6) {
      stats.headings++;
      // Avoid double ** wrapping on headings if the entire heading is bold
      let cleanHeading = trimmed;
      if (cleanHeading.startsWith('**') && cleanHeading.endsWith('**') && cleanHeading.indexOf('**', 2) === cleanHeading.length - 2) {
        cleanHeading = cleanHeading.slice(2, -2).trim();
      }
      return { md: `${'#'.repeat(headingLevel)} ${cleanHeading}`, isCode: false, extraBoxes: extraTextBoxes };
    }

    // List detection (direct numPr or inherited from paragraph style)
    const numPr = pPr ? firstChild(pPr, 'numPr') : null;
    const numId = (numPr ? wAttr(firstChild(numPr, 'numId'), 'val') : '') || pStyle?.numId || '';
    const ilvlStr = numPr ? wAttr(firstChild(numPr, 'ilvl'), 'val') : '';
    const ilvl = ilvlStr !== '' ? parseInt(ilvlStr, 10) : (pStyle?.ilvl ?? 0);

    if (numId && numId !== '0') {
      stats.listItems++;
      const lvlDef = numberingMap.get(numId)?.get(ilvl);
      const numFmt = lvlDef?.numFmt || 'bullet';
      const isOrdered =
        numFmt === 'decimal' ||
        numFmt === 'lowerLetter' ||
        numFmt === 'upperLetter' ||
        numFmt === 'lowerRoman' ||
        numFmt === 'upperRoman';

      const indent = insideTable ? '' : '  '.repeat(Math.max(0, ilvl));
      if (isOrdered) {
        const counterKey = `${numId}:${ilvl}`;
        const nextVal = (listCounters.get(counterKey) ?? ((lvlDef?.start ?? 1) - 1)) + 1;
        listCounters.set(counterKey, nextVal);
        // Reset deeper level counters
        for (const k of listCounters.keys()) {
          const [kNum, kLvl] = k.split(':');
          if (kNum === numId && parseInt(kLvl, 10) > ilvl) {
            listCounters.delete(k);
          }
        }
        return { md: `${indent}${nextVal}. ${trimmed}`, isCode: false, extraBoxes: extraTextBoxes };
      } else {
        return { md: `${indent}- ${trimmed}`, isCode: false, extraBoxes: extraTextBoxes };
      }
    }

    // Blockquote detection
    const pBdr = pPr ? firstChild(pPr, 'pBdr') : null;
    const hasLeftBorderOnly = Boolean(pBdr && firstChild(pBdr, 'left') && !firstChild(pBdr, 'right'));
    if (!insideTable && (pStyle?.isQuote || hasLeftBorderOnly)) {
      const quoted = trimmed
        .split('\n')
        .map(l => `> ${l}`)
        .join('\n');
      return { md: quoted, isCode: false, extraBoxes: extraTextBoxes };
    }

    return { md: trimmed, isCode: false, extraBoxes: extraTextBoxes };
  };

  const convertTable = (tblEl: Element): string => {
    stats.tables++;
    const rows = directChildren(tblEl, 'tr');
    if (rows.length === 0) return '';

    const matrix: { text: string; align: 'left' | 'center' | 'right' }[][] = [];
    let maxCols = 0;

    for (const row of rows) {
      const cells = directChildren(row, 'tc');
      const rowData: { text: string; align: 'left' | 'center' | 'right' }[] = [];

      for (const cell of cells) {
        const tcPr = firstChild(cell, 'tcPr');
        const gridSpanVal = parseInt(wAttr(tcPr ? firstChild(tcPr, 'gridSpan') : null, 'val') || '1', 10);
        const span = isNaN(gridSpanVal) || gridSpanVal < 1 ? 1 : gridSpanVal;

        const vMergeEl = tcPr ? firstChild(tcPr, 'vMerge') : null;
        const isMergedContinuation = Boolean(vMergeEl && wAttr(vMergeEl, 'val') !== 'restart');

        let cellAlign: 'left' | 'center' | 'right' = 'left';
        const cellParts: string[] = [];

        if (!isMergedContinuation) {
          for (let i = 0; i < cell.children.length; i++) {
            const child = cell.children[i];
            const cn = lName(child);
            if (cn === 'p') {
              const pPr = firstChild(child, 'pPr');
              const jc = wAttr(pPr ? firstChild(pPr, 'jc') : null, 'val');
              if (jc === 'center') cellAlign = 'center';
              else if (jc === 'right' || jc === 'end') cellAlign = 'right';

              const { md } = convertParagraph(child, true);
              if (md) cellParts.push(md);
            } else if (cn === 'tbl') {
              // Nested table inside cell -> flatten cleanly with <br>
              const nestedLines: string[] = [];
              for (const nr of directChildren(child, 'tr')) {
                const nCells = directChildren(nr, 'tc').map(nc =>
                  directChildren(nc, 'p')
                    .map(np => convertParagraph(np, true).md)
                    .filter(Boolean)
                    .join(' ')
                );
                if (nCells.some(Boolean)) nestedLines.push(nCells.join(' · '));
              }
              if (nestedLines.length > 0) cellParts.push(nestedLines.join('<br>'));
            }
          }
        }

        const cellText = cellParts
          .join('<br>')
          .replace(/\|/g, '\\|')
          .replace(/\r?\n/g, '<br>')
          .trim();

        rowData.push({ text: cellText, align: cellAlign });
        for (let s = 1; s < span; s++) {
          rowData.push({ text: '', align: cellAlign });
        }
      }

      if (rowData.length > maxCols) maxCols = rowData.length;
      matrix.push(rowData);
    }

    if (maxCols === 0) return '';

    // Normalize row widths
    for (const r of matrix) {
      while (r.length < maxCols) r.push({ text: '', align: 'left' });
    }

    // Determine column alignment from data rows (or header if 1 row)
    const alignments: string[] = [];
    for (let c = 0; c < maxCols; c++) {
      let align: 'left' | 'center' | 'right' = matrix[0][c].align;
      for (let r = 1; r < matrix.length; r++) {
        if (matrix[r][c].align !== 'left') {
          align = matrix[r][c].align;
          break;
        }
      }
      alignments.push(align === 'center' ? ':---:' : align === 'right' ? '---:' : ':---');
    }

    const headerLine = `| ${matrix[0].map(c => c.text || ' ').join(' | ')} |`;
    const sepLine = `| ${alignments.join(' | ')} |`;
    const bodyLines = matrix.slice(1).map(r => `| ${r.map(c => c.text || ' ').join(' | ')} |`);

    return [headerLine, sepLine, ...bodyLines].join('\n');
  };

  const processBlockContainer = (container: Element, collectNotes: boolean): string[] => {
    const blocks: string[] = [];
    let codeBuffer: string[] = [];

    const flushCodeBuffer = () => {
      if (codeBuffer.length > 0) {
        blocks.push(`\`\`\`\n${codeBuffer.join('\n')}\n\`\`\``);
        codeBuffer = [];
      }
    };

    const walkBlocks = (node: Element) => {
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        const cn = lName(child);

        if (cn === 'sdt') {
          const sdtContent = firstChild(child, 'sdtContent');
          if (sdtContent) walkBlocks(sdtContent);
          continue;
        }
        if (cn === 'sdtcontent' || cn === 'customxml' || cn === 'ins') {
          walkBlocks(child);
          continue;
        }

        if (cn === 'p') {
          const res = convertParagraph(child, false);
          if (res.isCode) {
            codeBuffer.push(res.codeText ?? '');
          } else {
            flushCodeBuffer();
            if (res.md) blocks.push(res.md);
            if (res.extraBoxes.length > 0) {
              blocks.push(...res.extraBoxes);
            }
          }
          continue;
        }

        if (cn === 'tbl') {
          flushCodeBuffer();
          const tblMd = convertTable(child);
          if (tblMd) blocks.push(tblMd);
          continue;
        }
      }
    };

    walkBlocks(container);
    flushCodeBuffer();

    if (!collectNotes) return blocks;
    return blocks;
  };

  // Pre-scan footnotes and endnotes so references resolve cleanly
  const extractNotesMap = (notesDoc: Document | null, tagName: string, targetMap: Map<string, string>) => {
    if (!notesDoc) return;
    const all = notesDoc.getElementsByTagName('*');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (lName(el) !== tagName) continue;
      const id = wAttr(el, 'id');
      const type = wAttr(el, 'type');
      if (!id || type === 'separator' || type === 'continuationSeparator') continue;
      const lines = processBlockContainer(el, false);
      if (lines.length > 0) {
        targetMap.set(id, lines.join(' ').trim());
      }
    }
  };

  extractNotesMap(footnotesDoc, 'footnote', footnoteNotes);
  extractNotesMap(endnotesDoc, 'endnote', endnoteNotes);

  const body = documentDoc.getElementsByTagName('*');
  let bodyEl: Element | null = null;
  for (let i = 0; i < body.length; i++) {
    if (lName(body[i]) === 'body') {
      bodyEl = body[i];
      break;
    }
  }

  if (!bodyEl) {
    throw new Error('Không tìm thấy nội dung (w:body) trong tài liệu Word.');
  }

  const blocks = processBlockContainer(bodyEl, true);

  // Group consecutive list items tightly without blank lines between adjacent items
  const assembled: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const cur = blocks[i];
    const prev = assembled[assembled.length - 1];
    const isList = (s: string) => /^\s*(?:- |\d+\. )/.test(s);
    if (prev && isList(prev) && isList(cur)) {
      assembled[assembled.length - 1] = `${prev}\n${cur}`;
    } else {
      assembled.push(cur);
    }
  }

  if (usedFootnoteOrder.length > 0) {
    const fnSection = usedFootnoteOrder.map(fn => `[^${fn.label}]: ${fn.text}`).join('\n');
    assembled.push(fnSection);
  }

  const finalMd = assembled.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
  return { markdown: finalMd, stats, warnings };
}

/**
 * Parses rich HTML copied directly from Microsoft Word (Ctrl+C -> Ctrl+V),
 * including Word OMML math equations inside conditional comments,
 * MsoListParagraph nested lists, Word tables, headings, and inline styles.
 */
export function convertWordHtmlToMarkdown(
  rawHtml: string,
  options: WordConversionOptions = DEFAULT_WORD_OPTIONS
): WordConversionResult {
  const stats: WordScanStats = {
    sourceType: 'clipboard-html',
    paragraphs: 0,
    headings: 0,
    tables: 0,
    mathEquations: 0,
    listItems: 0,
    links: 0,
    footnotes: 0,
    textBoxes: 0,
    images: 0,
  };

  // 1. Extract Word OMML equations embedded in conditional comments:
  // <!--[if gte msEquation 12]><m:oMath>...</m:oMath><![endif]-->
  const mathTokens = new Map<string, string>();
  let mathCounter = 0;

  let preprocessed = rawHtml.replace(
    /<!--\[if\s+gte\s+msEquation[^\]]*\]>([\s\S]*?)<!\[endif\]-->/gi,
    (_match, inner) => {
      const isPara = /<m:oMathPara/i.test(inner);
      const latex = ommlStringToLatex(inner);
      if (!latex) return '';
      stats.mathEquations++;
      const token = `__DOCUFLOW_OMML_${mathCounter++}__`;
      mathTokens.set(token, formatMath(latex, isPara, options.mathStyle));
      return `<span data-docuflow-math="${token}">${token}</span>`;
    }
  );

  // Strip fallback images inside <!--[if !msEquation]>...<![endif]-->
  preprocessed = preprocessed.replace(/<!--\[if\s+!msEquation[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');
  // Strip fake bullet/number prefixes inside <!--[if !supportLists]-->...<!--[endif]-->
  preprocessed = preprocessed.replace(/<!--\[if\s+!supportLists[^\]]*\]>[\s\S]*?<!\[endif\]-->/gi, '');
  // Remove remaining Word conditional comments
  preprocessed = preprocessed.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/gi, '');
  preprocessed = preprocessed.replace(/<!--[\s\S]*?-->/g, '');

  const parser = new DOMParser();
  const doc = parser.parseFromString(preprocessed, 'text/html');

  // Remove style/script/xml/meta tags
  doc.querySelectorAll('style, script, xml, meta, link, title, head').forEach(el => el.remove());

  const blocks: string[] = [];
  const orderedCounters = new Map<number, number>();

  const parseStyleMap = (styleAttr: string | null): Record<string, string> => {
    const map: Record<string, string> = {};
    if (!styleAttr) return map;
    for (const decl of styleAttr.split(';')) {
      const idx = decl.indexOf(':');
      if (idx > 0) {
        map[decl.slice(0, idx).trim().toLowerCase()] = decl.slice(idx + 1).trim();
      }
    }
    return map;
  };

  const extractInlineFromHtml = (node: Node, fmt: RunFormat, insideTable: boolean): InlineSegment[] => {
    if (node.nodeType === 3) {
      const raw = (node.textContent || '').replace(/\u00A0/g, ' ').replace(/\r?\n/g, ' ');
      if (!raw) return [];
      // Restore math tokens if present
      if (raw.includes('__DOCUFLOW_OMML_')) {
        const parts = raw.split(/(__DOCUFLOW_OMML_\d+__)/g);
        const segs: InlineSegment[] = [];
        for (const part of parts) {
          if (mathTokens.has(part)) {
            segs.push({ kind: 'raw', text: mathTokens.get(part)! });
          } else if (part) {
            segs.push({ kind: 'text', text: part, format: { ...fmt } });
          }
        }
        return segs;
      }
      return [{ kind: 'text', text: raw, format: { ...fmt } }];
    }

    if (node.nodeType !== 1) return [];
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'style' || tag === 'script' || tag === 'xml') return [];
    if (tag === 'br') return [{ kind: 'break', text: '' }];

    const mathToken = el.getAttribute('data-docuflow-math');
    if (mathToken && mathTokens.has(mathToken)) {
      return [{ kind: 'raw', text: mathTokens.get(mathToken)! }];
    }

    if (tag === 'm:omath' || tag === 'omath' || tag === 'm:omathpara' || tag === 'omathpara') {
      const latex = ommlElementToLatex(el);
      if (latex) {
        stats.mathEquations++;
        const isPara = tag.includes('para') && !insideTable;
        return [{ kind: 'raw', text: formatMath(latex, isPara, options.mathStyle) }];
      }
      return [];
    }

    if (tag === 'img') {
      const alt = el.getAttribute('alt') || '';
      const src = el.getAttribute('src') || '';
      // Ignore Word 1px spacer or bullet images
      const w = parseInt(el.getAttribute('width') || '99', 10);
      if (w <= 12) return [];
      stats.images++;
      if (options.imageMode === 'ignore') return [];
      const cleanAlt = alt.replace(/[\[\]\r\n]/g, ' ').trim() || `image-${stats.images}`;
      const cleanSrc = src.startsWith('file://') || !src ? `image-${stats.images}.png` : src;
      return [{ kind: 'raw', text: `![${cleanAlt}](${cleanSrc})` }];
    }

    if (tag === 'a') {
      const href = el.getAttribute('href') || '';
      const childSegs: InlineSegment[] = [];
      const childFmt = { ...fmt, underline: false };
      for (let i = 0; i < el.childNodes.length; i++) {
        childSegs.push(...extractInlineFromHtml(el.childNodes[i], childFmt, insideTable));
      }
      const label = renderSegments(childSegs, false, insideTable).trim();
      if (href && label) {
        stats.links++;
        return [{ kind: 'raw', text: `[${label}](${href})` }];
      }
      return childSegs;
    }

    const styles = parseStyleMap(el.getAttribute('style'));
    const nextFmt: RunFormat = { ...fmt };

    if (tag === 'b' || tag === 'strong' || styles['font-weight'] === 'bold' || parseInt(styles['font-weight'] || '0', 10) >= 600) {
      nextFmt.bold = true;
    }
    if (tag === 'i' || tag === 'em' || styles['font-style'] === 'italic') {
      nextFmt.italic = true;
    }
    if (tag === 's' || tag === 'del' || tag === 'strike' || (styles['text-decoration'] || '').includes('line-through')) {
      nextFmt.strike = true;
    }
    if (tag === 'u' || (styles['text-decoration'] || '').includes('underline')) {
      nextFmt.underline = true;
    }
    if (tag === 'code' || tag === 'kbd' || tag === 'samp' || isMonospaceFont(styles['font-family'])) {
      nextFmt.code = true;
    }
    if (tag === 'sup' || styles['vertical-align'] === 'super') {
      nextFmt.sup = true;
    }
    if (tag === 'sub' || styles['vertical-align'] === 'sub') {
      nextFmt.sub = true;
    }
    if (tag === 'mark' || (styles['background'] && styles['background'] !== 'none' && styles['background'] !== 'transparent')) {
      if (tag === 'mark' || /yellow|lime|cyan|aqua/i.test(styles['background'] || '')) {
        nextFmt.highlight = true;
      }
    }

    const out: InlineSegment[] = [];
    for (let i = 0; i < el.childNodes.length; i++) {
      out.push(...extractInlineFromHtml(el.childNodes[i], nextFmt, insideTable));
    }
    return out;
  };

  const convertHtmlTable = (tbl: Element): string => {
    stats.tables++;
    const rows = Array.from(tbl.querySelectorAll(':scope > tr, :scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr'));
    if (rows.length === 0) return '';

    const matrix: { text: string; align: 'left' | 'center' | 'right' }[][] = [];
    let maxCols = 0;

    for (const row of rows) {
      const cells = Array.from(row.children).filter(c => c.tagName === 'TD' || c.tagName === 'TH');
      const rowData: { text: string; align: 'left' | 'center' | 'right' }[] = [];

      for (const cell of cells) {
        const span = Math.max(1, parseInt(cell.getAttribute('colspan') || '1', 10) || 1);
        const styles = parseStyleMap(cell.getAttribute('style'));
        const pChild = cell.querySelector('p');
        const pStyles = pChild ? parseStyleMap(pChild.getAttribute('style')) : {};
        const alignStr = (cell.getAttribute('align') || styles['text-align'] || pStyles['text-align'] || 'left').toLowerCase();
        const align: 'left' | 'center' | 'right' =
          alignStr === 'center' ? 'center' : alignStr === 'right' ? 'right' : 'left';

        // Collect block children inside cell
        const parts: string[] = [];
        const pNodes = cell.querySelectorAll(':scope > p, :scope > div, :scope > ul, :scope > ol');
        if (pNodes.length > 0) {
          pNodes.forEach(pn => {
            const pTag = pn.tagName.toLowerCase();
            if (pTag === 'ul' || pTag === 'ol') {
              pn.querySelectorAll(':scope > li').forEach((li, idx) => {
                const segs = extractInlineFromHtml(li, emptyFormat(), true);
                const txt = renderSegments(segs, options.preserveUnderline, true).trim();
                if (txt) parts.push(`${pTag === 'ol' ? `${idx + 1}.` : '-'} ${txt}`);
              });
            } else {
              const segs = extractInlineFromHtml(pn, emptyFormat(), true);
              const txt = renderSegments(segs, options.preserveUnderline, true).trim();
              if (txt) parts.push(txt);
            }
          });
        } else {
          const segs = extractInlineFromHtml(cell, emptyFormat(), true);
          const txt = renderSegments(segs, options.preserveUnderline, true).trim();
          if (txt) parts.push(txt);
        }

        const joined = parts
          .join('<br>')
          .replace(/\|/g, '\\|')
          .replace(/\r?\n/g, '<br>')
          .trim();

        rowData.push({ text: joined, align });
        for (let s = 1; s < span; s++) rowData.push({ text: '', align });
      }

      if (rowData.length > maxCols) maxCols = rowData.length;
      matrix.push(rowData);
    }

    if (maxCols === 0) return '';
    for (const r of matrix) {
      while (r.length < maxCols) r.push({ text: '', align: 'left' });
    }

    const aligns = Array.from({ length: maxCols }, (_, c) => {
      let a = matrix[0][c].align;
      for (let r = 1; r < matrix.length; r++) {
        if (matrix[r][c].align !== 'left') {
          a = matrix[r][c].align;
          break;
        }
      }
      return a === 'center' ? ':---:' : a === 'right' ? '---:' : ':---';
    });

    const header = `| ${matrix[0].map(c => c.text || ' ').join(' | ')} |`;
    const sep = `| ${aligns.join(' | ')} |`;
    const body = matrix.slice(1).map(r => `| ${r.map(c => c.text || ' ').join(' | ')} |`);
    return [header, sep, ...body].join('\n');
  };

  const walkList = (listEl: Element, depth: number): string[] => {
    const isOrdered = listEl.tagName.toLowerCase() === 'ol';
    const lines: string[] = [];
    let idx = parseInt(listEl.getAttribute('start') || '1', 10) || 1;

    for (const child of Array.from(listEl.children)) {
      if (child.tagName.toLowerCase() !== 'li') continue;
      stats.listItems++;

      const inlineSegs: InlineSegment[] = [];
      const subLists: string[] = [];

      for (const n of Array.from(child.childNodes)) {
        if (n.nodeType === 1 && ((n as Element).tagName === 'UL' || (n as Element).tagName === 'OL')) {
          subLists.push(...walkList(n as Element, depth + 1));
        } else {
          inlineSegs.push(...extractInlineFromHtml(n, emptyFormat(), false));
        }
      }

      const txt = renderSegments(inlineSegs, options.preserveUnderline, false).trim();
      const indent = '  '.repeat(depth);
      const marker = isOrdered ? `${idx++}. ` : '- ';
      if (txt) lines.push(`${indent}${marker}${txt}`);
      lines.push(...subLists);
    }

    return lines;
  };

  const walkBlocks = (container: Element) => {
    for (const child of Array.from(container.children)) {
      const tag = child.tagName.toLowerCase();
      const cls = child.getAttribute('class') || '';
      const styles = parseStyleMap(child.getAttribute('style'));

      if (tag === 'table') {
        const tMd = convertHtmlTable(child);
        if (tMd) blocks.push(tMd);
        continue;
      }

      if (tag === 'ul' || tag === 'ol') {
        const listLines = walkList(child, 0);
        if (listLines.length > 0) blocks.push(listLines.join('\n'));
        continue;
      }

      if (tag === 'pre') {
        const codeText = (child.textContent || '').replace(/\r\n/g, '\n').trimEnd();
        if (codeText) blocks.push(`\`\`\`\n${codeText}\n\`\`\``);
        continue;
      }

      if (tag === 'hr') {
        blocks.push('---');
        continue;
      }

      if (tag === 'blockquote') {
        const innerSegs = extractInlineFromHtml(child, emptyFormat(), false);
        const txt = renderSegments(innerSegs, options.preserveUnderline, false).trim();
        if (txt) {
          blocks.push(
            txt
              .split('\n')
              .map(l => `> ${l}`)
              .join('\n')
          );
        }
        continue;
      }

      // Headings (h1..h6 or Word MsoTitle/MsoHeading/mso-outline-level)
      const hMatch = tag.match(/^h([1-6])$/);
      let headingLvl = hMatch ? parseInt(hMatch[1], 10) : 0;
      if (!headingLvl && /MsoTitle/i.test(cls)) headingLvl = 1;
      if (!headingLvl && /MsoSubtitle/i.test(cls)) headingLvl = 2;
      if (!headingLvl && /MsoHeading([1-6])/i.test(cls)) {
        headingLvl = parseInt(cls.match(/MsoHeading([1-6])/i)![1], 10);
      }
      if (!headingLvl && styles['mso-outline-level']) {
        const ol = parseInt(styles['mso-outline-level'], 10);
        if (ol >= 1 && ol <= 6) headingLvl = ol;
      }

      if (headingLvl >= 1 && headingLvl <= 6) {
        const segs = extractInlineFromHtml(child, emptyFormat(), false);
        let txt = renderSegments(segs, options.preserveUnderline, false).trim();
        if (txt.startsWith('**') && txt.endsWith('**') && txt.indexOf('**', 2) === txt.length - 2) {
          txt = txt.slice(2, -2).trim();
        }
        if (txt) {
          stats.headings++;
          stats.paragraphs++;
          blocks.push(`${'#'.repeat(headingLvl)} ${txt}`);
        }
        continue;
      }

      // Word MsoListParagraph detection
      const msoList = styles['mso-list'] || '';
      if (/MsoListParagraph/i.test(cls) || msoList) {
        const lvlMatch = msoList.match(/level(\d+)/i);
        const depth = lvlMatch ? Math.max(0, parseInt(lvlMatch[1], 10) - 1) : 0;
        const segs = extractInlineFromHtml(child, emptyFormat(), false);
        let txt = renderSegments(segs, options.preserveUnderline, false).trim();

        // Detect if stripped list prefix left a leading bullet/number
        let isOrdered = false;
        const numPrefix = txt.match(/^(\d+)[\.\)]\s+([\s\S]+)$/);
        const bulletPrefix = txt.match(/^[•·▪▫◦o\-\*]\s+([\s\S]+)$/);
        if (numPrefix) {
          isOrdered = true;
          txt = numPrefix[2].trim();
        } else if (bulletPrefix) {
          txt = bulletPrefix[1].trim();
        }

        if (txt) {
          stats.listItems++;
          stats.paragraphs++;
          const indent = '  '.repeat(depth);
          if (isOrdered) {
            const count = (orderedCounters.get(depth) ?? 0) + 1;
            orderedCounters.set(depth, count);
            blocks.push(`${indent}${count}. ${txt}`);
          } else {
            blocks.push(`${indent}- ${txt}`);
          }
        }
        continue;
      }

      // Generic container div vs paragraph
      if (tag === 'div' && child.querySelector(':scope > p, :scope > table, :scope > ul, :scope > ol, :scope > h1, :scope > h2, :scope > h3, :scope > div')) {
        walkBlocks(child);
        continue;
      }

      if (tag === 'p' || tag === 'div') {
        const segs = extractInlineFromHtml(child, emptyFormat(), false);
        const txt = renderSegments(segs, options.preserveUnderline, false).trim();
        if (txt) {
          stats.paragraphs++;
          blocks.push(txt);
        }
        continue;
      }

      walkBlocks(child);
    }
  };

  walkBlocks(doc.body);

  // Merge consecutive list lines tightly
  const assembled: string[] = [];
  for (const cur of blocks) {
    const prev = assembled[assembled.length - 1];
    const isList = (s: string) => /^\s*(?:- |\d+\. )/.test(s);
    if (prev && isList(prev) && isList(cur)) {
      assembled[assembled.length - 1] = `${prev}\n${cur}`;
    } else {
      assembled.push(cur);
    }
  }

  return {
    markdown: assembled.join('\n\n').replace(/\n{3,}/g, '\n\n').trim(),
    stats,
    warnings: [],
  };
}

/**
 * Builds a genuine, valid in-memory .docx file containing headings, formatted runs,
 * OMML math equations, nested lists, a table, a hyperlink, and a textbox callout
 * so users can test deep .docx scanning in 1 click.
 */
export async function generateSampleDocxBuffer(): Promise<ArrayBuffer> {
  const zip = new JSZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rIdLink1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://en.wikipedia.org/wiki/Geometric_progression" TargetMode="External"/>
</Relationships>`
  );

  zip.file(
    'word/styles.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr></w:style>
  <w:style w:type="paragraph" w:styleId="Quote"><w:name w:val="Quote"/></w:style>
</w:styles>`
  );

  zip.file(
    'word/numbering.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/></w:lvl>
    <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="◦"/></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="2">
    <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="2"/></w:num>
</w:numbering>`
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>CHUYÊN ĐỀ: CẤP SỐ NHÂN &amp; CÔNG THỨC OMML</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Tài liệu mẫu Word (.docx)</w:t></w:r>
      <w:r><w:t xml:space="preserve"> minh họa khả năng quét sâu công thức toán, bảng, danh sách đa cấp và liên kết. Xem thêm tại </w:t></w:r>
      <w:hyperlink r:id="rIdLink1"><w:r><w:rPr><w:u w:val="single"/></w:rPr><w:t>Geometric Progression</w:t></w:r></w:hyperlink>
      <w:r><w:t>.</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>1. Công thức tổng quát &amp; Tổng n số hạng</w:t></w:r>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Số hạng tổng quát: </w:t></w:r>
      <m:oMath>
        <m:sSub><m:e><m:r><m:t>u</m:t></m:r></m:e><m:sub><m:r><m:t>n</m:t></m:r></m:sub></m:sSub>
        <m:r><m:t>=</m:t></m:r>
        <m:sSub><m:e><m:r><m:t>u</m:t></m:r></m:e><m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>
        <m:r><m:t>·</m:t></m:r>
        <m:sSup><m:e><m:r><m:t>q</m:t></m:r></m:e><m:sup><m:r><m:t>n-1</m:t></m:r></m:sup></m:sSup>
      </m:oMath>
    </w:p>
    <w:p>
      <w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="1"/></w:numPr></w:pPr>
      <w:r><w:t xml:space="preserve">Điều kiện kẹp 3 số liên tiếp: </w:t></w:r>
      <m:oMath>
        <m:r><m:t>A·C=</m:t></m:r>
        <m:sSup><m:e><m:r><m:t>B</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>
      </m:oMath>
    </w:p>
    <w:p>
      <m:oMathPara>
        <m:oMath>
          <m:sSub><m:e><m:r><m:t>S</m:t></m:r></m:e><m:sub><m:r><m:t>n</m:t></m:r></m:sub></m:sSub>
          <m:r><m:t>=</m:t></m:r>
          <m:sSub><m:e><m:r><m:t>u</m:t></m:r></m:e><m:sub><m:r><m:t>1</m:t></m:r></m:sub></m:sSub>
          <m:r><m:t>·</m:t></m:r>
          <m:f>
            <m:num><m:r><m:t>1-</m:t></m:r><m:sSup><m:e><m:r><m:t>q</m:t></m:r></m:e><m:sup><m:r><m:t>n</m:t></m:r></m:sup></m:sSup></m:num>
            <m:den><m:r><m:t>1-q</m:t></m:r></m:den>
          </m:f>
        </m:oMath>
      </m:oMathPara>
    </w:p>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading2"/></w:pPr>
      <w:r><w:t>2. Bảng tổng hợp phương pháp</w:t></w:r>
    </w:p>
    <w:tbl>
      <w:tr>
        <w:tc><w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Dạng toán</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Công thức chuẩn</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t>Đáp số mẫu</w:t></w:r></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Tìm công bội</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><m:oMath><m:r><m:t>q=</m:t></m:r><m:f><m:num><m:r><m:t>B</m:t></m:r></m:num><m:den><m:r><m:t>A</m:t></m:r></m:den></m:f></m:oMath></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><m:oMath><m:borderBox><m:e><m:r><m:t>-3</m:t></m:r></m:e></m:borderBox></m:oMath></w:p></w:tc>
      </w:tr>
      <w:tr>
        <w:tc><w:p><w:r><w:t>Dãy nghịch đảo</w:t></w:r></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="center"/></w:pPr><m:oMath><m:r><m:t>q'=</m:t></m:r><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>q</m:t></m:r></m:den></m:f></m:oMath></w:p></w:tc>
        <w:tc><w:p><w:pPr><w:jc w:val="right"/></w:pPr><m:oMath><m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>9</m:t></m:r></m:den></m:f></m:oMath></w:p></w:tc>
      </w:tr>
    </w:tbl>
    <w:p>
      <w:pPr><w:pStyle w:val="Quote"/></w:pPr>
      <w:r><w:rPr><w:i/></w:rPr><w:t>Lưu ý: Dãy có số 0 xen kẽ các số khác 0 không thể là cấp số nhân.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`
  );

  return await zip.generateAsync({ type: 'arraybuffer' });
}
