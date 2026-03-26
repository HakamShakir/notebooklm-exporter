const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { resolveFiles } = require('./fileResolver');
const { buildTree } = require('./treeBuilder');
const { extractRoutes } = require('./routeExtractor');
const { generateFilePDF, generateTreePDF, generateRoutesPDF } = require('./pdfGenerator');

function activate(context) {
  const disposable = vscode.commands.registerCommand(
    'notebooklm-exporter.export',
    async (uri) => {
      if (!uri) {
        vscode.window.showErrorMessage('Right-click a file in the explorer to use this command.');
        return;
      }

      const clickedFilePath = uri.fsPath;
      const workspaceRoot = vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath;

      if (!workspaceRoot) {
        vscode.window.showErrorMessage('Could not find workspace root.');
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'NotebookLM Exporter',
          cancellable: false,
        },
        async (progress) => {
          return new Promise(async (resolve) => {
            try {
              progress.report({ message: 'Resolving files...' });
              const files = await resolveFiles(clickedFilePath);

              progress.report({ message: 'Building project tree...' });
              const treeText = buildTree(workspaceRoot, clickedFilePath);

              progress.report({ message: 'Extracting API routes...' });
              const routes = extractRoutes(files);

              const outputDir = path.join(workspaceRoot, 'notebooklm-exports');
              fs.mkdirSync(outputDir, { recursive: true });

              progress.report({ message: 'Generating PDFs...' });

              for (const filePath of files) {
                await generateFilePDF(filePath, workspaceRoot, outputDir);
              }

              await generateTreePDF(treeText, clickedFilePath, workspaceRoot, outputDir);
              await generateRoutesPDF(routes, clickedFilePath, workspaceRoot, outputDir);

              const total = files.length + 2;
              progress.report({ increment: 100 });
              const action = await vscode.window.showInformationMessage(
                `Exported ${total} PDFs to /notebooklm-exports`,
                'Open Folder'
              );

              if (action === 'Open Folder') {
                vscode.commands.executeCommand(
                  'revealFileInOS',
                  vscode.Uri.file(outputDir)
                );
              }
            } catch (err) {
              vscode.window.showErrorMessage(`Export failed: ${err.message}`);
              console.error(err);
            }
            progress.report({ message: 'Done', increment: 100 });
            resolve();
          });
        }
      );
    }
  );

  context.subscriptions.push(disposable);
}

function deactivate() { }

module.exports = { activate, deactivate };
