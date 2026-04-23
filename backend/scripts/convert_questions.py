#!/usr/bin/env python3
"""
Universal question converter: PDF, Word (.docx), and image (OCR) → JSON
Supports:
  1. Standard format  — numbered questions with A/B/C/D options + Answer: X on same page/block
  2. Slide-deck format — ExamTopics-style PDFs where each question occupies one page and its
                         answer/explanation appears on the very next page (odd=question, even=answer)
Usage: python convert_questions.py <file_path> <ext> [password]
Outputs JSON array to stdout.
"""
import sys
import json
import re
import os

# ── Helpers ─────────────────────────────────────────────────────────────────

def clean_text(text):
    if not text:
        return ''
    text = re.sub(r'sthithapragna[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'sthithapragnasya@gmail\.com[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'CLF-C0[12]\s+Page\s+\d+[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\x00', '', text)
    return text.strip()

def classify_domain(text):
    t = text.lower()
    scores = {
        'Cloud Concepts': (
            t.count('cloud') + t.count('benefit') + t.count('global infrastructure') +
            t.count('region') + t.count('availability zone') + t.count('edge location') +
            t.count('scalab') + t.count('elastic') + t.count('well-architected') +
            t.count('disaster recovery') + t.count('high availability')
        ),
        'Security and Compliance': (
            t.count('iam') + t.count('security') + t.count('compliance') +
            t.count('encrypt') + t.count('policy') + t.count('permission') +
            t.count('shield') + t.count('waf') + t.count('artifact') +
            t.count('kms') + t.count('mfa') + t.count('root account') +
            t.count('inspector') + t.count('guardduty') + t.count('macie')
        ),
        'Technology': (
            t.count('ec2') + t.count('s3') + t.count('lambda') + t.count('rds') +
            t.count('vpc') + t.count('route 53') + t.count('cloudfront') +
            t.count('elb') + t.count('auto scaling') + t.count('dynamodb') +
            t.count('sqs') + t.count('sns') + t.count('cloudwatch') +
            t.count('cloudtrail') + t.count('elastic beanstalk') + t.count('ecs') +
            t.count('eks') + t.count('fargate') + t.count('aurora')
        ),
        'Billing and Pricing': (
            t.count('cost') + t.count('pric') + t.count('billing') +
            t.count('reserved') + t.count('spot') + t.count('on-demand') +
            t.count('saving') + t.count('free tier') + t.count('calculator') +
            t.count('budget') + t.count('cost explorer') + t.count('support plan')
        ),
    }
    return max(scores, key=scores.get) if max(scores.values()) > 0 else 'Cloud Concepts'

# ── Format 1: Standard question blocks ──────────────────────────────────────

def parse_blocks(full_text):
    """Parse question blocks from plain text (all on same page/document)."""
    full_text = clean_text(full_text)

    blocks = re.split(
        r'\n(?=(?:Question\s+\d+|Q\s*\d+[\.\)\:]|#\s*\d+[\.\)]?|\d{1,3}[\.\)]\s+[A-Z]))',
        full_text, flags=re.IGNORECASE
    )
    if len(blocks) <= 1:
        blocks = re.split(r'\n(?=\d{1,3}[\.\)]\s)', full_text)

    questions = []
    for block in blocks:
        block = block.strip()
        if len(block) < 30:
            continue

        block = re.sub(r'^(?:Question\s+\d+[\.\:\)]?\s*|Q\s*\d+[\.\:\)]\s*|#\s*\d+[\.\)]?\s*|\d{1,3}[\.\)]\s+)', '', block, flags=re.IGNORECASE).strip()

        opt_pat = re.compile(
            r'(?m)^([A-E])[\.\)]\s+(.+?)(?=\n[A-E][\.\)]|\n(?:Answer|Correct|Selected|Explanation|Reference)|\Z)',
            re.S
        )
        options_raw = opt_pat.findall(block)

        if len(options_raw) < 2:
            continue

        first_opt_match = re.search(r'\n[A-E][\.\)]\s', block)
        q_text = block[:first_opt_match.start()].strip() if first_opt_match else ''
        q_text = re.split(r'\n(?:Answer|Correct Answer|Selected Answer|Explanation)\s*[:\-]?', q_text, flags=re.IGNORECASE)[0].strip()

        if len(q_text) < 10:
            continue

        # Handle various answer formats: "A", "AB", "A, B", "A and B", "A/B"
        ans_match = re.search(
            r'(?:Answer|Correct\s+Answer|Selected\s+Answer|Suggested\s+Answer|Correct\s+Answers?)\s*[:\-]?\s*([A-E](?:(?:\s*[,/]\s*|\s+and\s+|\s*)[A-E])*)',
            block, re.IGNORECASE
        )
        if ans_match:
            raw_letters = re.findall(r'[A-E]', ans_match.group(1).upper())
            letters = sorted(set(raw_letters))
            correct_answer = ''.join(letters) if letters else None
        else:
            correct_answer = None

        # Detect max selections from "choose/select N" hints in question text
        _num_map = {'one': 1, 'two': 2, 'three': 3, 'four': 4, '1': 1, '2': 2, '3': 3, '4': 4}
        max_sel_match = re.search(
            r'(?:choose|select|pick)\s+(?:the\s+)?(?:any\s+)?(\w+)\s+(?:of\s+the\s+following|of\s+|answer|option|correct)',
            q_text, re.IGNORECASE
        )
        max_selections = _num_map.get((max_sel_match.group(1).lower() if max_sel_match else ''), 1)
        if correct_answer and len(correct_answer) > 1:
            max_selections = max(max_selections, len(correct_answer))
        question_type = 'multi' if max_selections > 1 else 'single'

        exp_match = re.search(
            r'Explanation\s*[:\-]?\s*(.+?)(?=\n[A-E][\.\)]|Reference\s*:|$)',
            block, re.IGNORECASE | re.S
        )
        explanation = exp_match.group(1).strip() if exp_match else ''

        ref_match = re.search(r'(https?://\S+)', block)
        reference_url = ref_match.group(1) if ref_match else ''

        options = [{'label': lbl, 'text': txt.strip()} for lbl, txt in options_raw]
        domain = classify_domain(q_text + ' ' + ' '.join(t for _, t in options_raw))

        questions.append({
            'question': q_text,
            'options': options,
            'correct_answer': correct_answer,
            'explanation': explanation,
            'domain': domain,
            'reference_url': reference_url,
            'has_answer': correct_answer is not None,
            'question_type': question_type,
            'max_selections': max_selections,
        })

    return questions

# ── Format 2: Slide-deck (ExamTopics) ───────────────────────────────────────

def is_slide_deck_format(pages_text):
    """
    Detect ExamTopics-style PDFs where each question page is followed by an answer page.
    Signals: "N of M" header + "Show Answer" on odd pages, "EXPLANATION"/"Answer:" on even pages.
    Also handles format without "Show Answer" but with radio-button options ("O A.").
    """
    signals = 0
    for text in pages_text[:12]:
        if re.search(r'\d+\s+of\s+\d+', text):
            signals += 1
        if 'Show Answer' in text:
            signals += 1
        if 'EXPLANATION' in text:
            signals += 1
        # Radio-button option style: "O A." or "O B."
        if re.search(r'\bO\s+[A-D][\.\)]', text):
            signals += 1
    return signals >= 4

def _normalize_option_markers(text):
    """
    Normalise all radio/circle option markers to plain "A. " form.
    Handles OCR variants:
      - "O A. text"  / "O A.text"  → "A. text"
      - "O A text"   (no period)   → "A. text"
      - "© A. text"                → "A. text"
      - "A. text"                  → unchanged (already normalised)
    """
    # Match circle marker + letter + optional period/space
    text = re.sub(r'(?:©|°|o|O)\s+([A-E])(?:[.\)]\s*|\s+)', r'\1. ', text)
    text = re.sub(r'(?:©|°|o|O)\s*([A-E])[.\)]', r'\1. ', text)  # "O A." with no space before letter
    return text

def _parse_options_from_page(text):
    """
    Extract A/B/C/D options from a slide-deck question page.
    Handles:
      - "O A. text" / "O A.text" / "O A text"  (radio button circle, various OCR renders)
      - "© A. text"               (selected option rendered as copyright symbol)
      - "A. text" / "A.text"      (plain letter)
    Multi-line option text is collapsed.
    """
    text = _normalize_option_markers(text)

    # Find all option starts — allow optional space after the period (OCR may omit it)
    opt_starts = list(re.finditer(r'^([A-E])[.\)]\s*', text, re.MULTILINE))
    if not opt_starts:
        return []

    options = []
    for idx, m in enumerate(opt_starts):
        label = m.group(1)
        start = m.end()
        end = opt_starts[idx + 1].start() if idx + 1 < len(opt_starts) else len(text)
        raw = text[start:end]
        # Collapse whitespace / line-breaks within option text
        option_text = re.sub(r'\s+', ' ', raw).strip()
        # Strip anything after "EXPLANATION" or "Answer:" that leaked in
        option_text = re.split(r'EXPLANATION|Answer\s*:', option_text, flags=re.IGNORECASE)[0].strip()
        if option_text:
            options.append({'label': label, 'text': option_text})

    return options

def _has_options(text):
    """Check whether a page contains option lines (A/B/C/D in any OCR variant)."""
    # Handles "O A.", "O A text", "© A.", plain "A. text"
    if re.search(r'(?:©|°|O|o)\s+[A-E][\s.\)]', text):
        return True
    if re.search(r'(?:©|°|O|o)\s*[A-E][.\)]', text):
        return True
    return bool(re.search(r'^[A-E][.\)]\s*\S', text, re.MULTILINE))

def parse_slide_deck_format(pages_text):
    """
    Process ExamTopics-style page pairs:
      page[i]   = question + options  (has "Show Answer" / radio options)
      page[i+1] = answer + explanation (has "EXPLANATION" and "Answer: X")
    """
    questions = []

    # Find the first question page (skip any cover/intro pages)
    # OCR may mangle "N of 787" as "N0f 787" or similar — look broadly
    header_pat = re.compile(r'\d+\s*(?:of|0f|Of)\s*\d+', re.IGNORECASE)
    start = 0
    for idx, text in enumerate(pages_text):
        if _has_options(text) and header_pat.search(text):
            start = idx
            break

    i = start
    while i < len(pages_text) - 1:
        q_page = pages_text[i]
        a_page = pages_text[i + 1]

        # Must have options on the question page
        if not _has_options(q_page):
            i += 1
            continue

        # Must have answer on the next page
        has_answer_page = bool(re.search(r'Answer\s*:\s*[A-E]', a_page, re.IGNORECASE))
        if not has_answer_page:
            i += 1
            continue

        # ── Clean question page ─────────────────────────────────────────
        q_clean = q_page
        # Remove any line containing "Show Answer" (header of question pages)
        q_clean = re.sub(r'^[^\n]*Show\s*Answer[^\n]*\n?', '', q_clean, flags=re.IGNORECASE | re.MULTILINE)
        # Remove any line containing "Mark" that is short (<40 chars) — page header artifact
        q_clean = re.sub(r'^.{0,40}\bMark\b.{0,20}\n', '', q_clean, flags=re.IGNORECASE | re.MULTILINE)
        # Remove common header patterns with "N of M" (including OCR variants "N0f M", "N Of M")
        q_clean = re.sub(r'^\s*\d+\s*[oO0][fF]\s+\d+[^\n]*\n?', '', q_clean, flags=re.MULTILINE)
        # Remove short OCR garbage lines at start (e.g. "= oMk ©", "1678 T")
        q_clean = re.sub(r'^\s*[^A-Za-z\d\n]{0,6}[a-zA-Z]{1,5}[^A-Za-z\d\n]{0,6}\s*\n', '', q_clean)
        q_clean = clean_text(q_clean)

        # Find where options begin — normalise all circle/selection variants
        q_temp = _normalize_option_markers(q_clean)
        first_opt = re.search(r'^[A-E][.\)]\s*\S', q_temp, re.MULTILINE)
        if not first_opt:
            i += 2
            continue

        question_text = q_temp[:first_opt.start()].strip()
        # Use the normalised q_temp for option parsing (positions match after normalisation)
        options_text_norm = q_temp[first_opt.start():]

        options = _parse_options_from_page(options_text_norm)

        if len(question_text) < 15 or len(options) < 2:
            i += 2
            continue

        # ── Extract answer from answer page ────────────────────────────
        # Handle: "A", "AB", "A, B", "A and B", "A/B"
        ans_match = re.search(
            r'Answer\s*:\s*([A-E](?:(?:\s*[,/]\s*|\s+and\s+|\s*)[A-E])*)',
            a_page, re.IGNORECASE
        )
        if ans_match:
            raw_letters = re.findall(r'[A-E]', ans_match.group(1).upper())
            letters = sorted(set(raw_letters))
            correct_answer = ''.join(letters) if letters else None
        else:
            correct_answer = None

        # Detect max_selections
        _num_map = {'one': 1, 'two': 2, 'three': 3, 'four': 4, '1': 1, '2': 2, '3': 3, '4': 4}
        max_sel_match = re.search(
            r'(?:choose|select|pick)\s+(?:the\s+)?(?:any\s+)?(\w+)\s+(?:of\s+the\s+following|of\s+|answer|option|correct)',
            question_text, re.IGNORECASE
        )
        max_selections = _num_map.get((max_sel_match.group(1).lower() if max_sel_match else ''), 1)
        if correct_answer and len(correct_answer) > 1:
            max_selections = max(max_selections, len(correct_answer))
        question_type = 'multi' if max_selections > 1 else 'single'

        # Extract explanation text (everything in EXPLANATION block after the answer line)
        exp_match = re.search(
            r'EXPLANATION\s*\n(.*?)(?=Your\s+Answer\s*:|$)',
            a_page, re.DOTALL | re.IGNORECASE
        )
        explanation = ''
        if exp_match:
            explanation = exp_match.group(1).strip()
            # Remove the "Answer: X" line itself from explanation
            explanation = re.sub(r'^Answer\s*:\s*[A-E]+\s*\n?', '', explanation, flags=re.IGNORECASE).strip()
            explanation = re.sub(r'\s+', ' ', explanation).strip()

        domain = classify_domain(question_text + ' ' + ' '.join(o['text'] for o in options))

        questions.append({
            'question': question_text,
            'options': options,
            'correct_answer': correct_answer,
            'explanation': explanation,
            'domain': domain,
            'reference_url': '',
            'has_answer': correct_answer is not None,
            'question_type': question_type,
            'max_selections': max_selections,
        })

        i += 2  # advance past both pages in the pair

    return questions

# ── PDF extraction ───────────────────────────────────────────────────────────

def extract_from_pdf(path, password=None, progress_file=None):
    """Extract text page-by-page. Returns (pages_text_list, error)."""
    try:
        import pdfplumber
    except ImportError:
        return None, 'pdfplumber not installed. Run: pip install pdfplumber'

    pages_text = []
    try:
        kwargs = {'password': password} if password else {}
        with pdfplumber.open(path, **kwargs) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                pages_text.append(t or '')
    except Exception as e:
        return None, str(e)

    full_text = '\n'.join(pages_text)
    if len(full_text.strip()) < 100:
        return extract_from_pdf_ocr(path, password, progress_file=progress_file)

    return pages_text, None


def _ocr_page_task(args):
    """Worker function for parallel OCR."""
    path, page_num, password, resolution = args
    try:
        import pdfplumber
        from PIL import Image
        import pytesseract
        import io
        kwargs = {'password': password} if password else {}
        with pdfplumber.open(path, **kwargs) as pdf:
            img = pdf.pages[page_num].to_image(resolution=resolution).original
            buf = io.BytesIO()
            img.save(buf, format='PNG')
            buf.seek(0)
            return page_num, pytesseract.image_to_string(Image.open(buf)) or ''
    except Exception:
        return page_num, ''


def extract_from_pdf_ocr(path, password=None, progress_file=None):
    """OCR fallback for scanned/image PDFs using parallel workers. Returns (pages_text_list, error)."""
    try:
        import pdfplumber
        from PIL import Image
        import pytesseract
        import io
        from concurrent.futures import ThreadPoolExecutor, as_completed
    except ImportError as e:
        return None, f'OCR dependencies missing ({e}). Run: pip install pytesseract pillow'

    try:
        kwargs = {'password': password} if password else {}
        with pdfplumber.open(path, **kwargs) as pdf:
            total = len(pdf.pages)

        print(f'[OCR] Processing {total} pages with parallel workers...', file=sys.stderr)

        tasks = [(path, i, password, 150) for i in range(total)]
        results = {}
        pages_done = 0

        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {executor.submit(_ocr_page_task, t): t[1] for t in tasks}
            for future in as_completed(futures):
                page_num, text = future.result()
                results[page_num] = text
                pages_done += 1
                if progress_file and pages_done % 10 == 0:
                    try:
                        with open(progress_file, 'w') as f:
                            json.dump({'pages_done': pages_done, 'pages_total': total}, f)
                    except Exception:
                        pass

        if progress_file:
            try:
                with open(progress_file, 'w') as f:
                    json.dump({'pages_done': total, 'pages_total': total}, f)
            except Exception:
                pass

        pages_text = [results.get(i, '') for i in range(total)]
        return pages_text, None

    except Exception as e:
        return None, str(e)


def extract_from_docx(path):
    try:
        from docx import Document
    except ImportError:
        return None, 'python-docx not installed. Run: pip install python-docx'

    try:
        doc = Document(path)
        full_text = '\n'.join(p.text for p in doc.paragraphs if p.text.strip())
        return full_text, None
    except Exception as e:
        return None, str(e)


def extract_from_image(path):
    try:
        from PIL import Image
        import pytesseract
    except ImportError as e:
        return None, f'OCR dependencies missing ({e}). Run: pip install pytesseract pillow'

    try:
        img = Image.open(path)
        text = pytesseract.image_to_string(img)
        return text, None
    except Exception as e:
        return None, str(e)


# ── Entry point ──────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('file_path')
    parser.add_argument('ext')
    parser.add_argument('password', nargs='?', default=None)
    parser.add_argument('--progress-file', dest='progress_file', default=None)
    args = parser.parse_args()

    file_path = args.file_path
    ext = args.ext.lower().lstrip('.')
    password = args.password
    progress_file = args.progress_file

    questions = []
    error = None

    if ext == 'pdf':
        pages_text, error = extract_from_pdf(file_path, password, progress_file=progress_file)
        if not error:
            if is_slide_deck_format(pages_text):
                questions = parse_slide_deck_format(pages_text)
            else:
                full_text = '\n'.join(pages_text)
                questions = parse_blocks(full_text)

    elif ext in ('docx', 'doc'):
        full_text, error = extract_from_docx(file_path)
        if not error:
            questions = parse_blocks(full_text)

    elif ext in ('png', 'jpg', 'jpeg', 'tiff', 'bmp'):
        full_text, error = extract_from_image(file_path)
        if not error:
            questions = parse_blocks(full_text)

    else:
        print(json.dumps({'error': f'Unsupported file type: {ext}'}))
        sys.exit(1)

    if error:
        print(json.dumps({'error': error}))
        sys.exit(1)

    # Filter out garbage (too short, no options)
    questions = [q for q in questions if q.get('question') and len(q['question']) >= 15 and len(q.get('options', [])) >= 2]

    if not questions:
        print(json.dumps({'error': 'No questions could be extracted. Check the file format — download the PDF/Word format guide for the expected layout.'}))
        sys.exit(1)

    print(json.dumps(questions, ensure_ascii=False))
