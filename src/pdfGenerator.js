const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const COLORS = {
  bg: '#FFFFFF',
  headerBg: '#1E1E2E',
  headerText: '#CDD6F4',
  pathText: '#89B4FA',
  lineNum: '#6C7086',
  code: '#CDD6F4',
  accent: '#89DCEB',
  routeGet: '#A6E3A1',
  routePost: '#FAB387',
  routePut: '#F9E2AF',
  routeDelete: '#F38BA8',
  routeOther: '#CBA6F7',
  treeBranch: '#6C7086',
  treeHighlight: '#89B4FA',
  label: '#BAC2DE',
  border: '#313244',
};

const MONO_FONT = 'Courier';
const SANS_FONT = 'Helvetica';

function sanitizeFilename(str) {
  return str.replace(/[^a-z0-9_\-\.]/gi, '_').replace(/_+/g, '_');
}

function methodColor(method) {
  const m = (method || '').toUpperCase();
  if (m === 'GET' || m === 'QUERY' || m === 'FETCH') return COLORS.routeGet;
  if (m === 'POST') return COLORS.routePost;
  if (m === 'PUT' || m === 'PATCH') return COLORS.routePut;
  if (m === 'DELETE') return COLORS.routeDelete;
  return COLORS.routeOther;
}

function drawHeader(doc, title, subtitle, workspaceRoot) {
  doc.rect(0, 0, doc.page.width, 64).fill(COLORS.headerBg);

  doc.font(MONO_FONT).fontSize(13).fillColor(COLORS.headerText).text(title, 20, 14, {
    width: doc.page.width - 40,
    ellipsis: true,
  });

  doc
    .font(MONO_FONT)
    .fontSize(9)
    .fillColor(COLORS.pathText)
    .text(subtitle, 20, 34, { width: doc.page.width - 40 });

  const dateStr = new Date().toISOString().slice(0, 10);
  doc
    .font(SANS_FONT)
    .fontSize(8)
    .fillColor(COLORS.label)
    .text(`Exported: ${dateStr}`, doc.page.width - 140, 46, { width: 120, align: 'right' });

  doc.rect(0, 64, doc.page.width, 1).fill(COLORS.border);
}

function generateFilePDF(filePath, workspaceRoot, outputDir) {
  return new Promise((resolve, reject) => {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch (e) {
      return reject(e);
    }

    const relPath = path.relative(workspaceRoot, filePath);
    const fileName = path.basename(filePath);
    const outName = sanitizeFilename(relPath.replace(/\//g, '__')) + '.pdf';
    const outPath = path.join(outputDir, outName);

    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    drawHeader(doc, fileName, relPath, workspaceRoot);

    const lines = content.split('\n');
    const startY = 80;
    const leftPad = 20;
    const lineNumWidth = 40;
    const codeX = leftPad + lineNumWidth;
    const codeWidth = doc.page.width - codeX - leftPad;
    const lineHeight = 13;

    doc.font(MONO_FONT).fontSize(9);

    let y = startY;

    for (let i = 0; i < lines.length; i++) {
      if (y > doc.page.height - 30) {
        doc.addPage({ margin: 0 });
        drawHeader(doc, fileName, relPath + ` (cont.)`, workspaceRoot);
        y = startY;
      }

      const lineNum = String(i + 1).padStart(4, ' ');

      doc.fillColor(COLORS.lineNum).text(lineNum, leftPad, y, {
        width: lineNumWidth - 6,
        align: 'right',
        lineBreak: false,
      });

      // Thin separator line
      doc
        .moveTo(leftPad + lineNumWidth - 2, y)
        .lineTo(leftPad + lineNumWidth - 2, y + lineHeight - 2)
        .strokeColor(COLORS.border)
        .lineWidth(0.5)
        .stroke();

      const codeLine = lines[i].replace(/\t/g, '  ');

      doc.fillColor(COLORS.code).text(codeLine || ' ', codeX, y, {
        width: codeWidth,
        lineBreak: false,
        ellipsis: true,
      });

      y += lineHeight;
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function generateTreePDF(treeText, clickedFilePath, workspaceRoot, outputDir) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(outputDir, '_project-tree.pdf');
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const relClicked = path.relative(workspaceRoot, clickedFilePath);
    drawHeader(doc, 'Project tree', `Context path to: ${relClicked}`, workspaceRoot);

    const lines = treeText.split('\n');
    let y = 84;
    const leftPad = 24;
    const lineHeight = 14;

    doc.fontSize(10);

    for (const line of lines) {
      if (y > doc.page.height - 30) {
        doc.addPage({ margin: 0 });
        drawHeader(doc, 'Project tree (cont.)', `Context path to: ${relClicked}`, workspaceRoot);
        y = 84;
      }

      const isHighlight = line.includes('◀ selected');
      const isBranch = /[├└│─]/.test(line);

      if (isHighlight) {
        doc
          .rect(leftPad - 4, y - 1, doc.page.width - leftPad * 2, lineHeight)
          .fill('#1e3a5f');

        doc
          .font(MONO_FONT)
          .fillColor(COLORS.treeHighlight)
          .text(line, leftPad, y, { lineBreak: false });
      } else if (isBranch) {
        doc
          .font(MONO_FONT)
          .fillColor(COLORS.treeBranch)
          .text(line, leftPad, y, { lineBreak: false });
      } else {
        doc
          .font(MONO_FONT)
          .fillColor(COLORS.code)
          .text(line, leftPad, y, { lineBreak: false });
      }

      y += lineHeight;
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function generateRoutesPDF(routes, clickedFilePath, workspaceRoot, outputDir) {
  return new Promise((resolve, reject) => {
    const outPath = path.join(outputDir, '_api-routes.pdf');
    const doc = new PDFDocument({ margin: 0, size: 'A4' });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    const relClicked = path.relative(workspaceRoot, clickedFilePath);
    drawHeader(doc, 'API routes', `Extracted from: ${relClicked} and related files`, workspaceRoot);

    let y = 84;
    const leftPad = 20;
    const methodColW = 70;
    const routeColW = 260;
    const fileColX = leftPad + methodColW + routeColW + 12;
    const rowH = 22;

    // Column headers
    doc.font(SANS_FONT).fontSize(8).fillColor(COLORS.label);
    doc.text('Method', leftPad, y, { width: methodColW, lineBreak: false });
    doc.text('Route', leftPad + methodColW + 6, y, { width: routeColW, lineBreak: false });
    doc.text('Source file', fileColX, y, { lineBreak: false });
    y += 16;
    doc.rect(leftPad, y, doc.page.width - leftPad * 2, 0.5).fill(COLORS.border);
    y += 8;

    if (routes.length === 0) {
      doc
        .font(MONO_FONT)
        .fontSize(10)
        .fillColor(COLORS.label)
        .text('No API routes detected in the selected files.', leftPad, y);
    }

    for (let i = 0; i < routes.length; i++) {
      const r = routes[i];

      if (y > doc.page.height - 40) {
        doc.addPage({ margin: 0 });
        drawHeader(doc, 'API routes (cont.)', `Extracted from: ${relClicked}`, workspaceRoot);
        y = 84;
      }

      // Zebra stripe
      if (i % 2 === 0) {
        doc
          .rect(leftPad - 4, y - 2, doc.page.width - leftPad * 2 + 4, rowH)
          .fill('#1a1a2e');
      }

      // Method badge
      const badgeColor = methodColor(r.method);
      doc.rect(leftPad, y + 1, methodColW - 10, 14).fill(badgeColor + '33');
      doc
        .font(MONO_FONT)
        .fontSize(8)
        .fillColor(badgeColor)
        .text(r.method, leftPad + 4, y + 3, { width: methodColW - 14, lineBreak: false });

      // Route
      doc
        .font(MONO_FONT)
        .fontSize(9)
        .fillColor(COLORS.code)
        .text(r.route, leftPad + methodColW + 6, y + 3, {
          width: routeColW,
          lineBreak: false,
          ellipsis: true,
        });

      // Source file
      doc
        .font(MONO_FONT)
        .fontSize(8)
        .fillColor(COLORS.label)
        .text(r.file, fileColX, y + 3, {
          width: doc.page.width - fileColX - leftPad,
          lineBreak: false,
          ellipsis: true,
        });

      y += rowH;
    }

    // Summary footer
    y += 12;
    doc.rect(leftPad, y, doc.page.width - leftPad * 2, 0.5).fill(COLORS.border);
    y += 8;
    doc
      .font(SANS_FONT)
      .fontSize(8)
      .fillColor(COLORS.label)
      .text(`${routes.length} route${routes.length !== 1 ? 's' : ''} found across ${new Set(routes.map((r) => r.file)).size} file${new Set(routes.map((r) => r.file)).size !== 1 ? 's' : ''}`, leftPad, y);

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

module.exports = { generateFilePDF, generateTreePDF, generateRoutesPDF };
