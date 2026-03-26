const fs = require('fs');
const path = require('path');

const IGNORED = new Set(['node_modules', '.git', 'dist', 'build', '.expo', 'coverage', '.next', '__pycache__']);

function findSrcRoot(startDir, workspaceRoot) {
  let current = startDir;
  while (current !== workspaceRoot && current !== path.dirname(current)) {
    if (path.basename(current) === 'src') return current;
    current = path.dirname(current);
  }
  // If no src/ found, use workspace root
  return workspaceRoot;
}

function buildTree(workspaceRoot, clickedFilePath) {
  const clickedDir = fs.statSync(clickedFilePath).isDirectory()
    ? clickedFilePath
    : path.dirname(clickedFilePath);

  const srcRoot = findSrcRoot(clickedDir, workspaceRoot);
  const targetPath = clickedFilePath;

  // Build the path from srcRoot down to the clicked file/folder
  const activePath = new Set();
  let cursor = clickedFilePath;
  while (cursor !== path.dirname(srcRoot) && cursor !== cursor) {
    activePath.add(cursor);
    const parent = path.dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
    if (cursor === path.dirname(srcRoot)) break;
    activePath.add(cursor);
  }

  const lines = [];
  const srcLabel = path.relative(workspaceRoot, srcRoot) || path.basename(srcRoot);
  lines.push(`${srcLabel}/`);

  renderDir(srcRoot, '', lines, activePath, targetPath, clickedDir, 0);

  return lines.join('\n');
}

function renderDir(dirPath, prefix, lines, activePath, targetPath, targetDir, depth) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  entries = entries.filter((e) => !IGNORED.has(e.name));

  // Sort: folders first, then files
  entries.sort((a, b) => {
    if (a.isDirectory() && !b.isDirectory()) return -1;
    if (!a.isDirectory() && b.isDirectory()) return 1;
    return a.name.localeCompare(b.name);
  });

  const isOnActivePath = activePath.has(dirPath);

  // If we're not on the active path and depth > 0, only render a summary
  if (!isOnActivePath && depth > 0) {
    return;
  }

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const isLast = i === entries.length - 1;
    const connector = isLast ? '└── ' : '├── ';
    const childPrefix = prefix + (isLast ? '    ' : '│   ');
    const fullPath = path.join(dirPath, entry.name);

    const isTarget = fullPath === targetPath || fullPath === targetDir;
    const isOnPath = activePath.has(fullPath);

    if (entry.isDirectory()) {
      const marker = isTarget ? ' ◀ selected' : '';
      if (isOnPath) {
        lines.push(`${prefix}${connector}${entry.name}/${marker}`);
        renderDir(fullPath, childPrefix, lines, activePath, targetPath, targetDir, depth + 1);
      } else {
        // Show sibling folders but not their children
        lines.push(`${prefix}${connector}${entry.name}/`);
      }
    } else {
      const marker = isTarget ? ' ◀ selected' : '';
      lines.push(`${prefix}${connector}${entry.name}${marker}`);
    }
  }
}

module.exports = { buildTree };
