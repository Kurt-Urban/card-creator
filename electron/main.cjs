/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const { execFile } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

let mainWindow;
let resolvedGitCommand = null;

app.setName("Card Creator");

function getGitCommandCandidates() {
  if (process.platform === "win32") {
    return ["git.exe", "git.cmd", "git"];
  }

  return ["git"];
}

function shouldRetryWithDifferentGitCommand(error) {
  const message =
    `${error?.message ?? ""} ${error?.stderr ?? ""}`.toLowerCase();
  return message.includes("enoent") || message.includes("not recognized");
}

function execGitCommand(command, args, cwd) {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd,
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: "0",
        },
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject({
            ...error,
            stdout,
            stderr,
          });
          return;
        }

        resolve({ stdout, stderr });
      },
    );
  });
}

async function runGit(args, cwd) {
  const candidates = resolvedGitCommand
    ? [resolvedGitCommand]
    : getGitCommandCandidates();

  let lastError = null;
  for (const command of candidates) {
    try {
      const result = await execGitCommand(command, args, cwd);
      resolvedGitCommand = command;
      return result;
    } catch (error) {
      lastError = error;
      if (!shouldRetryWithDifferentGitCommand(error)) {
        throw error;
      }
    }
  }

  throw lastError;
}

function formatGitFailure(error, fallbackMessage) {
  const combinedOutput =
    `${error?.stderr ?? ""}\n${error?.stdout ?? ""}\n${error?.message ?? ""}`.trim();
  const normalizedOutput = combinedOutput.toLowerCase();

  if (
    normalizedOutput.includes("please tell me who you are") ||
    normalizedOutput.includes("unable to auto-detect email address") ||
    normalizedOutput.includes("user.name") ||
    normalizedOutput.includes("user.email")
  ) {
    return {
      code: "no-user",
      message:
        "Git commit failed because no local git user name/email is configured for this repository or machine.",
      details: combinedOutput,
    };
  }

  if (
    normalizedOutput.includes("permission denied (publickey)") ||
    normalizedOutput.includes("authentication failed") ||
    normalizedOutput.includes("could not read username") ||
    normalizedOutput.includes("repository not found") ||
    normalizedOutput.includes("remote: permission to")
  ) {
    return {
      code: "auth",
      message:
        "Git authentication failed. The desktop app can only use credentials already available to your local git setup.",
      details: combinedOutput,
    };
  }

  if (
    normalizedOutput.includes("no upstream branch") ||
    normalizedOutput.includes("no tracking information for the current branch")
  ) {
    return {
      code: "upstream",
      message:
        "This branch has no upstream tracking branch configured, so push/pull cannot run automatically.",
      details: combinedOutput,
    };
  }

  if (
    normalizedOutput.includes("please commit your changes or stash them") ||
    normalizedOutput.includes(
      "your local changes to the following files would be overwritten",
    )
  ) {
    return {
      code: "dirty",
      message:
        "Git pull was blocked by local changes. Commit or stash them first.",
      details: combinedOutput,
    };
  }

  if (normalizedOutput.includes("not a git repository")) {
    return {
      code: "not-repo",
      message: "The selected folder is not inside a git repository.",
      details: combinedOutput,
    };
  }

  if (normalizedOutput.includes("enoent")) {
    return {
      code: "git-missing",
      message: "Git is not installed or is not available on PATH.",
      details: combinedOutput,
    };
  }

  return {
    code: "unknown",
    message: fallbackMessage,
    details: combinedOutput,
  };
}

async function safeGitOutput(args, cwd) {
  try {
    const result = await runGit(args, cwd);
    return result.stdout.trim();
  } catch {
    return "";
  }
}

async function inspectGitRepo(folderPath) {
  if (typeof folderPath !== "string" || folderPath.trim().length === 0) {
    return {
      ok: false,
      code: "invalid-path",
      message: "No folder path was provided for git repo detection.",
    };
  }

  try {
    await runGit(["--version"], folderPath);
  } catch (error) {
    return {
      ok: false,
      ...formatGitFailure(error, "Git is not available on this machine."),
    };
  }

  let repoRoot;
  try {
    const result = await runGit(["rev-parse", "--show-toplevel"], folderPath);
    repoRoot = result.stdout.trim();
  } catch (error) {
    return {
      ok: false,
      ...formatGitFailure(
        error,
        "Could not determine the git repository for that folder.",
      ),
    };
  }

  const [branch, remoteUrl, userName, userEmail] = await Promise.all([
    safeGitOutput(["branch", "--show-current"], repoRoot),
    safeGitOutput(["remote", "get-url", "origin"], repoRoot),
    safeGitOutput(["config", "--get", "user.name"], repoRoot),
    safeGitOutput(["config", "--get", "user.email"], repoRoot),
  ]);

  return {
    ok: true,
    repo: {
      repoRoot,
      repoName: path.basename(repoRoot),
      branch: branch || "detached-head",
      remoteUrl: remoteUrl || null,
      userName: userName || null,
      userEmail: userEmail || null,
    },
  };
}

async function runGitRepoAction(folderPath, args, successMessage) {
  const inspection = await inspectGitRepo(folderPath);
  if (!inspection.ok) {
    return inspection;
  }

  try {
    await runGit(args, inspection.repo.repoRoot);
    const refreshedInspection = await inspectGitRepo(inspection.repo.repoRoot);
    if (!refreshedInspection.ok) {
      return refreshedInspection;
    }

    return {
      ok: true,
      message: successMessage,
      repo: refreshedInspection.repo,
    };
  } catch (error) {
    return {
      ok: false,
      ...formatGitFailure(error, "Git command failed."),
      repo: inspection.repo,
    };
  }
}

function parseChangedFiles(statusOutput) {
  return statusOutput
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean)
    .map((line) => line.slice(3).trim())
    .map((filePath) => {
      if (filePath.includes(" -> ")) {
        return filePath.split(" -> ").at(-1) ?? filePath;
      }

      return filePath;
    });
}

function buildCommitMessage(changedFiles) {
  const normalizedNames = Array.from(
    new Set(
      changedFiles.map((filePath) => path.basename(filePath)).filter(Boolean),
    ),
  );

  if (normalizedNames.length === 0) {
    return "Update files";
  }

  if (normalizedNames.length <= 3) {
    return `Update ${normalizedNames.join(", ")}`;
  }

  return `Update ${normalizedNames.slice(0, 3).join(", ")} and ${
    normalizedNames.length - 3
  } more`;
}

async function commitAndPushRepo(folderPath, commitMessageOverride) {
  const inspection = await inspectGitRepo(folderPath);
  if (!inspection.ok) {
    return inspection;
  }

  try {
    const statusResult = await runGit(
      ["status", "--porcelain"],
      inspection.repo.repoRoot,
    );
    const changedFiles = parseChangedFiles(statusResult.stdout);
    let commitSummary = "";

    if (changedFiles.length > 0) {
      await runGit(["add", "--all"], inspection.repo.repoRoot);
      const commitMessage =
        typeof commitMessageOverride === "string" &&
        commitMessageOverride.trim().length > 0
          ? commitMessageOverride.trim()
          : buildCommitMessage(changedFiles);
      await runGit(["commit", "-m", commitMessage], inspection.repo.repoRoot);
      commitSummary = `Committed ${changedFiles.length} changed file${
        changedFiles.length === 1 ? "" : "s"
      } (${changedFiles.join(", ")}). `;
    }

    await runGit(["push"], inspection.repo.repoRoot);

    const refreshedInspection = await inspectGitRepo(inspection.repo.repoRoot);
    if (!refreshedInspection.ok) {
      return refreshedInspection;
    }

    return {
      ok: true,
      message: `${commitSummary}Pushed local commits to the remote repository.`,
      repo: refreshedInspection.repo,
    };
  } catch (error) {
    return {
      ok: false,
      ...formatGitFailure(error, "Git push failed."),
      repo: inspection.repo,
    };
  }
}

async function ensurePathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureFileHandle(filePath, create) {
  const exists = await ensurePathExists(filePath);
  if (!exists && !create) {
    const error = new Error(`File not found: ${filePath}`);
    error.name = "NotFoundError";
    throw error;
  }

  if (!exists && create) {
    await fs.writeFile(filePath, "", "utf8");
  }

  return { ok: true };
}

async function ensureDirectoryHandle(directoryPath, create) {
  const exists = await ensurePathExists(directoryPath);
  if (!exists && !create) {
    const error = new Error(`Directory not found: ${directoryPath}`);
    error.name = "NotFoundError";
    throw error;
  }

  if (!exists && create) {
    await fs.mkdir(directoryPath, { recursive: false });
  }

  return { ok: true };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: "#0f172a",
    autoHideMenuBar: true,
    title: "Card Creator",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.cjs"),
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      dialog.showErrorBox(
        "Card Creator – Load Error",
        `The app failed to load (${errorCode}: ${errorDescription}).`,
      );
    },
  );

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), "dist", "index.html"));
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app
  .whenReady()
  .then(createWindow)
  .catch((error) => {
    dialog.showErrorBox(
      "Card Creator – Startup Error",
      String(error.message ?? error),
    );
    app.quit();
  });

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
});

ipcMain.handle("git:pick-repo", async () => {
  const result = await dialog.showOpenDialog({
    properties: ["openDirectory"],
    title: "Choose a folder inside the git repository",
  });

  if (result.canceled || result.filePaths.length === 0) {
    return {
      ok: false,
      code: "cancelled",
      message: "Git repo selection was cancelled.",
    };
  }

  return inspectGitRepo(result.filePaths[0]);
});

ipcMain.handle("git:detect-repo", async (_event, folderPath) => {
  return inspectGitRepo(folderPath);
});

ipcMain.handle("git:pull-repo", async (_event, folderPath) => {
  return runGitRepoAction(
    folderPath,
    ["pull", "--ff-only"],
    "Pulled the latest changes from the remote repository.",
  );
});

ipcMain.handle("git:push-repo", async (_event, folderPath, commitMessage) => {
  return commitAndPushRepo(folderPath, commitMessage);
});

ipcMain.handle("fs:list-directory", async (_event, directoryPath) => {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });
  return entries.map((entry) => ({
    name: entry.name,
    kind: entry.isDirectory() ? "directory" : "file",
  }));
});

ipcMain.handle(
  "fs:get-file-handle",
  async (_event, directoryPath, fileName, create = false) => {
    const filePath = path.join(directoryPath, fileName);
    await ensureFileHandle(filePath, create);
    return { filePath };
  },
);

ipcMain.handle(
  "fs:get-directory-handle",
  async (_event, directoryPath, directoryName, create = false) => {
    const nextDirectoryPath = path.join(directoryPath, directoryName);
    await ensureDirectoryHandle(nextDirectoryPath, create);
    return {
      path: nextDirectoryPath,
      name: path.basename(nextDirectoryPath),
    };
  },
);

ipcMain.handle("fs:read-text-file", async (_event, filePath) => {
  return fs.readFile(filePath, "utf8");
});

ipcMain.handle("fs:write-text-file", async (_event, filePath, content) => {
  await fs.writeFile(filePath, content, "utf8");
  return { ok: true };
});

ipcMain.handle("fs:write-binary-file", async (_event, filePath, base64) => {
  await fs.writeFile(filePath, Buffer.from(base64, "base64"));
  return { ok: true };
});

ipcMain.handle(
  "fs:remove-entry",
  async (_event, directoryPath, entryName, recursive = false) => {
    await fs.rm(path.join(directoryPath, entryName), {
      recursive,
      force: false,
    });
    return { ok: true };
  },
);
