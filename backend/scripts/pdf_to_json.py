#!/usr/bin/env python3
"""
Simple PDF to JSON question extractor for teacher uploads.
Usage: python pdf_to_json.py <pdf_path> [password]
Outputs JSON to stdout.
"""
import sys
import json
import re

def clean_text(text):
    if not text:
        return ''
    # Strip known watermarks
    text = re.sub(r'sthithapragna[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'sthithapragnasya@gmail\.com[^\n]*', '', text, flags=re.IGNORECASE)
    text = re.sub(r'CLF-C0[12]\s+Page\s+\d+[^\n]*', '', text, flags=re.IGNORECASE)
    return text.strip()

def classify_domain(text):
    text_lower = text.lower()
    scores = {
        'Cloud Concepts': sum([
            text_lower.count('cloud'), text_lower.count('benefit'),
            text_lower.count('global infrastructure'), text_lower.count('region'),
            text_lower.count('availability zone'), text_lower.count('edge location'),
            text_lower.count('scalab'), text_lower.count('elastic'),
        ]),
        'Security and Compliance': sum([
            text_lower.count('iam'), text_lower.count('security'),
            text_lower.count('compliance'), text_lower.count('encrypt'),
            text_lower.count('policy'), text_lower.count('permission'),
            text_lower.count('shield'), text_lower.count('waf'),
            text_lower.count('artifact'), text_lower.count('kms'),
        ]),
        'Technology': sum([
            text_lower.count('ec2'), text_lower.count('s3'),
            text_lower.count('lambda'), text_lower.count('rds'),
            text_lower.count('vpc'), text_lower.count('route 53'),
            text_lower.count('cloudfront'), text_lower.count('elb'),
            text_lower.count('auto scaling'), text_lower.count('dynamodb'),
            text_lower.count('sqs'), text_lower.count('sns'),
        ]),
        'Billing and Pricing': sum([
            text_lower.count('cost'), text_lower.count('pric'),
            text_lower.count('billing'), text_lower.count('reserved'),
            text_lower.count('spot'), text_lower.count('on-demand'),
            text_lower.count('saving'), text_lower.count('free tier'),
            text_lower.count('calculator'), text_lower.count('budget'),
        ]),
    }
    return max(scores, key=scores.get)

def parse_pdf(path, password=None):
    try:
        import pdfplumber
    except ImportError:
        print(json.dumps({'error': 'pdfplumber not installed'}))
        sys.exit(1)

    questions = []
    full_text = ''

    try:
        kwargs = {'password': password} if password else {}
        with pdfplumber.open(path, **kwargs) as pdf:
            for page in pdf.pages:
                t = page.extract_text()
                if t:
                    full_text += clean_text(t) + '\n'
    except Exception as e:
        print(json.dumps({'error': str(e)}))
        sys.exit(1)

    # Try to split by question number patterns: "1.", "Q1.", "Question 1", numbered lines
    blocks = re.split(r'\n(?=(?:Q(?:uestion\s*)?\d+[\.\)]\s|\d{1,3}[\.\)]\s))', full_text)

    for block in blocks:
        block = block.strip()
        if len(block) < 20:
            continue

        # Extract question number (strip it)
        block = re.sub(r'^(?:Q(?:uestion\s*)?\d+[\.\)]\s*|\d{1,3}[\.\)]\s*)', '', block).strip()

        # Find options A-E
        opt_pattern = re.compile(r'(?:^|\n)([A-E])[\.\)]\s+(.+?)(?=\n[A-E][\.\)]|\n(?:Answer|Correct|Selected|Explanation|$))', re.S)
        options_raw = opt_pattern.findall(block)

        if len(options_raw) < 2:
            continue

        # Remove options from block to get question text
        q_text = opt_pattern.sub('', block)
        # Remove answer/explanation lines from question
        q_text = re.split(r'\n(?:Answer|Correct Answer|Selected Answer|Explanation)[\s:]*', q_text, flags=re.IGNORECASE)[0]
        q_text = q_text.strip()

        if len(q_text) < 10:
            continue

        # Extract answer
        answer_match = re.search(
            r'(?:Answer|Correct Answer|Selected Answer|Suggested Answer)\s*[:\-]?\s*([A-E]{1,3})',
            block, re.IGNORECASE
        )
        correct_answer = answer_match.group(1).upper() if answer_match else None

        # Extract explanation
        exp_match = re.search(r'Explanation\s*[:\-]?\s*(.+?)(?=\n[A-E][\.\)]|$)', block, re.IGNORECASE | re.S)
        explanation = exp_match.group(1).strip() if exp_match else ''

        options = [{'label': lbl, 'text': txt.strip()} for lbl, txt in options_raw]

        domain = classify_domain(q_text + ' ' + ' '.join(t for _, t in options_raw))

        questions.append({
            'question': q_text,
            'options': options,
            'correct_answer': correct_answer,
            'explanation': explanation,
            'domain': domain,
            'has_answer': correct_answer is not None,
            'reference_url': '',
        })

    return questions

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No PDF path provided'}))
        sys.exit(1)

    pdf_path = sys.argv[1]
    password = sys.argv[2] if len(sys.argv) > 2 else None

    questions = parse_pdf(pdf_path, password)
    print(json.dumps(questions, ensure_ascii=False))
