/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow, dialog } = require("electron");
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const DEFAULT_PORT = 3000;
const HOST = "127.0.0.1";
let mainWindow;
let nextServerProcess;

app.setName("Card Creator");

function waitForPort(port, host, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const attemptConnection = () => {
      const socket = net.connect({ port: Number(port), host }, () => {
        socket.end();
        resolve();
      });

      socket.on("error", () => {
        socket.destroy();

        if (Date.now() - startedAt > timeoutMs) {
          reject(new Error(`Timed out waiting for ${host}:${port}`));
          return;
        }

        setTimeout(attemptConnection, 250);
      });
    };

    attemptConnection();
  });
}

function getStandaloneServerPath() {
  const candidates = [
    path.join(process.resourcesPath, "standalone", "server.js"),
    path.join(
      process.resourcesPath,
      "app.asar.unpacked",
      ".next",
      "standalone",
      "server.js",
    ),
    path.join(process.resourcesPath, ".next", "standalone", "server.js"),
    path.join(app.getAppPath(), ".next", "standalone", "server.js"),
    path.join(
      process.resourcesPath,
      "app.asar",
      ".next",
      "standalone",
      "server.js",
    ),
  ];

  const matched = candidates.find((candidate) => fs.existsSync(candidate));
  if (matched) {
    return matched;
  }

  return candidates[0];
}

function getServerWorkingDirectory(serverPath) {
  const isAsarPath = serverPath.includes(".asar");
  if (isAsarPath) {
    return process.resourcesPath;
  }

  return path.dirname(serverPath);
}

function getStandaloneModulesPath(serverCwd) {
  const candidates = [
    path.join(process.resourcesPath, "standalone-deps"),
    path.join(serverCwd, "node_modules"),
    path.join(serverCwd, "standalone-deps"),
  ];

  const matched = candidates.find((candidate) => fs.existsSync(candidate));
  return matched ?? candidates[0];
}

function canListenOnPort(port, host) {
  return new Promise((resolve) => {
    const tester = net.createServer();

    tester.once("error", () => {
      resolve(false);
    });

    tester.once("listening", () => {
      tester.close(() => {
        resolve(true);
      });
    });

    tester.listen(port, host);
  });
}

function reserveEphemeralPort(host) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();

    tester.once("error", (error) => {
      reject(error);
    });

    tester.listen(0, host, () => {
      const address = tester.address();

      if (!address || typeof address !== "object") {
        reject(new Error("Unable to determine ephemeral port"));
        return;
      }

      const { port } = address;
      tester.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });
}

async function getAvailablePort(host) {
  const requestedPort = Number.parseInt(process.env.PORT ?? "", 10);
  const preferredPort = Number.isFinite(requestedPort)
    ? requestedPort
    : DEFAULT_PORT;

  if (await canListenOnPort(preferredPort, host)) {
    return preferredPort;
  }

  return reserveEphemeralPort(host);
}

function startNextServer(port) {
  const serverPath = getStandaloneServerPath();
  const serverCwd = getServerWorkingDirectory(serverPath);
  const serverModulesPath = getStandaloneModulesPath(serverCwd);
  const logFile = path.join(app.getPath("userData"), "server.log");

  const header =
    [
      `[${new Date().toISOString()}] Starting Card Creator server`,
      `  serverPath : ${serverPath}`,
      `  serverCwd  : ${serverCwd}`,
      `  modulePath : ${serverModulesPath}`,
      `  execPath   : ${process.execPath}`,
      `  port       : ${port}`,
      `  resources  : ${process.resourcesPath}`,
    ].join("\n") + "\n";

  if (!fs.existsSync(serverPath)) {
    const msg = `Standalone server not found at: ${serverPath}`;
    fs.writeFileSync(logFile, header + msg + "\n", "utf8");
    throw new Error(msg);
  }

  if (!fs.existsSync(serverCwd)) {
    const msg = `Server working directory not found at: ${serverCwd}`;
    fs.writeFileSync(logFile, header + msg + "\n", "utf8");
    throw new Error(msg);
  }

  fs.writeFileSync(logFile, header, "utf8");
  const logStream = fs.createWriteStream(logFile, { flags: "a" });

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: serverCwd,
    env: {
      ...process.env,
      HOSTNAME: HOST,
      PORT: String(port),
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
      NODE_PATH: process.env.NODE_PATH
        ? `${serverModulesPath}${path.delimiter}${process.env.NODE_PATH}`
        : serverModulesPath,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  nextServerProcess.stdout.on("data", (chunk) =>
    logStream.write(`[stdout] ${chunk}`),
  );
  nextServerProcess.stderr.on("data", (chunk) =>
    logStream.write(`[stderr] ${chunk}`),
  );

  const serverExited = new Promise((_, reject) => {
    nextServerProcess.on("error", (error) => {
      logStream.write(`[error] ${error.message}\n`);
      reject(new Error(`Server process error: ${error.message}`));
    });

    nextServerProcess.on("exit", (code) => {
      logStream.write(`[exit] code=${code ?? "null"}\n`);
      if (code !== 0) {
        reject(
          new Error(
            `Server exited with code ${code ?? "unknown"}. Log: ${logFile}`,
          ),
        );
      }
    });
  });

  return serverExited;
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
      sandbox: true,
    },
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      const logFile = path.join(app.getPath("userData"), "server.log");
      dialog.showErrorBox(
        "Card Creator – Load Error",
        `The app failed to load (${errorCode}: ${errorDescription}).\n\nSee log for details:\n${logFile}`,
      );
    },
  );

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const port = await getAvailablePort(HOST);
  const serverExited = startNextServer(port);

  await Promise.race([waitForPort(port, HOST), serverExited]);
  await mainWindow.loadURL(`http://${HOST}:${port}`);
}

function cleanupServer() {
  if (!nextServerProcess) {
    return;
  }

  nextServerProcess.kill();
  nextServerProcess = null;
}

app.on("window-all-closed", () => {
  cleanupServer();
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("before-quit", () => {
  cleanupServer();
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
