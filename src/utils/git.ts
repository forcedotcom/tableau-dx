import * as vscode from 'vscode';
import * as path from 'path';

export interface GitCommit {
  hash: string;
  shortHash: string;
  author: string;
  date: Date;
  message: string;
  filesChanged: string[];
}

/**
 * Get git commits that modified files in a specific folder
 * @param folderPath - The folder path to check for commits
 * @returns Array of commits that modified files in the folder
 */
export async function getCommitsForFolder(folderPath: string): Promise<GitCommit[]> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, folderPath);
    
    // Get commit history for the folder
    // Format: hash|shortHash|author|date|message
    const logResult = await executeGitCommand(
      workspaceFolder.uri.fsPath,
      [
        'log',
        '--pretty=format:%H|%h|%an|%aI|%s',
        '--',
        relativePath
      ]
    );

    if (!logResult.trim()) {
      return [];
    }

    const commits: GitCommit[] = [];
    const lines = logResult.split('\n').filter(line => line.trim());

    for (const line of lines) {
      const [hash, shortHash, author, date, ...messageParts] = line.split('|');
      const message = messageParts.join('|'); // In case message contains |

      // Get files changed in this commit for the specific folder
      const filesResult = await executeGitCommand(
        workspaceFolder.uri.fsPath,
        [
          'diff-tree',
          '--no-commit-id',
          '--name-only',
          '-r',
          hash,
          '--',
          relativePath
        ]
      );

      const filesChanged = filesResult
        .split('\n')
        .filter(f => f.trim())
        .map(f => path.basename(f));

      commits.push({
        hash,
        shortHash,
        author,
        date: new Date(date),
        message,
        filesChanged
      });
    }

    return commits;
  } catch (error) {
    console.error('Failed to get git commits:', error);
    throw error;
  }
}

/**
 * Get file content at a specific commit
 * @param filePath - Absolute path to the file
 * @param commitHash - Git commit hash
 * @returns File content as string
 */
export async function getFileAtCommit(filePath: string, commitHash: string): Promise<string> {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      throw new Error('No workspace folder found');
    }

    const relativePath = path.relative(workspaceFolder.uri.fsPath, filePath);
    
    const content = await executeGitCommand(
      workspaceFolder.uri.fsPath,
      ['show', `${commitHash}:${relativePath}`]
    );

    return content;
  } catch (error) {
    console.error(`Failed to get file at commit ${commitHash}:`, error);
    throw error;
  }
}

/**
 * Check if a path is in a git repository
 * @param folderPath - The folder path to check
 * @returns true if in a git repository
 */
export async function isGitRepository(folderPath: string): Promise<boolean> {
  try {
    await executeGitCommand(folderPath, ['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

/**
 * Execute a git command
 * @param cwd - Working directory
 * @param args - Git command arguments
 * @returns Command output
 */
async function executeGitCommand(cwd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const git = spawn('git', args, { cwd });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    git.on('close', (code: number) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(`Git command failed: ${stderr}`));
      }
    });

    git.on('error', (error: Error) => {
      reject(error);
    });
  });
}
