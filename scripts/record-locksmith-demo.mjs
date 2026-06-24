import { mkdir, writeFile } from "node:fs/promises";

const outDir = "/Users/edw/Desktop/qwenhack26/test-recordings/locksmith-six-agents";
await mkdir(outDir, { recursive: true });

const tabInfo = await fetch("http://127.0.0.1:9224/json/new?about:blank", { method: "PUT" }).then((response) => response.json());
const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    pending.get(message.id)(message);
    pending.delete(message.id);
  }
};

await new Promise((resolve, reject) => {
  ws.onopen = resolve;
  ws.onerror = reject;
});

function cdp(method, params = {}) {
  const callId = ++id;
  ws.send(JSON.stringify({ id: callId, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(callId, (message) => message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result));
    setTimeout(() => reject(new Error(`CDP timeout: ${method}`)), 15_000);
  });
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await cdp("Page.enable");
await cdp("Runtime.enable");
await cdp("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await cdp("Page.navigate", { url: "http://127.0.0.1:3003/review" });
await wait(2200);

const frames = [];
async function capture(label) {
  const result = await cdp("Page.captureScreenshot", { format: "png", fromSurface: true });
  const file = `${label}.png`;
  await writeFile(`${outDir}/${file}`, Buffer.from(result.data, "base64"));
  frames.push({ file, data: result.data });
}

await capture("001-start");
const buttonRect = await cdp("Runtime.evaluate", {
  expression: "(() => { const r = document.querySelector('.demo-review')?.getBoundingClientRect(); return r && JSON.stringify({ x: r.left + r.width / 2, y: r.top + r.height / 2 }); })()",
  returnByValue: true,
});
const point = JSON.parse(buttonRect.result.value);
await cdp("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
await cdp("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
await cdp("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
for (let i = 2; i <= 16; i += 1) {
  await wait(450);
  await capture(String(i).padStart(3, "0"));
}

const result = await cdp("Runtime.evaluate", {
  expression: "JSON.stringify({ verdict: document.querySelector('.block-word')?.textContent?.trim(), roles: [...document.querySelectorAll('.discussion-row strong')].map(n => n.textContent.trim()), rows: [...document.querySelectorAll('.discussion-row p')].map(n => n.textContent.trim()) })",
  returnByValue: true,
});
const testResult = JSON.parse(result.result.value || "{}");
await writeFile(`${outDir}/test-result.json`, JSON.stringify(testResult, null, 2));

const html = `<!doctype html><meta charset="utf-8"><title>Locksmith six-agent recording</title><style>body{margin:0;background:#111;color:white;font:14px ui-monospace,Menlo,monospace;display:grid;place-items:center;min-height:100vh}main{width:min(1440px,100vw)}img{width:100%;display:block;background:#fff}header{display:flex;justify-content:space-between;gap:20px;padding:10px 14px;background:#111}button{font:inherit;padding:8px 12px}</style><main><header><b>Locksmith six-agent demo recording</b><span id="t"></span><button onclick="playing=!playing">Play/Pause</button></header><img id="f" alt="recording frame"></main><script>const frames=${JSON.stringify(frames.map((frame) => `data:image/png;base64,${frame.data}`))};let i=0,playing=true;const img=document.getElementById('f'),t=document.getElementById('t');function draw(){img.src=frames[i];t.textContent=(i+1)+' / '+frames.length;if(playing)i=(i+1)%frames.length}draw();setInterval(draw,650);</script>`;
await writeFile(`${outDir}/recording.html`, html);

await cdp("Target.closeTarget", { targetId: tabInfo.id });
ws.close();

console.log(JSON.stringify({ outDir, frames: frames.length, testResult }, null, 2));
