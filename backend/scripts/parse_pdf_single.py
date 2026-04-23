#!/usr/bin/env python3
"""Helper script for parsing a single PDF uploaded by admin."""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../scripts'))
from parse_questions import parse_multi_format, parse_one_per_two_format, clean_text
import json

def main():
    if len(sys.argv) < 3:
        print("Usage: parse_pdf_single.py <input.pdf> <output.json>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    output_path = sys.argv[2]
    source_name = os.path.basename(pdf_path)

    # Try multi-format first, fall back to one_per_two
    qs = parse_multi_format(pdf_path, None, source_name)
    if len(qs) < 5:
        qs = parse_one_per_two_format(pdf_path, None, source_name)

    for i, q in enumerate(qs, 1):
        q['id'] = i

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(qs, f, ensure_ascii=False, indent=2)

    print(f"Parsed {len(qs)} questions -> {output_path}")

if __name__ == '__main__':
    main()
