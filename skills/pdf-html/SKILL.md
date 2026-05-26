---
name: pdf-to-html-markdown
description: Convert PDFs in the project folder into layout-faithful HTML and companion Markdown. Use this skill when the HTML must look as close to the original PDF as possible while still producing a searchable, reviewable Markdown version.
---

# PDF to HTML and Markdown — Master Skill

## 1. Purpose and Central Rule

This skill converts any PDF into:

1. **`document.html`** — a visual facsimile of the PDF that is also structurally editable.
2. **`document.css`** — all layout, typography, and positioning rules, kept separate from the HTML, unless the user explicitly requests a standalone / single-file HTML.
3. **`document.md`** — a semantic companion that preserves meaning and reading order, not visual layout.
4. **`assets/`** — all extracted images, figure crops, and fonts.
5. **`conversion-notes.md`** — every approximation, substitution, and known gap.

**Central rule:** When visual fidelity and semantic cleanliness conflict, prefer visual fidelity in HTML and semantic correctness in Markdown.

**Non-negotiable:** The HTML must be editable by a human or future tool without re-authoring the whole page. Word-span overlays over a ghosted page image are not editable. They are not acceptable as a sole output.

---

## 2. Output Contract

Write all final deliverables to:

```
./converted/<pdf-stem>/document.html
./converted/<pdf-stem>/document.css
./converted/<pdf-stem>/document.md
./converted/<pdf-stem>/assets/
./converted/<pdf-stem>/conversion-notes.md
```

If the user explicitly says they do **not** want a separate CSS file:

- Put the full stylesheet in a `<style>` block inside `document.html`
- Do **not** link `document.html` to `document.css`
- Either omit `document.css` entirely or leave a one-line stub comment that says styles were inlined by request
- Record this deviation in `conversion-notes.md`

All scratch work (scripts, extracted JSON, rendered PNGs, OCR caches, test files) goes under:

```
/tmp/pdf-to-html-markdown/<pdf-stem>-<timestamp>/
```

**Never** write helper scripts or debug files into the project root or into the output folder.

**Never** overwrite the source PDF.

Delete the temp directory after successful verification. If debug artifacts need to be retained, record the path and a 24-hour expiry in `conversion-notes.md`.

---

## 3. Toolchain for AI Agents

AI agents executing this skill should use the following tools. All are invokable via shell commands inside the temp working directory.

### 3.1 Required Dependencies — Install First

Before doing anything, verify and install the required Python packages:

```bash
# Check if pymupdf (fitz) is available; install if not
python3 -c "import fitz" 2>/dev/null || pip3 install pymupdf

# Check if Pillow is available; install if you plan to use it
python3 -c "from PIL import Image" 2>/dev/null || echo "Pillow optional"

# PyMuPDF-only fallback is acceptable when Pillow is unavailable:
# use Pixmap.pixel() / Pixmap.set_rect() for background sanitization

# For OCR fallback (only for scanned PDFs):
# brew install tesseract  (macOS)
# pip3 install pytesseract
```

### 3.2 PDF Inspection

```bash
# Page count, dimensions, PDF version
python3 -c "
import fitz, json
doc = fitz.open('INPUT.pdf')
for i, page in enumerate(doc):
    r = page.rect
    print(f'Page {i+1}: {r.width:.1f} x {r.height:.1f} pt ({r.width*96/72:.1f} x {r.height*96/72:.1f} px)')
print(f'Total pages: {len(doc)}')
"

# List all fonts used
python3 -c "
import fitz
doc = fitz.open('INPUT.pdf')
fonts = set()
for page in doc:
    for block in page.get_text('dict')['blocks']:
        if block['type'] == 0:
            for line in block['lines']:
                for span in line['spans']:
                    fonts.add((span['font'], round(span['size'],1), span['flags']))
for f in sorted(fonts):
    flags = []
    if f[2] & 2: flags.append('italic')
    if f[2] & 16: flags.append('bold')
    if f[2] & 8: flags.append('mono')
    print(f'  {f[0]}  size={f[1]}  flags={\" \".join(flags) if flags else \"normal\"}')
"

# Render all pages to PNG at 2x for inspection and asset extraction
python3 -c "
import fitz, os
doc = fitz.open('INPUT.pdf')
os.makedirs('/tmp/pdf-work/renders', exist_ok=True)
mat = fitz.Matrix(2, 2)
for i, page in enumerate(doc):
    pix = page.get_pixmap(matrix=mat)
    pix.save(f'/tmp/pdf-work/renders/page_{i+1}.png')
    print(f'Rendered page {i+1}')
"

# Inspect interactive form widgets and vector drawings
python3 -c "
import fitz
doc = fitz.open('INPUT.pdf')
for i, page in enumerate(doc, 1):
    widgets = list(page.widgets()) if page.widgets() else []
    print(f'Page {i}: widgets={len(widgets)} drawings={len(page.get_drawings())} images={len(page.get_images())}')
    for w in widgets[:10]:
        r = w.rect
        print(f'  {w.field_type_string}: {w.field_name} [{r.x0:.1f}, {r.y0:.1f}, {r.x1:.1f}, {r.y1:.1f}]')
"
```

### 3.3 Full Structure Extraction (The Critical Step)

This is where most conversions fail. You MUST extract **complete block-level data** including bounding boxes, font info, and color for every span:

```python
#!/usr/bin/env python3
"""Extract complete page structure from PDF — run from /tmp/pdf-work/"""
import fitz, json, sys

doc = fitz.open(sys.argv[1])
pages = []

for page_idx, page in enumerate(doc):
    page_data = {
        'page': page_idx + 1,
        'width_pt': page.rect.width,
        'height_pt': page.rect.height,
        'width_px': round(page.rect.width * 96 / 72, 1),
        'height_px': round(page.rect.height * 96 / 72, 1),
        'blocks': []
    }

    blocks = page.get_text('dict', flags=fitz.TEXT_PRESERVE_WHITESPACE)['blocks']

    for block in blocks:
        if block['type'] == 0:  # text block
            x0, y0, x1, y1 = block['bbox']
            # Merge all spans in all lines into one text + dominant style
            full_text = ''
            dominant_font = ''
            dominant_size = 0
            dominant_color = 0
            dominant_flags = 0
            span_count = 0

            for line in block['lines']:
                line_text = ''
                for span in line['spans']:
                    line_text += span['text']
                    span_count += 1
                    if span['size'] > dominant_size:
                        dominant_size = span['size']
                        dominant_font = span['font']
                        dominant_color = span['color']
                        dominant_flags = span['flags']
                full_text += line_text.rstrip() + '\n'

            full_text = full_text.strip()
            if not full_text:
                continue

            page_data['blocks'].append({
                'type': 'text',
                'bbox_pt': [round(x0,1), round(y0,1), round(x1,1), round(y1,1)],
                'bbox_px': [
                    round(x0 * 96/72, 1),
                    round(y0 * 96/72, 1),
                    round(x1 * 96/72, 1),
                    round(y1 * 96/72, 1)
                ],
                'text': full_text,
                'font': dominant_font,
                'size_pt': round(dominant_size, 1),
                'size_px': round(dominant_size * 96/72, 1),
                'color_hex': f'#{dominant_color:06x}',
                'is_bold': bool(dominant_flags & 16),
                'is_italic': bool(dominant_flags & 2),
                'is_mono': bool(dominant_flags & 8),
                'width_px': round((x1 - x0) * 96/72, 1),
                'height_px': round((y1 - y0) * 96/72, 1),
            })

        elif block['type'] == 1:  # image block
            x0, y0, x1, y1 = block['bbox']
            page_data['blocks'].append({
                'type': 'image',
                'bbox_pt': [round(x0,1), round(y0,1), round(x1,1), round(y1,1)],
                'bbox_px': [
                    round(x0 * 96/72, 1),
                    round(y0 * 96/72, 1),
                    round(x1 * 96/72, 1),
                    round(y1 * 96/72, 1)
                ],
                'width_px': round((x1 - x0) * 96/72, 1),
                'height_px': round((y1 - y0) * 96/72, 1),
            })

    pages.append(page_data)

with open('/tmp/pdf-work/structure.json', 'w') as f:
    json.dump(pages, f, indent=2)
print(f'Extracted {sum(len(p["blocks"]) for p in pages)} blocks from {len(pages)} pages')
```

---

## 4. CRITICAL: Semantic Tag Selection Algorithm

**THIS IS THE #1 SOURCE OF BROKEN CONVERSIONS.** Using the wrong HTML tag for a region causes catastrophic rendering failures.

### 4.1 The Problem

PDF extractors return raw text blocks with font metadata. The AI agent must decide whether each block is a heading, paragraph, caption, sidenote, footnote, table cell, page header, page footer, or figure label.

**NEVER** default everything to `<h3>`. This is the single most common failure mode and it causes:
- All text renders as bold (browser default for headings)
- Browser adds default heading margins, destroying the coordinate-based layout
- Screen readers announce everything as a heading, making the document nonsensical

### 4.2 Tag Decision Algorithm

For each extracted text block, apply these rules **in order**:

```
INPUTS:
  block.size_pt    — font size in points
  block.is_bold    — whether the dominant font is bold
  block.bbox_px    — [x0, y0, x1, y1] in CSS pixels
  block.text       — the cleaned text content
  page.width_px    — page width in CSS pixels
  page.height_px   — page height in CSS pixels
  all_blocks       — list of all text blocks on this page
  title_font_size  — the largest font size found in the document (compute from all pages)

STEP 1: Detect page number
  IF block.text matches /^\d{1,4}$/ AND
     (block.y0 > page.height_px * 0.9 OR block.y0 < page.height_px * 0.05):
    → TAG = <span class="pdf-region pdf-region--page-number">
    → Skip all further checks

STEP 2: Detect running header / footer
  IF block appears at nearly identical (y, font, size) on 3+ pages:
    → TAG = <header class="pdf-region pdf-region--running-header">
    OR TAG = <footer class="pdf-region pdf-region--running-footer">
    → Skip all further checks

STEP 3: Detect footnotes
  IF block.size_pt < body_text_size * 0.85 AND
     block.y0 > page.height_px * 0.85:
    → TAG = <footer class="pdf-region pdf-region--footnotes">

STEP 4: Detect figure captions
  IF block.text starts with /^Figure\s*\d/i OR /^Fig\.\s*\d/i OR /^Table\s*\d/i:
    → TAG = <figcaption class="pdf-region pdf-region--caption">

STEP 5: Detect figure/diagram labels
  IF block.size_pt < body_text_size * 0.75 AND
     block overlaps or is adjacent to an image block:
    → TAG = <span class="pdf-region pdf-region--label">

STEP 6: Detect sidenotes / margin notes
  IF block.x0 is in the outer 25% of the page (beyond main column boundaries):
    → TAG = <aside class="pdf-region pdf-region--sidenote">

STEP 7: Detect document title
  IF block.size_pt == title_font_size AND
     this is the first page AND
     block.text is short (< 100 chars):
    → TAG = <h1 class="pdf-region pdf-region--title">

STEP 8: Detect section headings
  IF block.size_pt > body_text_size * 1.15 AND
     block.text is short (< 150 chars) AND
     block.is_bold:
    → TAG = <h2 class="pdf-region pdf-region--heading">
  ELSE IF block.size_pt > body_text_size AND block.is_bold:
    → TAG = <h3 class="pdf-region pdf-region--heading">

STEP 9: Default — body paragraph
  → TAG = <p class="pdf-region pdf-region--paragraph">

WHERE body_text_size = the most frequently occurring font size across all blocks
```

### 4.3 MANDATORY CSS Reset for Headings

Because headings have browser default margins and font-weight, the CSS MUST reset them:

```css
/* CRITICAL: Reset heading defaults to prevent layout breaking */
.pdf-region h1, .pdf-region h2, .pdf-region h3,
.pdf-region h4, .pdf-region h5, .pdf-region h6,
h1.pdf-region, h2.pdf-region, h3.pdf-region,
h4.pdf-region, h5.pdf-region, h6.pdf-region {
  margin: 0;
  padding: 0;
  font-weight: inherit;
  font-size: inherit;
  line-height: inherit;
}
```

Without this reset, the conversion WILL fail with overlapping text.

---

## 5. CRITICAL: Text Cleaning Pipeline

**Run BEFORE writing any HTML or Markdown.** This is the second most common failure mode.

### 5.1 Mandatory Cleaning Rules (apply in order)

```python
import re

def clean_text(text: str) -> str:
    """Clean extracted PDF text. Apply to every text block."""

    # 1. Remove null bytes and control characters (except newline)
    text = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', text)

    # 2. Replace Unicode ligatures with ASCII equivalents
    ligature_map = {
        '\ufb01': 'fi', '\ufb02': 'fl', '\ufb03': 'ffi',
        '\ufb04': 'ffl', '\ufb00': 'ff',
    }
    for lig, repl in ligature_map.items():
        text = text.replace(lig, repl)

    # 3. Fix line-wrap hyphenation: "re-\nceptors" → "receptors"
    #    BUT preserve true hyphens like "well-known", "non-contractile"
    #    Rule: if hyphen is at end of a line and next line starts with lowercase, merge
    text = re.sub(r'(\w)-\s*\n\s*([a-z])', r'\1\2', text)
    #    Also fix inline artifacts: "re- ceptors"
    text = re.sub(r'(\w)- ([a-z])', r'\1\2', text)

    # 4. Fix missing spaces between words (common in PDF extraction)
    #    Pattern: lowercase followed immediately by uppercase without space
    #    e.g., "skinand" → "skin and" — BUT only when we can detect word boundaries
    #    This is tricky; be conservative. Only fix obvious patterns:
    text = re.sub(r'([a-z])([A-Z][a-z])', r'\1 \2', text)
    #    Fix period without space: "receptors.The" → "receptors. The"
    text = re.sub(r'\.([A-Z])', r'. \1', text)
    #    Fix comma without space: "pressure,and" → "pressure, and"
    text = re.sub(r',([A-Za-z])', r', \1', text)

    # 5. Collapse spaced-out glyph artifacts: "F R O M  W I K I B O O K S"
    #    Detect: sequences of single chars separated by spaces
    def collapse_spaced(match):
        letters = match.group(0).replace(' ', '')
        return letters
    text = re.sub(r'\b([A-Z]) ([A-Z])(?: ([A-Z])){2,}\b', collapse_spaced, text)

    # 6. Normalize multiple spaces to single space (preserve newlines)
    text = re.sub(r'[^\S\n]+', ' ', text)

    # 7. Strip leading/trailing whitespace per line
    text = '\n'.join(line.strip() for line in text.split('\n'))

    # 8. Remove empty lines created by cleaning
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text.strip()
```

### 5.2 Additional Cleaning for Figure/Diagram Labels

Figure labels extracted from diagrams often have concatenated text because bounding boxes overlap:

```python
def clean_diagram_label(text: str) -> str:
    """Clean labels extracted from diagrams — more aggressive spacing."""
    # Fix "Forcecontrolsignal" → "Force control signal"
    # Fix "Externalforces" → "External forces"
    # Use a word boundary heuristic: insert space before each capital letter
    # that follows a lowercase letter
    text = re.sub(r'([a-z])([A-Z])', r'\1 \2', text)
    # Fix "Interneurons" → "Inter-neurons" only if known compound
    return text.strip()
```

### 5.3 Concatenated Multi-Line Label Fix

PDF extractors often concatenate multi-line labels into a single string without separators:

```
"Forcecontrolsignal" should be:
"Force
control
signal"
```

When a text block has a very narrow `--w` (< 60px) and the text is longer than would fit on one line, split at word boundaries or camelCase boundaries and join with `<br>`:

```python
def fix_narrow_label(text: str, width_px: float, font_size_px: float) -> str:
    """If text can't fit in its width, add line breaks."""
    # Approximate chars per line: width / (font_size * 0.6)
    chars_per_line = max(3, int(width_px / (font_size_px * 0.6)))
    if len(text) <= chars_per_line:
        return text

    # Split at word boundaries
    words = text.split()
    if len(words) <= 1:
        # Try camelCase split
        words = re.sub(r'([a-z])([A-Z])', r'\1 \2', text).split()

    lines = []
    current_line = ''
    for word in words:
        if len(current_line) + len(word) + 1 > chars_per_line and current_line:
            lines.append(current_line)
            current_line = word
        else:
            current_line = (current_line + ' ' + word).strip()
    if current_line:
        lines.append(current_line)

    return '<br>'.join(lines)
```

---

## 6. CRITICAL: Region Height Calculation

**Without explicit heights, text blocks WILL overlap.** This is the cause of the overlapping text seen in failed conversions.

### 6.1 The Problem

The PDF extractor gives you a bounding box `[x0, y0, x1, y1]`. The height is `y1 - y0`. This is the **exact** height in the PDF with the **PDF's font metrics**.

When the browser renders with a **different font** (web font vs. embedded PDF font), the text may need more or less vertical space. If more, it overflows into the next region.

### 6.2 The Solution: Use `--h` and Control Overflow

For every text region, set BOTH the position AND the height:

```html
<p class="pdf-region pdf-region--paragraph"
   style="--x:75.6px; --y:189.4px; --w:378px; --h:120px; --font-size:14.7px;">
  Body text here...
</p>
```

The CSS must use the height AND handle overflow:

```css
.pdf-region {
  position: absolute;
  left: var(--x, 0);
  top: var(--y, 0);
  width: var(--w, auto);
  height: var(--h, auto);      /* ← CRITICAL: set from bounding box */
  font-size: var(--font-size, 12px);
  line-height: var(--lh, 1.35);
  color: var(--color, #000);
  margin: 0;
  padding: 0;
  overflow: hidden;             /* ← CRITICAL: prevent overflow into adjacent regions */
  word-wrap: break-word;
  overflow-wrap: break-word;
}
```

### 6.3 Height Calculation from Bounding Box

```python
# From the extracted block:
height_px = round((bbox_pt[3] - bbox_pt[1]) * 96 / 72, 1)

# Add a small buffer (5%) for font metric differences
height_px_buffered = round(height_px * 1.05, 1)
```

### 6.4 Line Height Matching

The default browser `line-height: normal` is approximately `1.2` for most fonts. PDF text often has tighter line spacing. Calculate from the extraction data:

```python
# From fitz, each block has multiple lines. Compute actual line height:
lines = block['lines']
if len(lines) >= 2:
    line_height_pt = lines[1]['bbox'][1] - lines[0]['bbox'][1]
    font_size_pt = lines[0]['spans'][0]['size']
    line_height_ratio = round(line_height_pt / font_size_pt, 2)
else:
    line_height_ratio = 1.2  # safe default for single-line blocks
```

Set `--lh` in the inline style:
```html
style="... --lh:1.18; ..."
```

---

## 7. Figure Detection and Extraction

### 7.1 The Problem with Figures

If figures are NOT extracted as individual assets and placed as `<img>` elements, they become invisible or ghosted. A page background image at low opacity is NOT an acceptable way to show figures.

### 7.2 Detection Strategy

Detect figure regions using a combination of:

1. **Image blocks from fitz** — `block['type'] == 1` gives embedded raster images
2. **Gap analysis** — after removing all text blocks, look for large rectangular gaps where visual content exists
3. **Caption proximity** — find text blocks starting with "Figure" or "Fig." and look for the nearest image or gap region

### 7.3 Extraction Script

```python
import fitz
from PIL import Image
import os

doc = fitz.open('INPUT.pdf')
assets_dir = '/tmp/pdf-work/assets'
os.makedirs(assets_dir, exist_ok=True)

figure_map = []  # [{page, bbox_px, asset_file}, ...]

for page_idx, page in enumerate(doc):
    text_dict = page.get_text('dict')

    for block_idx, block in enumerate(text_dict['blocks']):
        if block['type'] == 1:  # embedded image
            x0, y0, x1, y1 = block['bbox']
            # Render the region at 2x scale with small padding
            pad = 4  # points of padding
            clip = fitz.Rect(max(0, x0 - pad), max(0, y0 - pad),
                             min(page.rect.width, x1 + pad),
                             min(page.rect.height, y1 + pad))
            mat = fitz.Matrix(2, 2)
            pix = page.get_pixmap(matrix=mat, clip=clip)
            fname = f'figure_p{page_idx+1}_{block_idx}.png'
            pix.save(os.path.join(assets_dir, fname))
            figure_map.append({
                'page': page_idx + 1,
                'bbox_px': [
                    round(x0 * 96/72, 1), round(y0 * 96/72, 1),
                    round(x1 * 96/72, 1), round(y1 * 96/72, 1)
                ],
                'asset': fname,
            })
            print(f'  Extracted {fname} from page {page_idx+1}')

    # Also look for large non-text regions (diagrams made of vector paths)
    # Render the whole page, mask text blocks, look for non-white rectangles
    # (This is a heuristic — note in conversion-notes.md if unreliable)
```

### 7.4 Complex Diagram Extraction (Vector-Path Figures)

Many academic PDF figures are NOT embedded raster images — they are drawn with PDF vector commands (lines, curves, fills). These won't appear in `block['type'] == 1`.

For these, you must **render the page region** containing the figure as a raster crop:

```python
def extract_figure_region(doc, page_idx, bbox_pt, padding=6):
    """Extract a figure region from a page by rendering the crop."""
    page = doc[page_idx]
    x0, y0, x1, y1 = bbox_pt
    clip = fitz.Rect(
        max(0, x0 - padding),
        max(0, y0 - padding),
        min(page.rect.width, x1 + padding),
        min(page.rect.height, y1 + padding)
    )
    mat = fitz.Matrix(3, 3)  # 3x for extra clarity on diagrams
    pix = page.get_pixmap(matrix=mat, clip=clip)
    return pix
```

**How to find figure regions when they're not image blocks:**

1. Render the page. Render the page with text removed (using `page.get_text("rawdict")` to get text blocks, then redact them from a copy of the page). The remaining visual content is figures/diagrams.
2. Look at the rendered page for large rectangular regions of visual content.
3. Use figure captions as anchors — the figure is usually directly above or to the left of its caption.

### 7.5 HTML Placement of Figures

```html
<figure class="pdf-region pdf-region--figure"
        data-page="1" data-role="figure"
        style="--x:100px; --y:480px; --w:350px; --h:290px;">
  <img src="assets/figure_p1_0.png"
       alt="Receptors in the human skin"
       style="width:100%; height:100%; object-fit:contain;">
</figure>
<figcaption class="pdf-region pdf-region--caption"
            data-page="1"
            style="--x:490px; --y:517px; --w:210px; --h:200px; --font-size:14.7px;">
  Figure 1: Receptors in the human skin: Mechanoreceptors can be free receptors or encapsulated...
</figcaption>
```

**Key rules:**
- The `<figure>` element is positioned at the figure's bounding box
- The `<img>` fills the figure container
- The `<figcaption>` is a SEPARATE positioned element (not inside the `<figure>`) to allow independent positioning matching the PDF layout
- All figure label text blocks that overlap the figure's bounding box should be REMOVED from the main text flow (they're part of the figure image)

---

## 8. Table Detection and Reconstruction

### 8.1 Detection

Tables in PDFs are usually just positioned text blocks with no explicit table markup. Detect them by:

1. **Grid alignment:** multiple text blocks at the same y-coordinate (same row) AND multiple text blocks at the same x-coordinate (same column)
2. **Horizontal lines:** PDF drawing commands that create horizontal/vertical rules between cells
3. **Caption anchor:** text starting with "Table" followed by a number

### 8.2 Reconstruction Algorithm

```python
def detect_table_blocks(blocks, tolerance=5):
    """
    Given a list of text blocks, detect which ones form a table.
    Returns list of rows, each row = list of cells.
    """
    # 1. Group blocks by y-coordinate (same row)
    rows = {}
    for block in blocks:
        y_center = (block['bbox_px'][1] + block['bbox_px'][3]) / 2
        # Find existing row within tolerance
        matched_row = None
        for row_y in rows:
            if abs(y_center - row_y) < tolerance:
                matched_row = row_y
                break
        if matched_row is not None:
            rows[matched_row].append(block)
        else:
            rows[y_center] = [block]

    # 2. Check if we have a grid: ≥2 rows with ≥2 columns each
    valid_rows = {y: cells for y, cells in rows.items() if len(cells) >= 2}
    if len(valid_rows) < 2:
        return None  # Not a table

    # 3. Sort rows by y, cells by x
    sorted_rows = []
    for y in sorted(valid_rows.keys()):
        row_cells = sorted(valid_rows[y], key=lambda b: b['bbox_px'][0])
        sorted_rows.append(row_cells)

    return sorted_rows
```

### 8.3 HTML Table Output

```html
<table class="pdf-region pdf-region--table"
       data-page="3" data-role="table"
       style="--x:79px; --y:110px; --w:595px; --font-size:14.7px;">
  <thead>
    <tr>
      <th></th>
      <th>Rapidly adapting</th>
      <th>Slowly adapting</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Surface receptor / small receptive field</td>
      <td>Hair receptor, Meissner's corpuscle: Detect an insect or a very fine vibration. Used for recognizing texture.</td>
      <td>Merkel's receptor: Used for spatial details, e.g. a round surface edge or "an X" in braille.</td>
    </tr>
    <tr>
      <td>Deep receptor / large receptive field</td>
      <td>Pacinian corpuscle: "A diffuse vibration" e.g. tapping with a pencil.</td>
      <td>Ruffini's corpuscle: "A skin stretch". Used for joint position in fingers.</td>
    </tr>
  </tbody>
</table>
```

### 8.4 Table CSS

```css
.pdf-region--table {
  border-collapse: collapse;
  font-size: var(--font-size, 11px);
}
.pdf-region--table th,
.pdf-region--table td {
  border: 1px solid #aaa;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
}
.pdf-region--table thead th {
  font-weight: bold;
  background: #f5f5f5;
}
```

### 8.5 Form-Heavy PDFs and Widget Handling

Some business PDFs are really **forms with branding**, not plain text documents. In these files:

- `page.widgets()` identifies text fields, radio buttons, checkboxes, initials, and signature fields
- `page.get_drawings()` often contains the table grid, underlines, shaded rows, dividers, and form boxes
- Reconstructing the page only from text blocks will fail even if the text extraction is perfect

For these PDFs, prefer this architecture:

1. Create a sanitized full-page background that preserves drawings, logos, icons, photos, table rules, and field outlines
2. Overlay editable HTML text on top of that sanitized background
3. Keep widget / line art in the background unless you have a strong reason to rebuild the controls in HTML
4. Remove visual placeholder artifacts from the text layer when the art layer already shows them:
   - leading `[ ]`
   - long underscore runs like `________`
   - repeated signature / initials line filler

If a form table is visually accurate and readable via the sanitized background plus text overlay, that is acceptable even when you do not reconstruct it as semantic `<table>` in HTML. The Markdown should still preserve the field labels and surrounding instructions in reading order.

---

## 9. Background Sanitization (Mandatory)

### 9.1 Why This is Mandatory

If you use a page render as a background image AND you also place HTML text over it, the user sees **doubled text** — the background image shows the text AND the HTML text shows the same text on top. The result is blurry, unreadable, and ugly.

### 9.2 Sanitization Script

```python
import fitz
from PIL import Image, ImageDraw

def create_sanitized_background(doc, page_idx, output_path, scale=2):
    """
    Create a background image with text regions masked out.
    Only non-text visual content (figures, rules, fills) remains.
    """
    page = doc[page_idx]
    mat = fitz.Matrix(scale, scale)
    pix = page.get_pixmap(matrix=mat)
    img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
    draw = ImageDraw.Draw(img)

    # Get all text blocks and mask them
    blocks = page.get_text("dict")["blocks"]
    for block in blocks:
        if block["type"] == 0:  # text block
            x0, y0, x1, y1 = block["bbox"]
            # Convert to pixel coords and add padding
            padding = 3 * scale
            rect = [
                (x0 * scale - padding, y0 * scale - padding),
                (x1 * scale + padding, y1 * scale + padding)
            ]
            # Sample background color from page edge (usually white)
            bg_color = sample_background_color(img)
            draw.rectangle(rect, fill=bg_color)

    img.save(output_path)

def sample_background_color(img, sample_size=20):
    """Sample the dominant color from image edges to determine background."""
    pixels = []
    w, h = img.size
    for x in range(sample_size):
        pixels.append(img.getpixel((x, 0)))        # top edge
        pixels.append(img.getpixel((x, h-1)))      # bottom edge
    for y in range(sample_size):
        pixels.append(img.getpixel((0, y)))         # left edge
        pixels.append(img.getpixel((w-1, y)))       # right edge

    # Return the most common color
    from collections import Counter
    return Counter(pixels).most_common(1)[0][0]
```

### 9.3 PyMuPDF-Only Sanitization Fallback

If Pillow is unavailable, you may sanitize a rendered page using only `fitz.Pixmap`:

```python
import fitz

def create_sanitized_background_no_pillow(doc, page_idx, output_path, span_rects, scale=2):
    page = doc[page_idx]
    pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)

    def avg_color(colors):
        if not colors:
            return (255, 255, 255)
        return tuple(int(sum(c[i] for c in colors) / len(colors)) for i in range(3))

    def sample_fill(rect):
        x0, y0, x1, y1 = rect
        x0 = max(0, min(pix.width - 1, x0))
        y0 = max(0, min(pix.height - 1, y0))
        x1 = max(0, min(pix.width - 1, x1))
        y1 = max(0, min(pix.height - 1, y1))
        colors = []
        pad = 2
        for x in range(max(0, x0 - pad), min(pix.width, x1 + pad + 1)):
            if y0 - pad >= 0:
                colors.append(pix.pixel(x, y0 - pad))
            if y1 + pad < pix.height:
                colors.append(pix.pixel(x, y1 + pad))
        for y in range(max(0, y0 - pad), min(pix.height, y1 + pad + 1)):
            if x0 - pad >= 0:
                colors.append(pix.pixel(x0 - pad, y))
            if x1 + pad < pix.width:
                colors.append(pix.pixel(x1 + pad, y))
        return avg_color(colors)

    for rect in span_rects:
        pix.set_rect(fitz.IRect(*rect), sample_fill(rect))

    pix.save(output_path)
```

### 9.4 When to Use Backgrounds

- **Use sanitized backgrounds** when the page has decorative elements (rules, fills, colored boxes) that are hard to reconstruct in CSS.
- **Skip backgrounds entirely** when the page is plain white with only text and figures.
- **Never** use unsanitized backgrounds — they ALWAYS cause doubled text.

### 9.5 Background CSS

When using sanitized backgrounds:

```html
<div class="pdf-page__background"
     style="background-image: url('assets/page_1_bg_clean.png')"
     aria-hidden="true"></div>
```

```css
.pdf-page__background {
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  z-index: 0;
  pointer-events: none;
}
```

---

## 10. Complete CSS Template

```css
/* === PDF Document Viewer === */

/* 1. Reset */
* { box-sizing: border-box; }

/* 2. Document container */
.pdf-document {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 24px;
  background: #e0e0e0;
  font-family: serif;  /* Match PDF default */
  min-height: 100vh;
}

/* 3. Page container */
.pdf-page {
  position: relative;
  width: var(--page-w);
  height: var(--page-h);
  background: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
  overflow: hidden;
}

/* 4. Background layer */
.pdf-page__background {
  position: absolute;
  inset: 0;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  z-index: 0;
  pointer-events: none;
}

/* 5. Content layer */
.pdf-page__content {
  position: absolute;
  inset: 0;
  z-index: 1;
}

/* 6. Base region — ALL positioned elements */
.pdf-region {
  position: absolute;
  left: var(--x, 0);
  top: var(--y, 0);
  width: var(--w, auto);
  height: var(--h, auto);
  font-size: var(--font-size, 12px);
  line-height: var(--lh, 1.35);
  color: var(--color, #000);
  margin: 0;
  padding: 0;
  overflow: hidden;
  word-wrap: break-word;
  overflow-wrap: break-word;
}

/* 7. CRITICAL: Reset heading defaults */
h1.pdf-region, h2.pdf-region, h3.pdf-region,
h4.pdf-region, h5.pdf-region, h6.pdf-region {
  margin: 0;
  padding: 0;
  font-weight: inherit;
  font-size: inherit;
  line-height: inherit;
}

/* 8. Region modifiers */
.pdf-region--title { font-weight: bold; }
.pdf-region--heading { font-weight: bold; }
.pdf-region--paragraph { font-weight: normal; }
.pdf-region--caption { font-style: italic; }
.pdf-region--sidenote { }
.pdf-region--footnotes { border-top: 0.5px solid #999; padding-top: 4px; }
.pdf-region--page-number { text-align: center; }
.pdf-region--running-header { }
.pdf-region--running-footer { }
.pdf-region--label { }

/* 9. Figure and image */
.pdf-region--figure {
  overflow: visible; /* figures may have captions extending beyond */
}
.pdf-region--figure img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 10. Tables */
.pdf-region--table {
  border-collapse: collapse;
  height: auto; /* tables control their own height */
  overflow: visible;
}
.pdf-region--table th,
.pdf-region--table td {
  border: 1px solid #aaa;
  padding: 4px 8px;
  text-align: left;
  vertical-align: top;
  font-size: var(--font-size, 11px);
}
.pdf-region--table thead th {
  font-weight: bold;
  background-color: #f5f5f5;
}

/* 11. Body defaults */
body, html {
  margin: 0;
  padding: 0;
}
```

---

## 11. Multi-Column Layout Handling

### 11.1 Column Detection

Detect columns by clustering all text blocks' x-coordinate ranges:

```python
def detect_columns(blocks, gap_threshold_px=30):
    """Detect column boundaries from text block x-coordinates."""
    # Sort blocks by x0
    sorted_blocks = sorted(blocks, key=lambda b: b['bbox_px'][0])

    # Find gaps between block x-ranges
    columns = []
    current_col = {'x_min': sorted_blocks[0]['bbox_px'][0],
                   'x_max': sorted_blocks[0]['bbox_px'][2],
                   'blocks': [sorted_blocks[0]]}

    for block in sorted_blocks[1:]:
        if block['bbox_px'][0] > current_col['x_max'] + gap_threshold_px:
            # New column
            columns.append(current_col)
            current_col = {'x_min': block['bbox_px'][0],
                           'x_max': block['bbox_px'][2],
                           'blocks': [block]}
        else:
            current_col['x_max'] = max(current_col['x_max'], block['bbox_px'][2])
            current_col['blocks'].append(block)

    columns.append(current_col)
    return columns
```

### 11.2 Reading Order

For multi-column layouts:
- In **HTML**: keep each block at its absolute (x, y) position. Reading order is visual —  left column first, then right column.
- In **Markdown**: read left column top-to-bottom first, then right column top-to-bottom. Use `<!-- Column break -->` as a separator.
- Set `data-reading-order` on each region for accessibility.

---

## 12. Coordinate System

### 12.1 PDF to CSS Conversion

PDF uses points (1pt = 1/72 inch), origin at bottom-left.
CSS uses pixels (1px = 1/96 inch at standard DPI), origin at top-left.

**For text and embedded images, fitz already returns coordinates with origin at top-left**, so you do NOT need to flip y-axis when using fitz's `get_text('dict')`.

Simple conversion:
```python
# pt to px conversion
px = pt * 96 / 72   # = pt * 1.3333...

# Page dimensions
page_w_px = round(page.rect.width * 96 / 72, 1)
page_h_px = round(page.rect.height * 96 / 72, 1)

# Block position from fitz bbox (already top-left origin)
x_px = round(bbox[0] * 96 / 72, 1)
y_px = round(bbox[1] * 96 / 72, 1)
w_px = round((bbox[2] - bbox[0]) * 96 / 72, 1)
h_px = round((bbox[3] - bbox[1]) * 96 / 72, 1)
```

---

## 13. Markdown Construction

### 13.1 Build from Structure, Not Raw Text

**NEVER** concatenate raw text blocks into Markdown. Instead:

1. Sort blocks by reading order (§11.2)
2. Apply tag classification (§4)
3. Apply text cleaning (§5)
4. Write structured Markdown based on the tag:

```
h1 → # Heading
h2 → ## Heading
h3 → ### Heading
p  → paragraph text\n\n
figure → ![caption](assets/filename.png)\n*Caption text*\n
table → | col | col |\n|---|---|\n| cell | cell |
aside → > **Note:** sidenote text
footer (footnotes) → [^1]: footnote text
header/footer (running) → <!-- omit from markdown -->
page-number → <!-- Page N -->
label → <!-- omit — part of figure -->
```

### 13.2 Minimum Quality

- Headings use `#` syntax at correct level
- Paragraphs separated by blank lines
- Tables use GFM pipe syntax (or embedded `<table>` HTML for complex tables)
- Figures referenced as `![](assets/file.png)`
- Footnotes use `[^N]:` syntax
- No hyphenation artifacts
- No spaced-letter artifacts
- No concatenated running headers
- No page numbers in body text

---

## 14. Validation Checklist

### 14.1 Pre-Delivery Visual Checks (open in browser)

- [ ] Each page matches PDF page dimensions
- [ ] NO text overlapping — each block stays within its bounding box
- [ ] Text is NOT bold unless it's bold in the PDF (check for heading misclassification)
- [ ] Multi-column layout preserved (columns not merged)
- [ ] Figures visible as foreground images, NOT just in a ghosted background
- [ ] Figure captions adjacent to correct figures
- [ ] Tables rendered as actual `<table>` elements with grid structure
- [ ] Sidenotes appear in margins, not in body text
- [ ] No doubled text (foreground + background showing same words)
- [ ] Text color matches source (not forced to black when source uses grey or other colors)
- [ ] Page numbers visible at correct positions
- [ ] No text cut off at page edges

### 14.2 Structural Checks

- [ ] `document.html` either links to `document.css` OR contains a single `<style>` block when standalone HTML was requested
- [ ] Body paragraphs are `<p>`, NOT `<h3>`
- [ ] Only actual headings use `<h1>`–`<h6>`
- [ ] CSS resets heading margins to 0
- [ ] Every region has `--h` set (height from bounding box)
- [ ] CSS has `overflow: hidden` on `.pdf-region`
- [ ] Inline style usage is controlled: geometry variables inline, and standalone mode may also use inline CSS custom properties when needed
- [ ] `data-page`, `data-role`, `data-reading-order` attributes present

### 14.3 Content Checks

- [ ] No `re- ceptors` style hyphenation artifacts
- [ ] No `F R O M` style spaced glyph artifacts
- [ ] No missing spaces (`skinand`, `Sucha`, `indicationof`)
- [ ] All figure assets exist in `assets/` and are referenced in HTML
- [ ] Markdown has proper heading hierarchy
- [ ] Markdown has proper table syntax

### 14.4 Browser Render Test

Open `document.html` in a browser and take a screenshot. Compare side-by-side with a page render from the PDF. If ANY of these are visible, fix before delivering:
- Text overlap between regions
- Bold text where the PDF has normal weight
- Ghosted/doubled text from unsanitized background
- Missing figures (white space where figure should be)
- Table rendered as overlapping text blocks
- Single-column collapse of multi-column layout

---

## 15. Known Failure Modes — Exhaustive Reference

### Text Layer

| Failure | Cause | Fix |
|---|---|---|
| All text is bold | Used `<h3>` for body paragraphs | Use `<p>`; see §4 |
| Text overlaps | No `--h` set, no `overflow:hidden` | Set height + overflow; see §6 |
| `re- ceptors` | Line-wrap hyphen not merged | Clean text; see §5.1 rule 3 |
| `skinand` | Missing space between words | Clean text; see §5.1 rule 4 |
| `F R O M` | Spaced-out glyph encoding | Clean text; see §5.1 rule 5 |
| `ﬁ` ligature | Unicode ligature not replaced | Clean text; see §5.1 rule 2 |
| `Forcecontrolsignal` | Diagram label concatenated | Fix narrow labels; see §5.3 |
| Wrong reading order | Blocks interleaved across columns | Cluster by column first; see §11 |
| Doubled text | Background image shows same text as HTML | Sanitize background; see §9 |

### Figures

| Failure | Cause | Fix |
|---|---|---|
| Figure invisible | Only in ghosted background, no `<img>` | Extract figure asset; see §7 |
| Caption detached | Caption placed pages away from figure | Bind by proximity; see §4.2 step 4 |
| Diagram labels scattered | Labels extracted as separate `<p>` blocks | Include in figure crop; see §7.4 |
| Figure clipped | Bounding box too tight | Add padding; see §7.3 |

### Tables

| Failure | Cause | Fix |
|---|---|---|
| Table as overlapping text | No table detection | Detect grid pattern; see §8 |
| Cells in wrong columns | Tolerance too tight | Adjust clustering tolerance; see §8.2 |
| Table as prose | Flattened to paragraph | Never flatten; see §8 |

### Layout

| Failure | Cause | Fix |
|---|---|---|
| Page collapsed to article | No fixed page dimensions | Use `--page-w`, `--page-h`; see §10 |
| Heading margins breaking layout | Browser default margins on `<h1>`-`<h6>` | CSS reset; see §4.3 |
| Inline style explosion | Every element has 15+ inline properties | Prefer classes or CSS custom properties; standalone mode may inline more, but keep it intentional and limited |

---

## 16. `conversion-notes.md` Template

```markdown
# Conversion Notes — <pdf-stem>

## PDF Inspection
- Type: [born-digital / scanned / mixed]
- Pages: N
- Dimensions: W × H pt (W × H px)
- Fonts: [list with substitution notes]
- Layout: [single-column / two-column / mixed]
- Features: [tables / figures / sidenotes / footnotes / color text / etc.]

## Architecture
- Selected: [A / B / C] — reason

## Text Cleaning Applied
- [x] Ligature replacement
- [x] Hyphenation repair
- [x] Spaced glyph collapse
- [x] Missing space insertion
- [x] Control character removal

## Font Substitutions
| PDF Font | Web Font | Impact |
|---|---|---|

## Figures
| ID | Page | Method | Notes |
|---|---|---|---|

## Tables
| ID | Page | Method | Notes |
|---|---|---|---|

## Background Sanitization
- [x/n/a] Applied on pages: [list]
- Pages without background: [list]

## Known Issues
- [ ] [description]

## Temp Artifacts
- Status: [deleted / retained at /tmp/... until YYYY-MM-DD]
```

---

## 17. Quick-Start Workflow Summary

1. **Inspect** — Run §3.2 commands. Record PDF type, dimensions, fonts, features.
2. **Extract** — Run §3.3 script. Get `structure.json` with all blocks + bounding boxes.
3. **Classify** — Apply §4 tag algorithm to every block. Identify headings vs. paragraphs vs. captions.
4. **Clean** — Apply §5 text cleaning to every block. Fix hyphenation, spaces, ligatures.
5. **Detect Columns** — Apply §11 to determine column layout and reading order.
6. **Detect Tables** — Apply §8 to clusters that form grid patterns.
7. **Extract Figures** — Apply §7 to get individual figure assets.
8. **Sanitize Backgrounds** (if using) — Apply §9 to create text-free backgrounds.
9. **Generate HTML** — Build `document.html` using §10 CSS template and correct tags.
10. **Generate Markdown** — Build `document.md` from structure using §13.
11. **Validate** — Run through §14 checklist. Open in browser. Compare with PDF.
12. **Fix** — If any check fails, fix and re-validate.
13. **Deliver** — Copy to `./converted/<pdf-stem>/`. Clean up `/tmp/` work directory.
