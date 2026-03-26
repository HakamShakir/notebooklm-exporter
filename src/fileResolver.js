const fs = require('fs');
const path = require('path');

const ALLOWED_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);
const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.expo', 'coverage', '.next']);

function isCodeFile(filePath) {
  return ALLOWED_EXTENSIONS.has(path.extname(filePath).toLowerCase());
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function resolveImportsFromContent(content, fromDir) {
  const resolved = [];

  const patterns = [
    /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g,
    /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith('.')) continue;

      const baseResolved = path.resolve(fromDir, importPath);

      const candidates = [
        baseResolved,
        baseResolved + '.js',
        baseResolved + '.jsx',
        baseResolved + '.ts',
        baseResolved + '.tsx',
        path.join(baseResolved, 'index.js'),
        path.join(baseResolved, 'index.jsx'),
        path.join(baseResolved, 'index.ts'),
        path.join(baseResolved, 'index.tsx'),
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
          resolved.push(candidate);
          break;
        }
      }
    }
  }

  return resolved;
}

function getFilesInFolder(folderPath) {
  const results = [];
  try {
    const entries = fs.readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && isCodeFile(entry.name)) {
        results.push(path.join(folderPath, entry.name));
      }
    }
  } catch {
    // skip unreadable dirs
  }
  return results;
}

async function resolveFiles(clickedFilePath) {
  const clickedDir = fs.statSync(clickedFilePath).isDirectory()
    ? clickedFilePath
    : path.dirname(clickedFilePath);

  const seen = new Set();
  const queue = [];

  // Start with all files in the same folder
  const folderFiles = getFilesInFolder(clickedDir);
  for (const f of folderFiles) {
    if (!seen.has(f)) {
      seen.add(f);
      queue.push(f);
    }
  }

  // Also add the clicked file itself if it's a file not in the folder scan
  if (
    !fs.statSync(clickedFilePath).isDirectory() &&
    isCodeFile(clickedFilePath) &&
    !seen.has(clickedFilePath)
  ) {
    seen.add(clickedFilePath);
    queue.push(clickedFilePath);
  }

  // Follow imports from all collected files
  const toScan = [...queue];
  while (toScan.length > 0) {
    const current = toScan.shift();
    const content = readFileSafe(current);
    if (!content) continue;

    const fromDir = path.dirname(current);
    const imports = resolveImportsFromContent(content, fromDir);

    for (const imp of imports) {
      // Only follow imports that are NOT in node_modules or ignored dirs
      const isIgnored = IGNORED_DIRS.has(path.basename(path.dirname(imp)));
      if (!seen.has(imp) && !isIgnored && isCodeFile(imp)) {
        seen.add(imp);
        queue.push(imp);
        toScan.push(imp);
      }
    }
  }

  // Sort: index files first, then alphabetically
  return [...seen].sort((a, b) => {
    const aIsIndex = path.basename(a).startsWith('index');
    const bIsIndex = path.basename(b).startsWith('index');
    if (aIsIndex && !bIsIndex) return -1;
    if (!aIsIndex && bIsIndex) return 1;
    return a.localeCompare(b);
  });
}

module.exports = { resolveFiles };
