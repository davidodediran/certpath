FROM node:20-alpine

# ── System packages ───────────────────────────────────────────
# Tesseract, Ghostscript and Poppler are needed by the PDF-import
# feature (parse_pdf_single.py). All other system deps are helpers.
RUN apk add --no-cache \
    python3 \
    py3-pip \
    tesseract-ocr \
    tesseract-ocr-data-eng \
    ghostscript \
    poppler-utils \
    libpng \
    libjpeg-turbo \
    freetype \
    && ln -sf python3 /usr/bin/python

# ── Node dependencies ─────────────────────────────────────────
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# ── App source ────────────────────────────────────────────────
COPY . .

# ── Python dependencies for PDF question import ───────────────
# --no-cache-dir   → don't write pip cache (saves disk + RAM on small EC2)
# --break-system-packages → required on Alpine / Python 3.12+ managed env
RUN pip3 install --no-cache-dir --break-system-packages \
    pdfplumber \
    pytesseract \
    pillow \
    python-docx

EXPOSE 3001

CMD ["sh", "-c", "node src/db/migrate.js && node src/server.js"]
