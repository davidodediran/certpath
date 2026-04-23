#!/usr/bin/env python3
"""
AWS Exam Question PDF Parser
Extracts questions from PDF files and outputs a clean JSON question bank.
"""
import os
import re
import json
import sys
import hashlib

try:
    import pdfplumber
except ImportError:
    print("Installing pdfplumber...")
    os.system("pip install pdfplumber")
    import pdfplumber

# ─────────────────────────────────────────────
# CONFIG
# ─────────────────────────────────────────────
PDF_PASSWORD = "sthithapragnasya@gmail.com"
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "..", "backend", "data", "questions.json")

PDFS = [
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\1.1-987.pdf",       "password": None,         "format": "multi"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\2.988-1115.pdf",     "password": None,         "format": "multi"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\3.1116-1207.pdf",    "password": None,         "format": "multi"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\4.1208-1284-DEC-JAN-2024.pdf", "password": None, "format": "multi"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\5.1285-1361-JAN-2024.pdf", "password": None,   "format": "multi"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\6.APRIL-2024.pdf",   "password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\7.MAY-2024.pdf",     "password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\8.MAY-JUNE-2024.pdf","password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\9.JUNE-2024.pdf",    "password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\10.JULY-2024.pdf",   "password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\11.AUG-2024.pdf",    "password": PDF_PASSWORD, "format": "one_per_two"},
    {"path": r"C:\Users\USER\Music\AWS\CLF-C02_ AWS Certified Cloud Practitioner\12.SEP-2024.pdf",    "password": PDF_PASSWORD, "format": "one_per_two"},
]

# ─────────────────────────────────────────────
# DOMAIN CLASSIFICATION
# ─────────────────────────────────────────────
DOMAIN_KEYWORDS = {
    "Cloud Concepts": [
        "cloud computing", "well-architected", "cloud adoption", "cloud benefits",
        "elasticity", "scalability", "agility", "availability zone", "region",
        "high availability", "fault tolerant", "disaster recovery", "global infrastructure",
        "on-premises", "hybrid", "migration", "six advantages", "economies of scale",
        "pay-as-you-go", "stop guessing", "trade fixed", "massive economies",
        "cloud native", "architectural design", "operational excellence", "reliability",
        "performance efficiency", "cost optimization", "sustainability", "aws caf",
        "cloud adoption framework", "cloud transformation"
    ],
    "Security and Compliance": [
        "iam", "identity", "access management", "policy", "role", "permission",
        "kms", "key management", "encryption", "compliance", "mfa", "multi-factor",
        "shield", "waf", "web application firewall", "guardduty", "macie",
        "security group", "nacl", "network acl", "shared responsibility",
        "artifact", "soc", "pci", "hipaa", "gdpr", "audit", "inspector",
        "detective", "firewall", "ddos", "threat", "vulnerability", "secret",
        "certificate", "acm", "cognito", "single sign-on", "directory service",
        "ram", "organizations", "control tower", "security hub", "access analyzer"
    ],
    "Technology": [
        "ec2", "s3", "rds", "dynamodb", "lambda", "cloudfront", "vpc",
        "route 53", "route53", "elastic load balancing", "elb", "alb", "nlb",
        "ecs", "fargate", "eks", "elastic beanstalk", "cloudwatch", "cloudtrail",
        "sns", "sqs", "kinesis", "api gateway", "step functions", "eventbridge",
        "aurora", "redshift", "elasticache", "opensearch", "athena", "glue",
        "emr", "sagemaker", "rekognition", "comprehend", "forecast", "personalize",
        "lex", "polly", "transcribe", "textract", "bedrock", "codewhisperer",
        "codepipeline", "codecommit", "codebuild", "codedeploy", "cloudformation",
        "cdk", "systems manager", "opsworks", "config", "trusted advisor",
        "service catalog", "outposts", "wavelength", "local zones", "edge location",
        "global accelerator", "direct connect", "vpn", "transit gateway",
        "storage gateway", "datasync", "transfer family", "backup", "snowball",
        "snowflake", "fsx", "efs", "ebs", "glacier", "lightsail", "batch",
        "app runner", "amplify", "device farm", "pinpoint", "connect",
        "workspaces", "appstream", "ground station", "braket", "timestream",
        "managed blockchain", "documentdb", "keyspaces", "neptune", "memorydb",
        "qldb"
    ],
    "Billing and Pricing": [
        "cost", "pricing", "billing", "savings plan", "reserved instance",
        "spot instance", "on-demand", "free tier", "budget", "cost explorer",
        "tco", "total cost of ownership", "calculator", "cost and usage report",
        "cur", "consolidated billing", "organizations", "invoice", "credit",
        "marketplace", "support plan", "basic support", "developer support",
        "business support", "enterprise support", "tam", "technical account manager",
        "rightsizing", "compute optimizer", "cost allocation tag", "pay per use"
    ]
}

def classify_domain(text: str) -> str:
    text_lower = text.lower()
    scores = {domain: 0 for domain in DOMAIN_KEYWORDS}
    for domain, keywords in DOMAIN_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                scores[domain] += 1
    best = max(scores, key=scores.get)
    return best if scores[best] > 0 else "Technology"

# ─────────────────────────────────────────────
# TEXT CLEANING
# ─────────────────────────────────────────────
STRIP_PATTERNS = [
    r'sthithapragnasya@gmail\.com',
    r'sthithapragna',
    r'AWS Certified Cloud Practitioner CLF-C0[12] Sthithapragna',
    r'AWS Certified Cloud Practitioner CLF-C0[12]',
    r'CLF-C0[12] Page \d+',
    r'Question #:?\s*#?::\s*\d+',  # "Question #: #:: 787"
    r'\d+-\d+ DONE\s*\d+ \w+ \d{4} \d{2}:\d{2}',  # "201-225 DONE\n27 August 2023 20:34"
    r'\d+-\d+\s*\d+ \w+ \d{4} \d{2}:\d{2}',
]

def clean_text(text: str) -> str:
    if not text:
        return ""
    for pattern in STRIP_PATTERNS:
        text = re.sub(pattern, '', text, flags=re.IGNORECASE)
    # Remove excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r'[ \t]+', ' ', text)
    return text.strip()

# ─────────────────────────────────────────────
# PARSERS
# ─────────────────────────────────────────────
def parse_options(block: str) -> list:
    """Extract answer options A–E from a question block."""
    options = []
    pattern = re.compile(
        r'^([A-E])\.\s+(.+?)(?=^[A-E]\.|^Selected Answer|^Suggested Answer|^https?://|^\d+\s+#|\Z)',
        re.MULTILINE | re.DOTALL
    )
    for m in pattern.finditer(block):
        label = m.group(1)
        text = clean_text(m.group(2).strip())
        if text:
            options.append({"label": label, "text": text})
    return options

def parse_answer(block: str) -> str | None:
    """Extract the correct answer letter(s) from a question block."""
    # "Selected Answer: B" or "Suggested Answer: BC"
    m = re.search(r'(?:Selected|Suggested)\s+Answer:\s*([A-E]{1,3})', block, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    # "B (100%)" or "BC (72%)"
    m = re.search(r'^\s*([A-E]{1,3})\s+\(\d+%\)', block, re.MULTILINE)
    if m:
        return m.group(1).upper()
    # "B is correct" or "The answer is B"
    m = re.search(r'\b([A-E])\s+is correct', block, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    # "Therefore, the correct answer is D"
    m = re.search(r'correct answer is ([A-E])', block, re.IGNORECASE)
    if m:
        return m.group(1).upper()
    # Last resort: "A is incorrect ... C is correct"
    correct_letters = re.findall(r'([A-E])\s+is correct', block, re.IGNORECASE)
    if correct_letters:
        return ''.join(sorted(set(l.upper() for l in correct_letters)))
    return None

def parse_explanation(block: str, answer_letter: str | None) -> str:
    """Extract explanation text (between answer line and URL)."""
    # Find everything after Selected/Suggested Answer line, before first URL
    m = re.search(
        r'(?:Selected|Suggested)\s+Answer:?\s*[A-E]{1,3}\s*\n(.+?)(?=https?://|\Z)',
        block, re.DOTALL | re.IGNORECASE
    )
    if m:
        return clean_text(m.group(1))
    return ""

def parse_reference_url(block: str) -> str:
    """Extract the first reference URL."""
    m = re.search(r'(https?://\S+)', block)
    return m.group(1).rstrip(').,') if m else ""

def make_question_hash(question_text: str, options: list) -> str:
    """Create a hash to deduplicate questions."""
    key = question_text[:100] + ''.join(o['label'] for o in options[:2])
    return hashlib.md5(key.encode()).hexdigest()

# ─────────────────────────────────────────────
# FORMAT A: Multi-question per page (files 1–5)
# ─────────────────────────────────────────────
def parse_multi_format(pdf_path: str, password: str | None, source_name: str) -> list:
    questions = []
    full_text = ""
    try:
        with pdfplumber.open(pdf_path, password=password) as pdf:
            for page in pdf.pages:
                t = page.extract_text() or ""
                full_text += "\n" + t
    except Exception as e:
        print(f"  ERROR opening {source_name}: {e}")
        return []

    full_text = clean_text(full_text)

    # Split on question markers: "123 # Some question text"
    blocks = re.split(r'(?=^\d+\s+#\s)', full_text, flags=re.MULTILINE)

    for block in blocks:
        block = block.strip()
        if not block:
            continue

        # Extract question number
        num_m = re.match(r'^(\d+)\s+#\s+', block)
        if not num_m:
            continue
        original_number = int(num_m.group(1))

        # Extract question text (from after "N # " to before first "A.")
        q_match = re.match(r'^\d+\s+#\s+(.+?)(?=^[A-E]\.)', block, re.DOTALL | re.MULTILINE)
        if not q_match:
            continue
        question_text = clean_text(q_match.group(1))
        if len(question_text) < 10:
            continue

        options = parse_options(block)
        if len(options) < 2:
            continue

        correct_answer = parse_answer(block)
        explanation = parse_explanation(block, correct_answer)
        reference_url = parse_reference_url(block)
        domain = classify_domain(question_text + " " + " ".join(o["text"] for o in options))

        questions.append({
            "originalNumber": original_number,
            "question": question_text,
            "options": options,
            "correctAnswer": correct_answer,
            "explanation": explanation,
            "referenceUrl": reference_url,
            "domain": domain,
            "hasAnswer": correct_answer is not None,
            "sourceFile": source_name,
            "_hash": make_question_hash(question_text, options),
        })

    return questions

# ─────────────────────────────────────────────
# FORMAT B: 1 question per 2 pages (files 6–12)
# ─────────────────────────────────────────────
def parse_one_per_two_format(pdf_path: str, password: str | None, source_name: str) -> list:
    questions = []
    try:
        with pdfplumber.open(pdf_path, password=password) as pdf:
            pages = pdf.pages
            # Take every other page (odd indices = question pages, even = duplicates)
            for i in range(0, len(pages), 2):
                text = pages[i].extract_text() or ""
                text = clean_text(text)
                if not text.strip():
                    continue

                num_m = re.match(r'^(\d+)\s+#\s+', text)
                if not num_m:
                    continue
                original_number = int(num_m.group(1))

                q_match = re.match(r'^\d+\s+#\s+(.+?)(?=^[A-E]\.)', text, re.DOTALL | re.MULTILINE)
                if not q_match:
                    continue
                question_text = clean_text(q_match.group(1))
                if len(question_text) < 10:
                    continue

                options = parse_options(text)
                if len(options) < 2:
                    continue

                # Check second page for answer
                answer_text = ""
                if i + 1 < len(pages):
                    answer_text = pages[i + 1].extract_text() or ""
                    answer_text = clean_text(answer_text)

                combined = text + "\n" + answer_text
                correct_answer = parse_answer(combined)
                explanation = parse_explanation(combined, correct_answer)
                reference_url = parse_reference_url(combined)
                domain = classify_domain(question_text + " " + " ".join(o["text"] for o in options))

                questions.append({
                    "originalNumber": original_number,
                    "question": question_text,
                    "options": options,
                    "correctAnswer": correct_answer,
                    "explanation": explanation,
                    "referenceUrl": reference_url,
                    "domain": domain,
                    "hasAnswer": correct_answer is not None,
                    "sourceFile": source_name,
                    "_hash": make_question_hash(question_text, options),
                })
    except Exception as e:
        print(f"  ERROR opening {source_name}: {e}")
    return questions

# ─────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────
def main():
    all_questions = []
    seen_hashes = set()
    total_parsed = 0
    total_dupes = 0

    for pdf_config in PDFS:
        path = pdf_config["path"]
        password = pdf_config["password"]
        fmt = pdf_config["format"]
        source_name = os.path.basename(path)

        if not os.path.exists(path):
            print(f"  SKIP (not found): {source_name}")
            continue

        print(f"Parsing [{fmt}]: {source_name}")

        if fmt == "multi":
            qs = parse_multi_format(path, password, source_name)
        else:
            qs = parse_one_per_two_format(path, password, source_name)

        for q in qs:
            total_parsed += 1
            h = q.pop("_hash")
            if h in seen_hashes:
                total_dupes += 1
                continue
            seen_hashes.add(h)
            all_questions.append(q)

        print(f"  -> {len(qs)} parsed, {len(all_questions)} unique so far")

    # Assign sequential IDs
    for i, q in enumerate(all_questions, 1):
        q["id"] = i

    # Stats
    has_answer = sum(1 for q in all_questions if q["hasAnswer"])
    by_domain = {}
    for q in all_questions:
        by_domain[q["domain"]] = by_domain.get(q["domain"], 0) + 1

    print(f"\n{'='*50}")
    print(f"Total unique questions: {len(all_questions)}")
    print(f"With answers: {has_answer}")
    print(f"Duplicates removed: {total_dupes}")
    print(f"By domain:")
    for d, c in sorted(by_domain.items()):
        print(f"  {d}: {c}")

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_questions, f, ensure_ascii=False, indent=2)

    print(f"\nSaved to: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
