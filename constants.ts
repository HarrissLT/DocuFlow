export const SAMPLE_MARKDOWN = `# Physics & Math Demo

Here is a breakdown of *Projectiles* and complex math often found in AI responses.

## 1. Equations of Motion

The position of a projectile at time $t$ is given by:

$$
x(t) = v_0 t \\cos(\\theta)
$$

$$
y(t) = v_0 t \\sin(\\theta) - \\frac{1}{2} g t^2
$$

Where:
* $v_0$ is initial velocity
* $\\theta$ is the launch angle
* $g$ is gravity ($\\approx 9.8 m/s^2$)

## 2. Maxwell's Equations (Vector Form)

Complex display math test:

$$
\\begin{aligned}
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\epsilon_0} \\\\
\\nabla \\cdot \\mathbf{B} &= 0 \\\\
\\nabla \\times \\mathbf{E} &= -\\frac{\\partial \\mathbf{B}}{\\partial t} \\\\
\\nabla \\times \\mathbf{B} &= \\mu_0\\mathbf{J} + \\mu_0\\epsilon_0 \\frac{\\partial \\mathbf{E}}{\\partial t}
\\end{aligned}
$$

## 3. Code Implementation

Here is a Python snippet for calculating the trajectory:

\`\`\`python
import math

def calculate_position(v0, theta, t):
    g = 9.81
    theta_rad = math.radians(theta)
    
    x = v0 * t * math.cos(theta_rad)
    y = v0 * t * math.sin(theta_rad) - 0.5 * g * t**2
    return x, y

# Example usage
print(calculate_position(50, 45, 2.5))
\`\`\`

## 4. Comparison Table

| Parameter | Symbol | Unit | Notes |
| :--- | :---: | :---: | --- |
| Velocity | $v$ | $m/s$ | Vector quantity |
| Acceleration | $a$ | $m/s^2$ | Derivative of velocity |
| Force | $F$ | $N$ | $F = ma$ |

## 5. Nested Lists & Priorities

Demonstrating sub-items and ordinal markers:

*   **Main Objective**: Accuracy
    *   Verify Math formulas (Circle bullet)
        *   Check inline math
        *   Check block math (Square bullet)
    *   Verify Code blocks
*   **Secondary Objective**: Performance

1.  **Phase One**: Setup (Decimal)
    1.  Install dependencies (Lower Alpha)
        1.  React
        2.  Tailwind
    2.  Configure environment
2.  **Phase Two**: Deployment
`;

export const SAMPLE_LATEX = `\\documentclass[12pt,a4paper]{article}

\\usepackage[utf8]{inputenc}
\\usepackage[T5]{fontenc}
\\usepackage[vietnamese]{babel}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{geometry}
\\usepackage{enumitem}
\\usepackage{multicol}
\\usepackage{fancyhdr}

\\geometry{
    top=2cm,
    bottom=2cm,
    left=2cm,
    right=2cm
}

\\setlength{\\parindent}{0pt}
\\setlength{\\parskip}{0.3em}

\\pagestyle{fancy}
\\fancyhf{}
\\rhead{Mã đề: LP105}
\\lhead{Toán 10 - Học kì 2}
\\cfoot{\\thepage}

\\begin{document}

\\begin{center}
    {\\Large\\textbf{ĐỀ THI THẬT MÃ LP105}}\\\\[0.3em]
    {\\large\\textbf{Môn: Toán 10 (Học kì 2)}}\\\\[0.3em]
    \\textbf{Thời gian làm bài: 90 phút}
\\end{center}

\\vspace{0.5em}

\\section*{PHẦN I: TRẮC NGHIỆM KHÁCH QUAN (20 CÂU)}
\\textit{(Chọn 01 phương án đúng nhất trong các phương án A, B, C, D)}

\\textbf{Câu 1.} Tìm tập xác định của hàm số 
\\[
y = \\frac{3x - 2}{2x - 5}.
\\]

\\begin{enumerate}[label=\\Alph*.]
    \\item $D = \\mathbb{R} \\setminus \\left\\{\\dfrac{2}{3}\\right\\}$
    \\item $D = \\mathbb{R} \\setminus \\left\\{\\dfrac{5}{2}\\right\\}$
    \\item $D = \\left(\\dfrac{5}{2}; +\\infty\\right)$
    \\item $D = \\mathbb{R}$
\\end{enumerate}

\\textbf{Câu 2.} Tọa độ đỉnh của Parabol
\\[
(P): y = -x^2 + 6x - 2
\\]
là:

\\begin{enumerate}[label=\\Alph*.]
    \\item $(3; 7)$
    \\item $(-3; -29)$
    \\item $(3; -11)$
    \\item $(-3; 7)$
\\end{enumerate}

\\textbf{Câu 3.} Tập nghiệm của bất phương trình
\\[
x^2 - 7x + 10 \\le 0
\\]
là:

\\begin{enumerate}[label=\\Alph*.]
    \\item $(-\\infty; 2] \\cup [5; +\\infty)$
    \\item $(2; 5)$
    \\item $[2; 5]$
    \\item $(-\\infty; 2) \\cup (5; +\\infty)$
\\end{enumerate}

\\vspace{1em}

\\begin{center}
    \\textbf{--- HẾT ---}
\\end{center}

\\end{document}
`;

export const EMPTY_PLACEHOLDER = `Paste your AI content here...

Supported features:
- **Markdown**: Headers, lists, bold, italic
- **LaTeX**: Inline ($...$) and Block ($$...$$)
- **Code**: Syntax highlighting
- **Tables**: Full formatting preserved
- **Lists**: Nested bullets and numbered lists
`;