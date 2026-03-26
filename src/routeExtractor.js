const fs = require('fs');
const path = require('path');

// Patterns tuned for React + Express/Node projects
const ROUTE_PATTERNS = [
  // fetch('/api/...') or fetch(`/api/...`)
  { regex: /fetch\s*\(\s*[`'"]([^`'"]+)[`'"]/g, method: 'FETCH' },

  { regex: /axios\s*\.\s*(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi, method: null, methodGroup: 1, pathGroup: 2 },
  { regex: /\w*[Aa]xios\w*\s*\.\s*(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi, method: null, methodGroup: 1, pathGroup: 2 },


  // api.get('/...') or apiClient.post('/...') — common custom wrappers
  { regex: /(?:api|apiClient|client|http|request)\s*\.\s*(get|post|put|delete|patch)\s*\(\s*[`'"]([^`'"]+)[`'"]/gi, method: null, methodGroup: 1, pathGroup: 2 },

  // fetch with method option: fetch('/url', { method: 'POST' })
  { regex: /fetch\s*\(\s*[`'"]([^`'"]+)[`'"][\s\S]{0,60}?method\s*:\s*[`'"](\w+)[`'"]/g, method: null, pathGroup: 1, methodGroup: 2 },

  // useQuery/useMutation with endpoint strings (React Query)
  { regex: /(?:useQuery|useMutation|useInfiniteQuery)\s*\([^)]*[`'"]([/][^`'"]+)[`'"]/g, method: 'QUERY' },
];

function extractRoutes(filePaths) {
  const routes = [];
  const seen = new Set();

  for (const filePath of filePaths) {
    let content;
    try {
      content = fs.readFileSync(filePath, 'utf8');
    } catch {
      continue;
    }

    const relPath = filePath;

    for (const pattern of ROUTE_PATTERNS) {
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      let match;

      while ((match = regex.exec(content)) !== null) {
        let routePath, method;

        if (pattern.methodGroup && pattern.pathGroup) {
          method = (match[pattern.methodGroup] || '').toUpperCase();
          routePath = match[pattern.pathGroup];
        } else if (pattern.pathGroup) {
          routePath = match[pattern.pathGroup];
          method = pattern.method || 'FETCH';
        } else {
          routePath = match[1];
          method = pattern.method || 'GET';
        }

        if (!routePath) continue;

        // Filter noise: skip non-route-looking strings
        if (!routePath.startsWith('/') && !routePath.startsWith('http')) continue;
        if (routePath.length > 200) continue;

        const key = `${method}:${routePath}:${path.basename(filePath)}`;
        if (!seen.has(key)) {
          seen.add(key);
          routes.push({
            method,
            route: routePath,
            file: path.basename(filePath),
            fullPath: filePath,
          });
        }
      }
    }
  }

  // Sort by route path
  return routes.sort((a, b) => a.route.localeCompare(b.route));
}

module.exports = { extractRoutes };
