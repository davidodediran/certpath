import jsPDF from 'jspdf';
import 'jspdf-autotable';

const AWS_NAVY = [35, 47, 62];
const AWS_ORANGE = [255, 153, 0];
const LIGHT_GRAY = [245, 245, 245];
const MID_GRAY = [150, 150, 150];

export function generateResultPDF(result) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── Header bar ──────────────────────────────────────────
  doc.setFillColor(...AWS_NAVY);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setFillColor(...AWS_ORANGE);
  doc.rect(0, 22, pageW, 3, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('AWS Certification', 14, 10);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('amazon web services', 14, 16);

  // ── Title ────────────────────────────────────────────────
  doc.setTextColor(...AWS_NAVY);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(result.examName || 'AWS Certified Cloud Practitioner', 14, 36);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text('Notice of Exam Results', 14, 44);

  // ── Candidate info grid ──────────────────────────────────
  const infoY = 52;
  doc.setFontSize(9);
  doc.setTextColor(...MID_GRAY);
  doc.text('Candidate:', 14, infoY);
  doc.text('Exam Date:', 110, infoY);
  doc.setTextColor(30, 30, 30);
  doc.setFont('helvetica', 'bold');
  doc.text(result.studentEmail || '', 40, infoY);
  doc.text(result.examDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }), 130, infoY);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...MID_GRAY);
  doc.text('Candidate ID:', 14, infoY + 7);
  doc.text('Registration Number:', 110, infoY + 7);
  doc.setTextColor(30, 30, 30);
  doc.text(result.studentEmail?.split('@')[0]?.toUpperCase() || 'N/A', 44, infoY + 7);
  doc.text(result.sessionId?.slice(0, 8).toUpperCase() || 'N/A', 148, infoY + 7);

  // ── Score box ────────────────────────────────────────────
  const scoreY = 72;
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(14, scoreY, 80, 22, 2, 2, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...AWS_NAVY);
  doc.text('Candidate Score:', 20, scoreY + 8);
  doc.setFontSize(20);
  doc.setTextColor(...AWS_ORANGE);
  doc.text(String(result.score || 0), 20, scoreY + 17);
  doc.setFontSize(11);
  doc.setTextColor(...MID_GRAY);
  doc.text('/ 1000', 38, scoreY + 17);

  // Pass/Fail badge
  const passed = result.passed;
  doc.setFillColor(...(passed ? [0, 128, 0] : [180, 0, 0]));
  doc.roundedRect(104, scoreY, 50, 22, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(passed ? 'PASS' : 'FAIL', 129, scoreY + 14, { align: 'center' });

  // Congratulations line
  if (passed) {
    doc.setFontSize(9);
    doc.setTextColor(0, 128, 0);
    doc.setFont('helvetica', 'italic');
    doc.text('Congratulations! You have successfully passed this AWS Certification exam.', 14, scoreY + 30);
  }

  // ── Divider ──────────────────────────────────────────────
  const divY = scoreY + 35;
  doc.setDrawColor(...AWS_ORANGE);
  doc.setLineWidth(0.5);
  doc.line(14, divY, pageW - 14, divY);

  // ── Breakdown table ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...AWS_NAVY);
  doc.text('Breakdown of Exam Results', 14, divY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 80, 80);
  const disclaimerLines = [
    'The information below details the composition of the exam and your performance in each section.',
    'This uses a compensatory scoring model — you do not need to pass each section individually.',
  ];
  doc.text(disclaimerLines, 14, divY + 17);

  // Build domain rows dynamically from the actual result data, sorted by
  // the sortOrder field now embedded in each domain entry.
  const dr = result.domainResults || {};
  const sortedDomains = Object.entries(dr)
    .sort(([, a], [, b]) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999));

  const tableRows = sortedDomains.map(([domain, stats]) => {
    const perf = stats.performance || '—';
    const weightStr = stats.weight != null ? `${stats.weight}%` : '—';
    return [`Domain: ${domain}`, weightStr, perf];
  });

  doc.autoTable({
    startY: divY + 26,
    head: [['Section', '% of Scored Items', 'Performance']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: AWS_NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 90 },
      1: { cellWidth: 40, halign: 'center' },
      2: { cellWidth: 55, halign: 'center' },
    },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 2) {
        const val = data.cell.raw;
        if (val === 'Meets Competency') {
          doc.setTextColor(0, 120, 0);
        } else if (val === 'Needs Improvement') {
          doc.setTextColor(180, 0, 0);
        } else if (val === 'Not Assessed') {
          doc.setTextColor(130, 130, 130);
        }
      }
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;

  // ── Legend ───────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 120, 0);
  doc.text('Meets Competency:', 14, finalY);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Performance demonstrates knowledge, skills, and abilities expected of a passing candidate.', 52, finalY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(180, 0, 0);
  doc.text('Needs Improvement:', 14, finalY + 6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('Performance does not demonstrate knowledge, skills, and abilities expected of a passing candidate.', 54, finalY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(130, 130, 130);
  doc.text('Not Assessed:', 14, finalY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text('No questions from this domain appeared in this exam draw.', 46, finalY + 12);

  // ── Footer ───────────────────────────────────────────────
  const footerY = doc.internal.pageSize.getHeight() - 14;
  doc.setFillColor(...AWS_NAVY);
  doc.rect(0, footerY - 2, pageW, 16, 'F');
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(7);
  doc.text(
    'AWS Certification exams are designed for pass/fail decisions. Section results highlight areas of weakness only.',
    pageW / 2, footerY + 5,
    { align: 'center' }
  );

  doc.save(`AWS-Result-${(result.studentEmail || 'candidate').split('@')[0]}-${Date.now()}.pdf`);
}
