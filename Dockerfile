# ── Stage 1: Build React frontend ────────────────────────────
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ .
RUN npm run build

# ── Stage 2: Backend + serve frontend ─────────────────────────
FROM node:20-alpine

# System deps for PDF processing / OCR
RUN apk add --no-cache \
    python3 py3-pip \
    tesseract-ocr tesseract-ocr-data-eng \
    ghostscript poppler-utils \
    libpng libjpeg-turbo freetype \
    && ln -sf python3 /usr/bin/python

WORKDIR /app

# Install Node dependencies
COPY backend/package*.json ./
RUN npm ci --only=production

# Copy backend source
COPY backend/ .

# Install Python packages for PDF/docx conversion
RUN pip3 install --break-system-packages pdfplumber pytesseract pillow python-docx 2>/dev/null || \
    pip3 install pdfplumber pytesseract pillow python-docx

# Copy built frontend into public/ (Express will serve it)
COPY --from=frontend-builder /app/frontend/dist ./public

# Uploads directory (mount a volume in production)
RUN mkdir -p uploads

EXPOSE 3001

ENV NODE_ENV=production
ENV PORT=3001

CMD ["node", "src/server.js"]
