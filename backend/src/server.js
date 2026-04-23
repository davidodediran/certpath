require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Trust ALB / CloudFront forwarded headers so req.ip and req.protocol
// reflect the real client values (not the load-balancer's IP).
app.set('trust proxy', true);

// Middleware
app.use(cors({
  origin: true,        // reflects request origin — works for HTTP and HTTPS
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/exam-types', require('./routes/examTypes'));
app.use('/api/exams', require('./routes/exams'));
app.use('/api/results', require('./routes/results'));
app.use('/api/surveys', require('./routes/surveys'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/superuser', require('./routes/superuser'));
app.use('/api/student', require('./routes/student'));

// Sample question file download (public)
const fs = require('fs');
const pathModule = require('path');

app.get('/api/samples/questions.json', (req, res) => {
  const f = pathModule.join(__dirname, '../data/sample_questions.json');
  res.download(f, 'sample_questions.json');
});

app.get('/api/samples/questions.csv', (req, res) => {
  const raw = JSON.parse(fs.readFileSync(pathModule.join(__dirname, '../data/sample_questions.json'), 'utf8'));
  // Header now includes option_e and option_f to support up to 6-option questions
  const header = 'question,option_a,option_b,option_c,option_d,option_e,option_f,correct_answer,explanation,domain,reference_url\n';
  const rows = raw.map((q) => {
    const opts = q.options || [];
    // Map options by label so A-F are always in the right column regardless of array order
    const byLabel = Object.fromEntries(opts.map((o) => [o.label.toUpperCase(), o.text]));
    return [
      q.question,
      byLabel['A'] || '',
      byLabel['B'] || '',
      byLabel['C'] || '',
      byLabel['D'] || '',
      byLabel['E'] || '',
      byLabel['F'] || '',
      q.correct_answer || '',
      q.explanation || '',
      q.domain || '',
      q.reference_url || '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  }).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_questions.csv"');
  res.send(header + rows);
});

app.get('/api/samples/questions-pdf-format.txt', (req, res) => {
  const content = `AWS EXAM PRACTICE — SAMPLE QUESTION FORMAT FOR PDF / WORD DOCUMENTS
=====================================================================
Use this layout when creating questions in a PDF or Word document.
Each question must follow the numbered format below exactly.
The system will auto-detect domains. Answers must appear after all options.

Supports up to 6 answer options (A–F).
For multi-select questions, include "(Choose two.)" / "(Choose three.)"
in the question text and list all correct letters in the Answer line.

---------------------------------------------------------------------

EXAMPLE 1 — Single-answer question (4 options)

1. Which AWS service provides scalable object storage in the cloud?

A. Amazon EC2
B. Amazon S3
C. Amazon RDS
D. Amazon EBS

Answer: B

Explanation: Amazon S3 (Simple Storage Service) is an object storage
service offering industry-leading scalability, data availability,
security, and performance.

---------------------------------------------------------------------

EXAMPLE 2 — Single-answer question

2. What does the AWS Shared Responsibility Model define as a
   customer responsibility?

A. Physical security of data centres
B. Hypervisor patching
C. Security IN the cloud (data, IAM, applications)
D. Network infrastructure maintenance

Answer: C

Explanation: Customers are responsible for Security IN the cloud,
which includes their data, applications, access management, and OS
configurations on services they control.

---------------------------------------------------------------------

EXAMPLE 3 — Multi-select question (Choose two, 4 options)

3. Which of the following are benefits of cloud computing? (Choose two.)

A. Trade capital expense for variable expense
B. Increased time to market due to manual provisioning
C. Benefit from massive economies of scale
D. Requires significant upfront hardware investment

Answer: A, C

Explanation: Key cloud benefits include trading capex for variable
expense and benefiting from massive economies of scale.

---------------------------------------------------------------------

EXAMPLE 4 — Multi-select question (Choose two, 5 options)

4. Which of the following are pillars of the AWS Well-Architected
   Framework? (Choose two.)

A. Availability
B. Reliability
C. Scalability
D. Responsive design
E. Performance Efficiency

Answer: B, E

Explanation: Reliability and Performance Efficiency are two of the
six pillars of the AWS Well-Architected Framework.

---------------------------------------------------------------------

EXAMPLE 5 — Multi-select question (Choose three, 5 options)

5. Which of the following are characteristics of the AWS global
   infrastructure? (Choose three.)

A. Regions
B. Availability Zones
C. Data silos
D. Edge Locations
E. Physical on-premises servers

Answer: A, B, D

Explanation: The AWS global infrastructure consists of Regions,
Availability Zones, and Edge Locations.

---------------------------------------------------------------------

RULES FOR CORRECT PARSING:
- Questions must be numbered: "1.", "2.", "3." etc.
- Options must be labelled: "A.", "B.", "C.", "D.", "E.", "F." (uppercase)
- Supports up to 6 options per question (A through F)
- Answer line must start with "Answer:" or "Correct Answer:" followed
  by the letter(s). Accepted formats:
    Answer: B              (single)
    Answer: AC             (multi, no separator)
    Answer: A, C           (multi, comma-separated)
    Answer: A and C        (multi, word-separated)
    Answer: A/C            (multi, slash-separated)
- For multi-select questions include "(Choose two.)" or "(Choose three.)"
  etc. in the question text — the system will auto-set max selections
- Explanation line must start with "Explanation:" (optional but recommended)
- Leave a blank line between each section
- Minimum question length: 15 characters
`;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_questions_pdf_word_format.txt"');
  res.send(content);
});

// Serve React frontend in production (single-image deployment)
// __dirname = /app/src → ../public = /app/public (where Dockerfile copies the build)
const frontendDist = path.join(__dirname, '../public');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA catch-all — any non-API route serves index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
} else {
  // 404 for API-only mode (dev)
  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
}

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend running on port ${PORT}`);
});
