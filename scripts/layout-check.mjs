#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { access, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const DOCS = path.join(ROOT, "docs");
const WIDTHS = [320, 360, 390, 430, 768, 1440];
const MIME = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
};

function serveDocs() {
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.resolve(DOCS, `.${pathname}`);

    if (!filePath.startsWith(`${DOCS}${path.sep}`)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    response.setHeader("Content-Type", MIME[path.extname(filePath)] ?? "application/octet-stream");
    createReadStream(filePath)
      .on("error", () => response.writeHead(404).end("Not found"))
      .pipe(response);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      ...options,
    });
    child.on("exit", (code) => resolve(code ?? 1));
    child.on("error", () => resolve(1));
  });
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function findPlaywrightInstall() {
  const npxRoot = path.join(homedir(), ".npm", "_npx");
  if (!(await pathExists(npxRoot))) return null;

  const entries = await readdir(npxRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const nodeModules = path.join(npxRoot, entry.name, "node_modules");
    const cli = path.join(nodeModules, "@playwright", "test", "cli.js");
    if (await pathExists(cli)) return { nodeModules, cli };
  }

  return null;
}

async function ensurePlaywrightInstall() {
  let install = await findPlaywrightInstall();
  if (install) return install;

  const code = await run("npx", ["--yes", "@playwright/test", "--version"], { cwd: ROOT });
  if (code !== 0) throw new Error("Unable to install or locate @playwright/test through npx");

  install = await findPlaywrightInstall();
  if (!install) throw new Error("Unable to locate @playwright/test after npx install");
  return install;
}

function specSource() {
  return `
import { test } from "@playwright/test";

const url = process.env.LOTTO_LAYOUT_URL;
const widths = ${JSON.stringify(WIDTHS)};
const tolerance = 1.5;

function checkMeasurement(data) {
  const errors = [];

  if (data.documentScrollWidth > data.documentClientWidth + 1) {
    errors.push(\`document overflows horizontally: \${data.documentScrollWidth} > \${data.documentClientWidth}\`);
  }
  if (data.latestScrollWidth > data.latestClientWidth + 1) {
    errors.push(\`latest draw overflows horizontally: \${data.latestScrollWidth} > \${data.latestClientWidth}\`);
  }
  if (data.latestBallsScrollWidth > data.latestBallsClientWidth + 1) {
    errors.push(\`latest balls overflow horizontally: \${data.latestBallsScrollWidth} > \${data.latestBallsClientWidth}\`);
  }
  if (data.heroScrollWidth > data.heroClientWidth + 1) {
    errors.push(\`hero overflows horizontally: \${data.heroScrollWidth} > \${data.heroClientWidth}\`);
  }
  if (data.latest.left < -1 || data.latest.right > data.viewportWidth + 1) {
    errors.push(\`latest draw escapes viewport: left \${data.latest.left}, right \${data.latest.right}\`);
  }

  data.balls.forEach((ball, index) => {
    const { rect, textRect } = ball;
    const xDelta = Math.abs((rect.left + rect.right) / 2 - (textRect.left + textRect.right) / 2);
    const yDelta = Math.abs((rect.top + rect.bottom) / 2 - (textRect.top + textRect.bottom) / 2);
    const circular = Math.abs(rect.width - rect.height) <= tolerance;

    if (ball.display !== "grid") {
      errors.push(\`ball \${index + 1} display is \${ball.display}, expected grid\`);
    }
    if (ball.placeItems !== "center" && (ball.alignItems !== "center" || ball.justifyItems !== "center")) {
      errors.push(\`ball \${index + 1} is not grid-centered: place-items \${ball.placeItems}\`);
    }
    if (ball.flexShrink !== "0") {
      errors.push(\`ball \${index + 1} flex-shrink is \${ball.flexShrink}, expected 0\`);
    }
    if (Math.abs(rect.width - 40) > tolerance || Math.abs(rect.height - 40) > tolerance || !circular) {
      errors.push(\`ball \${index + 1} is not a stable 40px circle: \${rect.width}x\${rect.height}\`);
    }
    if (xDelta > tolerance || yDelta > tolerance) {
      errors.push(\`ball \${index + 1} text is off-center: delta \${xDelta.toFixed(2)}, \${yDelta.toFixed(2)}\`);
    }
    if (
      textRect.left < rect.left - tolerance ||
      textRect.right > rect.right + tolerance ||
      textRect.top < rect.top - tolerance ||
      textRect.bottom > rect.bottom + tolerance ||
      ball.overflowX > 0 ||
      ball.overflowY > 0
    ) {
      errors.push(\`ball \${index + 1} text is clipped or outside the circle\`);
    }
  });

  const bonusBall = data.balls.at(-1);
  if (bonusBall && Math.abs(data.bonus.top - bonusBall.rect.top) > 2) {
    errors.push(\`bonus separator is not aligned with bonus ball: \${data.bonus.top} vs \${bonusBall.rect.top}\`);
  }
  if (bonusBall && data.bonus.right > bonusBall.rect.left) {
    errors.push("bonus separator overlaps the bonus ball");
  }

  return errors;
}

for (const width of widths) {
  test(\`latest draw geometry at \${width}px\`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      return document.querySelectorAll("#latestDraw .latest-balls .ball").length === 7;
    });

    const data = await page.evaluate(() => {
      const rectData = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const textRectData = (element) => {
        const range = document.createRange();
        range.selectNodeContents(element);
        const rect = range.getBoundingClientRect();
        range.detach();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };
      const latest = document.querySelector("#latestDraw");
      const latestBalls = document.querySelector(".latest-balls");
      const hero = document.querySelector(".hero");
      const bonus = document.querySelector(".bonus-label");
      const balls = [...document.querySelectorAll("#latestDraw .latest-balls .ball")];

      return {
        viewportWidth: window.innerWidth,
        documentClientWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        latest: rectData(latest),
        latestClientWidth: latest.clientWidth,
        latestScrollWidth: latest.scrollWidth,
        latestBallsClientWidth: latestBalls.clientWidth,
        latestBallsScrollWidth: latestBalls.scrollWidth,
        heroClientWidth: hero.clientWidth,
        heroScrollWidth: hero.scrollWidth,
        bonus: {
          ...rectData(bonus),
          display: getComputedStyle(bonus).display,
        },
        balls: balls.map((ball) => {
          const styles = getComputedStyle(ball);
          return {
            text: ball.textContent,
            rect: rectData(ball),
            textRect: textRectData(ball),
            display: styles.display,
            placeItems: styles.placeItems,
            alignItems: styles.alignItems,
            justifyItems: styles.justifyItems,
            flexShrink: styles.flexShrink,
            borderRadius: styles.borderRadius,
            overflowX: ball.scrollWidth - ball.clientWidth,
            overflowY: ball.scrollHeight - ball.clientHeight,
          };
        }),
      };
    });

    const errors = checkMeasurement(data);
    if (errors.length) {
      throw new Error(\`Layout failures at \${width}px:\\n\${errors.map((error) => \`- \${error}\`).join("\\n")}\`);
    }

    console.log(\`ok \${width}px\`);
  });
}
`;
}

async function main() {
  const server = await serveDocs();
  const tempDir = await mkdtemp(path.join(ROOT, ".layout-check-"));
  const specPath = path.join(tempDir, "layout-check.spec.js");
  const { port } = server.address();

  try {
    await writeFile(specPath, specSource(), "utf8");
    const playwright = await ensurePlaywrightInstall();
    const code = await run(process.execPath, [
      playwright.cli,
      "test",
      specPath,
      "--browser=chromium",
      `--output=${path.join(tempDir, "test-results")}`,
      "--reporter=line",
      "--workers=1",
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        NODE_PATH: playwright.nodeModules,
        LOTTO_LAYOUT_URL: `http://127.0.0.1:${port}/`,
      },
    });

    process.exitCode = code;
  } finally {
    server.close();
    await rm(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
