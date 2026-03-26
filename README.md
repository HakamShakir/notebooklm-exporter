# NotebookLM Exporter — VS Code Extension

Right-click any file in your React project and export it + its folder as structured PDFs for NotebookLM.

## What it exports

For every right-click, it generates a `/notebooklm-exports/` folder at your workspace root containing:

- **One PDF per code file** — the file's full source code with line numbers and a header showing its path
- **`_project-tree.pdf`** — the full `src/` tree from root down to your selected file, with siblings visible and the chosen path highlighted
- **`_api-routes.pdf`** — a table of every API route called in the selected files (`fetch`, `axios`, custom clients), with method, route, and source file

## Setup

### 1. Install dependencies

```bash
cd notebooklm-exporter
npm install
```

### 2. Run in VS Code (development mode)

1. Open this folder in VS Code: `code .`
2. Press **F5** — this opens the Extension Development Host window
3. In that window, open your React project
4. Right-click any `.js` / `.jsx` file in the Explorer sidebar
5. Click **"Export to NotebookLM PDFs"**
6. Find your PDFs in `<your-project>/notebooklm-exports/`

### 3. Install permanently (optional)

```bash
npm install -g @vscode/vsce
npx vsce package
```

This creates a `.vsix` file. Install it in VS Code:
- Open Command Palette (`Cmd+Shift+P`)
- Run `Extensions: Install from VSIX...`
- Pick the `.vsix` file

## File detection logic

Given a clicked file (e.g. `src/screens/home/index.jsx`):

1. Collects all code files in the same folder (`src/screens/home/`)
2. Follows `import` / `require` statements from each file to pull in shared utilities, context, hooks
3. Skips `node_modules`, `dist`, `build`, `.git`
4. Exports `index.*` files first, then alphabetically

## Route detection patterns

Detects calls to:
- `fetch('/api/...')`
- `axios.get/post/put/delete/patch('/...')`
- `api.get(...)`, `apiClient.post(...)`, `client.put(...)` (custom wrappers)
- `useQuery`, `useMutation` with route strings (React Query)

## Output structure

```
notebooklm-exports/
  _project-tree.pdf          ← always generated
  _api-routes.pdf            ← always generated
  src__screens__home__index.jsx.pdf
  src__screens__home__components__OrderCard.jsx.pdf
  src__screens__home__components__Header.jsx.pdf
  ...
```
