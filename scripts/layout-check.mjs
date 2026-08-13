import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";

const python = existsSync(".venv/bin/python") ? ".venv/bin/python" : "python3";

const script = String.raw`
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from threading import Thread
import functools
import sys

try:
    from playwright.sync_api import sync_playwright
except Exception as exc:
    print(f"FAIL: playwright is unavailable: {exc}", file=sys.stderr)
    sys.exit(1)

root = Path("docs").resolve()
artifacts = Path("artifacts").resolve()
artifacts.mkdir(exist_ok=True)

handler = functools.partial(SimpleHTTPRequestHandler, directory=str(root))
server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/"

viewports = [
    ("desktop-1440", 1440, 1000),
    ("tablet-768", 768, 1000),
    ("mobile-430", 430, 1000),
    ("mobile-390", 390, 1000),
    ("mobile-360", 360, 1000),
    ("mobile-320", 320, 1000),
]

selectors = [
    ".topbar",
    ".brand",
    ".nav",
    ".hero-content",
    ".latest-draw",
    ".latest-balls",
    ".hero-readout",
    ".draw-console",
    ".scale-row",
    ".chart-stage",
    ".instrument",
    ".probability-readout",
    ".rank-panel",
]

def inspect_page(page):
    return page.evaluate(
        """(selectors) => {
            const viewport = window.innerWidth;
            const failures = [];
            for (const selector of selectors) {
                for (const element of document.querySelectorAll(selector)) {
                    const rect = element.getBoundingClientRect();
                    const style = getComputedStyle(element);
                    if (style.display === "none" || style.visibility === "hidden" || rect.width === 0 || rect.height === 0) continue;
                    if (rect.left < -1 || rect.right > viewport + 1) {
                        failures.push({
                            selector,
                            left: Math.round(rect.left),
                            right: Math.round(rect.right),
                            width: Math.round(rect.width),
                            text: element.textContent.trim().replace(/\\s+/g, " ").slice(0, 80),
                        });
                    }
                }
            }
            return {
                viewport,
                scrollWidth: document.documentElement.scrollWidth,
                bodyScrollWidth: document.body.scrollWidth,
                failures,
            };
        }""",
        selectors,
    )

failed = False
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        for name, width, height in viewports:
            page = browser.new_page(viewport={"width": width, "height": height}, device_scale_factor=1)
            page.goto(url, wait_until="networkidle")
            page.wait_for_timeout(500)
            result = inspect_page(page)
            page.evaluate("""() => {
                document.querySelectorAll(".reveal").forEach((element) => element.classList.add("is-visible"));
            }""")
            screenshot = artifacts / f"layout-{name}.png"
            page.screenshot(path=str(screenshot), full_page=True)
            has_overflow = result["scrollWidth"] > result["viewport"] + 1 or result["bodyScrollWidth"] > result["viewport"] + 1
            has_failures = bool(result["failures"])
            status = "FAIL" if has_overflow or has_failures else "PASS"
            failed = failed or status == "FAIL"
            print(f"{status} {name}: viewport={result['viewport']}, scrollWidth={result['scrollWidth']}, screenshot={screenshot}")
            for failure in result["failures"]:
                print(f"  {failure['selector']}: left={failure['left']}, right={failure['right']}, width={failure['width']}, text=\"{failure['text']}\"")
            page.close()
        browser.close()
finally:
    server.shutdown()

sys.exit(1 if failed else 0)
`;

const result = spawnSync(python, ["-c", script], {
  cwd: process.cwd(),
  encoding: "utf8",
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
