/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require("electron");
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

  if (!fs.existsSync(serverPath)) {
    throw new Error(`Standalone server not found at ${serverPath}`);
  }

  if (!fs.existsSync(serverCwd)) {
    throw new Error(`Server working directory not found at ${serverCwd}`);
  }

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: serverCwd,
    env: {
      ...process.env,
      HOSTNAME: HOST,
      PORT: String(port),
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
  });

  nextServerProcess.on("error", (error) => {
    console.error("Failed to start Next standalone server:", error);
  });

  nextServerProcess.on("exit", (code) => {
    if (code !== 0) {
      console.error(
        `Next standalone server exited with code ${code ?? "unknown"}`,
      );
    }
  });
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

  if (process.env.ELECTRON_DEV_SERVER_URL) {
    await mainWindow.loadURL(process.env.ELECTRON_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  const port = await getAvailablePort(HOST);

  startNextServer(port);
  await waitForPort(port, HOST);
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

app.whenReady().then(createWindow);

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow().catch((error) => {
      console.error(error);
      app.quit();
    });
  }
});
