/**
 * Converts Microsoft Word OMML (Office Math Markup Language) XML nodes
 * (<m:oMath>, <m:oMathPara>) into clean, accurate LaTeX strings.
 * Works 100% client-side on both .docx XML and Word clipboard HTML OMML fragments.
 */

const UNICODE_TO_LATEX: Record<string, string> = {
  // Operators & Relations
  '→': '\\rightarrow ',
  '←': '\\leftarrow ',
  '↔': '\\leftrightarrow ',
  '⇒': '\\Rightarrow ',
  '⇐': '\\Leftarrow ',
  '⇔': '\\Leftrightarrow ',
  '↦': '\\mapsto ',
  '≤': '\\le ',
  '≥': '\\ge ',
  '≠': '\\neq ',
  '≈': '\\approx ',
  '≡': '\\equiv ',
  '≅': '\\cong ',
  '∼': '\\sim ',
  '±': '\\pm ',
  '∓': '\\mp ',
  '×': '\\times ',
  '·': '\\cdot ',
  '⋅': '\\cdot ',
  '÷': '\\div ',
  '∞': '\\infty ',
  '∝': '\\propto ',
  '°': '^\\circ',
  '′': "'",
  '″': "''",
  '…': '\\dots ',
  '⋯': '\\cdots ',
  '⋮': '\\vdots ',
  '⋱': '\\ddots ',
  // Sets & Logic
  '∈': '\\in ',
  '∉': '\\notin ',
  '∋': '\\ni ',
  '⊂': '\\subset ',
  '⊃': '\\supset ',
  '⊆': '\\subseteq ',
  '⊇': '\\supseteq ',
  '⊄': '\\not\\subset ',
  '∪': '\\cup ',
  '∩': '\\cap ',
  '∅': '\\emptyset ',
  '∀': '\\forall ',
  '∃': '\\exists ',
  '∄': '\\nexists ',
  '¬': '\\neg ',
  '∧': '\\land ',
  '∨': '\\lor ',
  '∖': '\\setminus ',
  // Number sets
  'ℝ': '\\mathbb{R}',
  'ℕ': '\\mathbb{N}',
  'ℤ': '\\mathbb{Z}',
  'ℚ': '\\mathbb{Q}',
  'ℂ': '\\mathbb{C}',
  'ℙ': '\\mathbb{P}',
  // Calculus & Geometry
  '∂': '\\partial ',
  '∇': '\\nabla ',
  '∫': '\\int ',
  '∬': '\\iint ',
  '∭': '\\iiint ',
  '∮': '\\oint ',
  '∑': '\\sum ',
  '∏': '\\prod ',
  '√': '\\sqrt',
  '∠': '\\angle ',
  '⊥': '\\perp ',
  '∥': '\\parallel ',
  '△': '\\triangle ',
  '□': '\\square ',
  '∎': '\\blacksquare ',
  // Greek lowercase
  'α': '\\alpha ',
  'β': '\\beta ',
  'γ': '\\gamma ',
  'δ': '\\delta ',
  'ε': '\\varepsilon ',
  'ϵ': '\\epsilon ',
  'ζ': '\\zeta ',
  'η': '\\eta ',
  'θ': '\\theta ',
  'ϑ': '\\vartheta ',
  'ι': '\\iota ',
  'κ': '\\kappa ',
  'λ': '\\lambda ',
  'μ': '\\mu ',
  'ν': '\\nu ',
  'ξ': '\\xi ',
  'π': '\\pi ',
  'ϖ': '\\varpi ',
  'ρ': '\\rho ',
  'ϱ': '\\varrho ',
  'σ': '\\sigma ',
  'ς': '\\varsigma ',
  'τ': '\\tau ',
  'υ': '\\upsilon ',
  'φ': '\\varphi ',
  'ϕ': '\\phi ',
  'χ': '\\chi ',
  'ψ': '\\psi ',
  'ω': '\\omega ',
  // Greek uppercase
  'Γ': '\\Gamma ',
  'Δ': '\\Delta ',
  'Θ': '\\Theta ',
  'Λ': '\\Lambda ',
  'Ξ': '\\Xi ',
  'Π': '\\Pi ',
  'Σ': '\\Sigma ',
  'Υ': '\\Upsilon ',
  'Φ': '\\Phi ',
  'Ψ': '\\Psi ',
  'Ω': '\\Omega ',
  // Brackets
  '⟨': '\\langle ',
  '⟩': '\\rangle ',
  '⌈': '\\lceil ',
  '⌉': '\\rceil ',
  '⌊': '\\lfloor ',
  '⌋': '\\rfloor ',
  // Non-breaking & thin spaces
  '\u00A0': ' ',
  '\u2009': '\\,',
  '\u2002': '\\ ',
  '\u2003': '\\quad ',
};

const KNOWN_FUNCTIONS = new Set([
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'lg', 'exp', 'lim', 'limsup', 'liminf',
  'max', 'min', 'sup', 'inf', 'det', 'dim', 'gcd', 'lcm',
  'arg', 'deg', 'hom', 'ker', 'Pr', 'mod',
]);

function localName(node: Node | null | undefined): string {
  if (!node || node.nodeType !== 1) return '';
  const el = node as Element;
  const raw = el.localName || el.tagName || '';
  const colonIdx = raw.indexOf(':');
  return (colonIdx >= 0 ? raw.slice(colonIdx + 1) : raw).toLowerCase();
}

function getDirectChildren(el: Element, name?: string): Element[] {
  const result: Element[] = [];
  for (let i = 0; i < el.children.length; i++) {
    const child = el.children[i];
    if (!name || localName(child) === name.toLowerCase()) {
      result.push(child);
    }
  }
  return result;
}

function getFirstChild(el: Element, name: string): Element | null {
  for (let i = 0; i < el.children.length; i++) {
    if (localName(el.children[i]) === name.toLowerCase()) {
      return el.children[i];
    }
  }
  return null;
}

function getAttrVal(el: Element | null, attrName = 'val'): string {
  if (!el) return '';
  return (
    el.getAttribute(`m:${attrName}`) ??
    el.getAttribute(`w:${attrName}`) ??
    el.getAttribute(attrName) ??
    ''
  );
}

function convertTextTokens(rawText: string, style: string): string {
  if (!rawText) return '';

  // Plain text style (m:sty m:val="p") or text containing multi-letter non-math Vietnamese/words
  const hasNonAsciiLetters = /[\u00C0-\u024F\u1E00-\u1EFF]/.test(rawText);
  if (style === 'p' || hasNonAsciiLetters) {
    // Still convert embedded math symbols if mixed, otherwise wrap in \text{...}
    if (style === 'p' && !/[→←↔⇒⇐⇔≤≥≠≈±×·÷∞∈∉⊂⊆∪∩∅∀∃∂∇]/.test(rawText)) {
      const escaped = rawText
        .replace(/\\/g, '\\textbackslash ')
        .replace(/([{}%$&_#])/g, '\\$1');
      return `\\text{${escaped}}`;
    }
  }

  let out = '';
  for (const ch of rawText) {
    if (UNICODE_TO_LATEX[ch]) {
      out += UNICODE_TO_LATEX[ch];
    } else if (ch === '{' || ch === '}') {
      out += `\\${ch}`;
    } else {
      out += ch;
    }
  }

  if (style === 'b') {
    return `\\mathbf{${out.trim()}}`;
  }
  if (style === 'bi') {
    return `\\boldsymbol{${out.trim()}}`;
  }

  return out;
}

function needsBracesForScript(latex: string): boolean {
  const trimmed = latex.trim();
  if (!trimmed) return true;
  if (trimmed.length === 1 && /[a-zA-Z0-9]/.test(trimmed)) return false;
  return true;
}

function wrapBaseForScript(base: string): string {
  const trimmed = base.trim();
  if (!trimmed) return '{}';
  if (/^[a-zA-Z0-9]$/.test(trimmed)) return trimmed;
  if (/^\\[a-zA-Z]+$/.test(trimmed)) return trimmed;
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed;
  return `{${trimmed}}`;
}

function formatScriptArg(arg: string): string {
  const trimmed = arg.trim();
  if (!trimmed) return '{}';
  return needsBracesForScript(trimmed) ? `{${trimmed}}` : trimmed;
}

function escapeDelimiter(chr: string, isLeft: boolean): string {
  if (!chr) return '.';
  if (chr === '{') return '\\{';
  if (chr === '}') return '\\}';
  if (chr === '|') return '|';
  if (chr === '‖' || chr === '||') return '\\|';
  if (chr === '⟨') return '\\langle ';
  if (chr === '⟩') return '\\rangle ';
  if (chr === '⌈') return '\\lceil ';
  if (chr === '⌉') return '\\rceil ';
  if (chr === '⌊') return '\\lfloor ';
  if (chr === '⌋') return '\\rfloor ';
  if (chr === '(' || chr === ')' || chr === '[' || chr === ']') return chr;
  return isLeft ? chr : chr;
}

function convertChildren(el: Element): string {
  let out = '';
  for (let i = 0; i < el.children.length; i++) {
    out += convertOmmlNode(el.children[i]);
  }
  return out;
}

function convertOmmlNode(node: Element): string {
  const name = localName(node);

  switch (name) {
    case 'omathpara': {
      const maths = getDirectChildren(node, 'oMath');
      if (maths.length === 0) return convertChildren(node).trim();
      if (maths.length === 1) return convertOmmlNode(maths[0]).trim();
      return `\\begin{aligned}\n${maths.map(m => convertOmmlNode(m).trim()).join(' \\\\\n')}\n\\end{aligned}`;
    }

    case 'omath':
    case 'e':
    case 'num':
    case 'den':
    case 'sup':
    case 'sub':
    case 'deg':
    case 'lim':
    case 'fname': {
      return convertChildren(node);
    }

    case 'r': {
      const rPr = getFirstChild(node, 'rPr');
      const styEl = rPr ? getFirstChild(rPr, 'sty') : null;
      const scrEl = rPr ? getFirstChild(rPr, 'scr') : null;
      const sty = getAttrVal(styEl);
      const scr = getAttrVal(scrEl);

      let raw = '';
      for (let i = 0; i < node.children.length; i++) {
        const ch = node.children[i];
        if (localName(ch) === 't') {
          raw += ch.textContent || '';
        }
      }
      if (!raw) return '';

      if (scr === 'double-struck') {
        return `\\mathbb{${raw}}`;
      }
      if (scr === 'script') {
        return `\\mathcal{${raw}}`;
      }
      if (scr === 'fraktur') {
        return `\\mathfrak{${raw}}`;
      }

      return convertTextTokens(raw, sty);
    }

    case 't': {
      return convertTextTokens(node.textContent || '', '');
    }

    case 'f': {
      const fPr = getFirstChild(node, 'fPr');
      const typeVal = getAttrVal(fPr ? getFirstChild(fPr, 'type') : null);
      const num = convertOmmlNode(getFirstChild(node, 'num') || node).trim();
      const den = convertOmmlNode(getFirstChild(node, 'den') || node).trim();

      if (typeVal === 'noBar') {
        return `\\binom{${num}}{${den}}`;
      }
      if (typeVal === 'lin') {
        return `${num}/${den}`;
      }
      if (typeVal === 'skw') {
        return `{}^{${num}}/{}_{${den}}`;
      }
      return `\\frac{${num}}{${den}}`;
    }

    case 'ssup': {
      const eEl = getFirstChild(node, 'e');
      const supEl = getFirstChild(node, 'sup');
      const base = eEl ? convertOmmlNode(eEl) : '';
      const sup = supEl ? convertOmmlNode(supEl) : '';
      return `${wrapBaseForScript(base)}^${formatScriptArg(sup)}`;
    }

    case 'ssub': {
      const eEl = getFirstChild(node, 'e');
      const subEl = getFirstChild(node, 'sub');
      const base = eEl ? convertOmmlNode(eEl) : '';
      const sub = subEl ? convertOmmlNode(subEl) : '';
      return `${wrapBaseForScript(base)}_${formatScriptArg(sub)}`;
    }

    case 'ssubsup': {
      const eEl = getFirstChild(node, 'e');
      const subEl = getFirstChild(node, 'sub');
      const supEl = getFirstChild(node, 'sup');
      const base = eEl ? convertOmmlNode(eEl) : '';
      const sub = subEl ? convertOmmlNode(subEl) : '';
      const sup = supEl ? convertOmmlNode(supEl) : '';
      return `${wrapBaseForScript(base)}_${formatScriptArg(sub)}^${formatScriptArg(sup)}`;
    }

    case 'spre': {
      const eEl = getFirstChild(node, 'e');
      const subEl = getFirstChild(node, 'sub');
      const supEl = getFirstChild(node, 'sup');
      const base = eEl ? convertOmmlNode(eEl) : '';
      const sub = subEl ? convertOmmlNode(subEl) : '';
      const sup = supEl ? convertOmmlNode(supEl) : '';
      return `{}_${formatScriptArg(sub)}^${formatScriptArg(sup)}${base}`;
    }

    case 'rad': {
      const radPr = getFirstChild(node, 'radPr');
      const degHide = getAttrVal(radPr ? getFirstChild(radPr, 'degHide') : null);
      const degEl = getFirstChild(node, 'deg');
      const eEl = getFirstChild(node, 'e');
      const deg = degEl ? convertOmmlNode(degEl).trim() : '';
      const e = eEl ? convertOmmlNode(eEl).trim() : '';
      if (!deg || degHide === '1' || degHide === 'on' || degHide === 'true') {
        return `\\sqrt{${e}}`;
      }
      return `\\sqrt[${deg}]{${e}}`;
    }

    case 'nary': {
      const naryPr = getFirstChild(node, 'naryPr');
      const chr = getAttrVal(naryPr ? getFirstChild(naryPr, 'chr') : null) || '∫';
      const subHide = getAttrVal(naryPr ? getFirstChild(naryPr, 'subHide') : null);
      const supHide = getAttrVal(naryPr ? getFirstChild(naryPr, 'supHide') : null);
      const op = UNICODE_TO_LATEX[chr] || '\\int ';

      const subEl = getFirstChild(node, 'sub');
      const supEl = getFirstChild(node, 'sup');
      const eEl = getFirstChild(node, 'e');

      const sub = subEl && subHide !== '1' ? convertOmmlNode(subEl).trim() : '';
      const sup = supEl && supHide !== '1' ? convertOmmlNode(supEl).trim() : '';
      const e = eEl ? convertOmmlNode(eEl).trim() : '';

      let res = op.trimEnd();
      if (sub) res += `_${formatScriptArg(sub)}`;
      if (sup) res += `^${formatScriptArg(sup)}`;
      return `${res} ${e}`;
    }

    case 'd': {
      const dPr = getFirstChild(node, 'dPr');
      const begEl = dPr ? getFirstChild(dPr, 'begChr') : null;
      const endEl = dPr ? getFirstChild(dPr, 'endChr') : null;
      const sepEl = dPr ? getFirstChild(dPr, 'sepChr') : null;

      // Important: if begChr/endChr element exists with val="", it means NO delimiter!
      const beg = begEl ? getAttrVal(begEl) : '(';
      const end = endEl ? getAttrVal(endEl) : ')';
      const sep = sepEl ? getAttrVal(sepEl) : '|';

      const eEls = getDirectChildren(node, 'e');

      // Detect system of equations: { followed by matrix or eqArr with empty endChr
      if (beg === '{' && !end && eEls.length === 1) {
        const innerChild = eEls[0].children[0];
        const innerName = localName(innerChild);
        if (innerName === 'eqarr' || innerName === 'm') {
          const rows =
            innerName === 'eqarr'
              ? getDirectChildren(innerChild, 'e').map(r => convertOmmlNode(r).trim())
              : getDirectChildren(innerChild, 'mr').map(mr =>
                  getDirectChildren(mr, 'e')
                    .map(c => convertOmmlNode(c).trim())
                    .join(' & ')
                );
          return `\\begin{cases} ${rows.join(' \\\\ ')} \\end{cases}`;
        }
      }

      // Detect matrix directly inside delimiters: (m), [m], |m|
      if (eEls.length === 1 && eEls[0].children.length === 1 && localName(eEls[0].children[0]) === 'm') {
        const mEl = eEls[0].children[0];
        const rows = getDirectChildren(mEl, 'mr').map(mr =>
          getDirectChildren(mr, 'e')
            .map(c => convertOmmlNode(c).trim())
            .join(' & ')
        );
        const body = rows.join(' \\\\ ');
        if (beg === '(' && end === ')') return `\\begin{pmatrix} ${body} \\end{pmatrix}`;
        if (beg === '[' && end === ']') return `\\begin{bmatrix} ${body} \\end{bmatrix}`;
        if (beg === '|' && end === '|') return `\\begin{vmatrix} ${body} \\end{vmatrix}`;
        if (beg === '{' && end === '}') return `\\begin{Bmatrix} ${body} \\end{Bmatrix}`;
      }

      const inner = eEls.map(e => convertOmmlNode(e).trim()).join(` ${sep} `);
      const needsStretch = /\\(frac|dfrac|sum|prod|int|sqrt|begin|binom)/.test(inner);
      const l = escapeDelimiter(beg, true);
      const r = escapeDelimiter(end, false);

      if (needsStretch || l === '.' || r === '.') {
        return `\\left${l}${inner}\\right${r}`;
      }
      return `${l}${inner}${r}`;
    }

    case 'm': {
      const rows = getDirectChildren(node, 'mr').map(mr =>
        getDirectChildren(mr, 'e')
          .map(c => convertOmmlNode(c).trim())
          .join(' & ')
      );
      return `\\begin{matrix} ${rows.join(' \\\\ ')} \\end{matrix}`;
    }

    case 'eqarr': {
      const lines = getDirectChildren(node, 'e').map(e => convertOmmlNode(e).trim());
      if (lines.length <= 1) return lines.join('');
      return `\\begin{aligned} ${lines.join(' \\\\ ')} \\end{aligned}`;
    }

    case 'func': {
      const fNameEl = getFirstChild(node, 'fName');
      const eEl = getFirstChild(node, 'e');
      let fName = fNameEl ? convertOmmlNode(fNameEl).trim() : '';
      const e = eEl ? convertOmmlNode(eEl).trim() : '';

      const cleanName = fName.replace(/^\\text\{(.*)\}$/, '$1').trim();
      if (KNOWN_FUNCTIONS.has(cleanName)) {
        fName = `\\${cleanName}`;
      }
      return `${fName} ${e}`.trim();
    }

    case 'limlow': {
      const eEl = getFirstChild(node, 'e');
      const limEl = getFirstChild(node, 'lim');
      const base = eEl ? convertOmmlNode(eEl).trim() : '';
      const lim = limEl ? convertOmmlNode(limEl).trim() : '';
      const cleanBase = base.replace(/^\\text\{(.*)\}$/, '$1').trim();
      if (cleanBase === 'lim' || cleanBase === '\\lim') {
        return `\\lim_{${lim}}`;
      }
      return `\\underset{${lim}}{${base}}`;
    }

    case 'limupp': {
      const eEl = getFirstChild(node, 'e');
      const limEl = getFirstChild(node, 'lim');
      const base = eEl ? convertOmmlNode(eEl).trim() : '';
      const lim = limEl ? convertOmmlNode(limEl).trim() : '';
      return `\\overset{${lim}}{${base}}`;
    }

    case 'acc': {
      const accPr = getFirstChild(node, 'accPr');
      const chr = getAttrVal(accPr ? getFirstChild(accPr, 'chr') : null) || '̂';
      const eEl = getFirstChild(node, 'e');
      const e = eEl ? convertOmmlNode(eEl).trim() : '';
      const map: Record<string, string> = {
        '\u20D7': '\\vec',
        '\u20D6': '\\overleftarrow',
        '\u20E1': '\\overleftrightarrow',
        '\u0302': '\\hat',
        '^': '\\hat',
        '\u0304': '\\bar',
        '\u0305': '\\overline',
        '\u0303': '\\tilde',
        '~': '\\tilde',
        '\u0307': '\\dot',
        '\u0308': '\\ddot',
      };
      const cmd = map[chr] || (e.length > 1 ? '\\widehat' : '\\hat');
      if (cmd === '\\vec' && e.length > 1) {
        return `\\overrightarrow{${e}}`;
      }
      if (cmd === '\\bar' && e.length > 1) {
        return `\\overline{${e}}`;
      }
      return `${cmd}{${e}}`;
    }

    case 'bar': {
      const barPr = getFirstChild(node, 'barPr');
      const pos = getAttrVal(barPr ? getFirstChild(barPr, 'pos') : null) || 'top';
      const eEl = getFirstChild(node, 'e');
      const e = eEl ? convertOmmlNode(eEl).trim() : '';
      return pos === 'bot' ? `\\underline{${e}}` : `\\overline{${e}}`;
    }

    case 'borderbox': {
      const eEl = getFirstChild(node, 'e');
      const e = eEl ? convertOmmlNode(eEl).trim() : '';
      return `\\boxed{${e}}`;
    }

    case 'box': {
      const eEl = getFirstChild(node, 'e');
      return eEl ? convertOmmlNode(eEl).trim() : '';
    }

    case 'groupchr': {
      const gcPr = getFirstChild(node, 'groupChrPr');
      const pos = getAttrVal(gcPr ? getFirstChild(gcPr, 'pos') : null) || 'bot';
      const eEl = getFirstChild(node, 'e');
      const e = eEl ? convertOmmlNode(eEl).trim() : '';
      return pos === 'top' ? `\\overbrace{${e}}` : `\\underbrace{${e}}`;
    }

    case 'phant': {
      const eEl = getFirstChild(node, 'e');
      return eEl ? convertOmmlNode(eEl) : '';
    }

    // Skip property nodes
    case 'omathparapr':
    case 'fpr':
    case 'rpr':
    case 'ctrlpr':
    case 'dpr':
    case 'radpr':
    case 'narypr':
    case 'accpr':
    case 'barpr':
    case 'boxpr':
    case 'borderboxpr':
    case 'groupchrpr':
    case 'mpr':
    case 'eqarrpr':
    case 'funcpr':
    case 'limlowpr':
    case 'limupppr':
    case 'ssuppr':
    case 'ssubpr':
    case 'ssubsuppr':
    case 'sprepr':
    case 'argpr':
      return '';

    default:
      return convertChildren(node);
  }
}

/**
 * Normalizes spacing in generated LaTeX so expressions look crisp.
 */
function cleanLatex(raw: string): string {
  return raw
    .replace(/\s{2,}/g, ' ')
    .replace(/\{\s+/g, '{')
    .replace(/\s+\}/g, '}')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim();
}

export function ommlElementToLatex(el: Element): string {
  const result = convertOmmlNode(el);
  return cleanLatex(result);
}

/**
 * Converts an OMML XML string snippet (e.g. extracted from Word clipboard HTML) to LaTeX.
 */
export function ommlStringToLatex(xmlSnippet: string): string {
  try {
    // Strip namespaces or add dummy math namespace so DOMParser parses cleanly
    const wrapped = `<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">${xmlSnippet}</root>`;
    const parser = new DOMParser();
    const doc = parser.parseFromString(wrapped, 'application/xml');
    if (doc.querySelector('parsererror')) {
      // Fallback: parse as HTML if XML parser hits unclosed Word tags
      const htmlDoc = parser.parseFromString(xmlSnippet, 'text/html');
      const mathEl = htmlDoc.body.firstElementChild;
      return mathEl ? cleanLatex(convertOmmlNode(mathEl)) : '';
    }
    const root = doc.documentElement;
    return cleanLatex(convertChildren(root));
  } catch {
    return '';
  }
}
