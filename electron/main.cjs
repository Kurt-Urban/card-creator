/* eslint-disable @typescript-eslint/no-require-imports */
const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const net = require("node:net");
const path = require("node:path");

const DEFAULT_PORT = 3000;
const HOST = "127.0.0.1";
let mainWindow;
let nextServerProcess;

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
  return path.join(app.getAppPath(), ".next", "standalone", "server.js");
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

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: path.dirname(serverPath),
    env: {
      ...process.env,
      HOSTNAME: HOST,
      PORT: String(port),
      NODE_ENV: "production",
      ELECTRON_RUN_AS_NODE: "1",
    },
    stdio: "inherit",
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
    title: "Enchunted Card Creator",
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
