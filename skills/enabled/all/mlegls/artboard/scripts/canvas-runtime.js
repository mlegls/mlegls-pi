// The canvas in the browser: pan, zoom, arranging frames and pages, entering one frame
// and leaving it, and sending an arrangement back through Lavish.
const viewport = document.querySelector(".canvas-viewport");
const world = document.querySelector(".canvas-world");
// Empty canvas is its own layer, marked as a Lavish control so pressing it pans
// instead of annotating; screens stay annotatable.
const ground = document.querySelector(".canvas-ground");
const zoomLabel = document.querySelector("[data-zoom]");
const backButton = document.querySelector("[data-back]");
const frames = [...document.querySelectorAll(".canvas-frame")];
const pages = [...document.querySelectorAll(".canvas-page")];
// Lavish sandboxes the canvas without its origin, where localStorage throws; the
// arrangement then lasts as long as the page.
const memory = new Map();
const store = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return memory.get(key) ?? null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { memory.set(key, value); }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch { memory.delete(key); }
  },
};
const layoutKey = "screens-layout:" + document.body.dataset.layout;
const viewKey = "screens-view";
let view = JSON.parse(store.get(viewKey) || "null") || { x: 40, y: 40, zoom: 0.5 };
const entered = [];

for (const frame of frames) {
  frame.dataset.homeX = frame.dataset.x;
  frame.dataset.homeY = frame.dataset.y;
}
const saved = JSON.parse(store.get(layoutKey) || "{}");
for (const frame of frames) {
  const at = saved[frame.id];
  if (at) place(frame, at[0], at[1]);
}

function place(frame, x, y) {
  frame.dataset.x = String(Math.round(x));
  frame.dataset.y = String(Math.round(y));
  frame.style.left = frame.dataset.x + "px";
  frame.style.top = frame.dataset.y + "px";
}
function apply() {
  world.style.transform = "translate(" + view.x + "px," + view.y + "px) scale(" + view.zoom + ")";
  zoomLabel.textContent = Math.round(view.zoom * 100) + "%";
  backButton.hidden = !entered.length;
  document.body.toggleAttribute("data-entered", entered.length > 0);
  store.set(viewKey, JSON.stringify(view));
}
function boundsOf(members) {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const frame of members) {
    const x = Number(frame.dataset.x), y = Number(frame.dataset.y);
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + frame.offsetWidth); bottom = Math.max(bottom, y + frame.offsetHeight);
  }
  return { left, top, right, bottom };
}
function layoutPages() {
  for (const page of pages) {
    const members = frames.filter((frame) => frame.dataset.page === page.dataset.page);
    if (!members.length) continue;
    const box = boundsOf(members);
    page.style.left = box.left - 32 + "px";
    page.style.top = box.top - 32 - page.querySelector(".canvas-page-head").offsetHeight + "px";
    page.style.width = box.right - box.left + 64 + "px";
    page.style.height = box.bottom - box.top + 64 + page.querySelector(".canvas-page-head").offsetHeight + "px";
  }
}
function fit(box, cap) {
  const rail = document.querySelector(".canvas-nav").offsetWidth;
  const width = innerWidth - rail - 80, height = innerHeight - 80;
  const zoom = Math.min(cap, width / (box.right - box.left), height / (box.bottom - box.top));
  view = {
    zoom,
    x: rail + 40 + (width - (box.right - box.left) * zoom) / 2 - box.left * zoom,
    y: 40 + (height - (box.bottom - box.top) * zoom) / 2 - box.top * zoom,
  };
  apply();
}
// A page's title and notes sit above its frames.
function withHeads(box) {
  return { ...box, top: box.top - 160 };
}
function enter(frame) {
  entered.push({ ...view });
  fit(boundsOf([frame]), 1);
  try { history.replaceState(null, "", "#" + frame.id); } catch {}
}
function leave() {
  const previous = entered.pop();
  if (!previous) return;
  view = previous;
  apply();
  try { history.replaceState(null, "", location.pathname + location.search); } catch {}
}
function zoomAt(factor, clientX, clientY) {
  const zoom = Math.min(4, Math.max(0.05, view.zoom * factor));
  view.x = clientX - ((clientX - view.x) * zoom) / view.zoom;
  view.y = clientY - ((clientY - view.y) * zoom) / view.zoom;
  view.zoom = zoom;
  apply();
}

viewport.addEventListener("wheel", (event) => {
  const inside = event.target.closest(".canvas-frame");
  if (entered.length && inside && !event.ctrlKey && !event.metaKey) return;
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX, event.clientY);
  else {
    view.x -= event.deltaX;
    view.y -= event.deltaY;
    apply();
  }
}, { passive: false });

addEventListener("keydown", (event) => {
  if (event.target.closest("input, textarea, [contenteditable]")) return;
  if (event.key === "Escape") leave();
  if (event.key === "0" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); fit(withHeads(boundsOf(frames)), 1); }
});

const lastPress = { handle: null, time: 0 };
viewport.addEventListener("pointerdown", (event) => {
  const handle = event.target.closest("[data-drag]");
  const background = event.target === ground;
  if (!handle && !background) return;
  if (event.button !== 0) return;
  event.preventDefault();
  // Pointer capture retargets the second click, and pointerdown carries no click count,
  // so a double-click is timed here.
  const now = performance.now();
  if (handle && lastPress.handle === handle && now - lastPress.time < 400) {
    lastPress.handle = null;
    open(handle);
    return;
  }
  lastPress.handle = handle;
  lastPress.time = now;
  const start = { x: event.clientX, y: event.clientY, view: { ...view } };
  const moving = !handle ? [] : handle.dataset.drag === "page"
    ? frames.filter((frame) => frame.dataset.page === handle.closest(".canvas-page").dataset.page)
    : [handle.closest(".canvas-frame")];
  const origins = moving.map((frame) => [Number(frame.dataset.x), Number(frame.dataset.y)]);
  // Capture on a Lavish control, so the click that ends a drag annotates nothing.
  const holder = handle ?? ground;
  holder.setPointerCapture(event.pointerId);
  const move = (next) => {
    const dx = next.clientX - start.x, dy = next.clientY - start.y;
    if (!moving.length) {
      view.x = start.view.x + dx;
      view.y = start.view.y + dy;
      apply();
      return;
    }
    moving.forEach((frame, index) => place(frame, Math.round((origins[index][0] + dx / view.zoom) / 8) * 8, Math.round((origins[index][1] + dy / view.zoom) / 8) * 8));
    layoutPages();
  };
  const up = () => {
    holder.removeEventListener("pointermove", move);
    holder.removeEventListener("pointerup", up);
    if (moving.some((frame, index) => Number(frame.dataset.x) !== origins[index][0] || Number(frame.dataset.y) !== origins[index][1])) {
      const layout = {};
      for (const frame of frames) layout[frame.id] = [Number(frame.dataset.x), Number(frame.dataset.y)];
      store.set(layoutKey, JSON.stringify(layout));
      document.body.dataset.moved = "";
    }
  };
  holder.addEventListener("pointermove", move);
  holder.addEventListener("pointerup", up);
});

function open(handle) {
  if (handle.dataset.drag === "page") {
    entered.push({ ...view });
    fit(withHeads(boundsOf(frames.filter((frame) => frame.dataset.page === handle.closest(".canvas-page").dataset.page))), 1);
  } else enter(handle.closest(".canvas-frame"));
}

for (const link of document.querySelectorAll("[data-go]")) {
  link.addEventListener("click", () => {
    const target = link.dataset.go;
    if (target === "all") { entered.length = 0; fit(withHeads(boundsOf(frames)), 1); return; }
    const frame = document.getElementById(target);
    if (frame?.classList.contains("canvas-frame")) { entered.length = 0; enter(frame); return; }
    entered.length = 0;
    entered.push({ ...view });
    fit(withHeads(boundsOf(frames.filter((member) => member.dataset.page === target))), 1);
  });
}
backButton.addEventListener("click", leave);
document.querySelector("[data-zoom-in]").addEventListener("click", () => zoomAt(1.25, innerWidth / 2, innerHeight / 2));
document.querySelector("[data-zoom-out]").addEventListener("click", () => zoomAt(0.8, innerWidth / 2, innerHeight / 2));
document.querySelector("[data-reset]").addEventListener("click", () => {
  store.remove(layoutKey);
  for (const frame of frames) place(frame, Number(frame.dataset.homeX), Number(frame.dataset.homeY));
  layoutPages();
  delete document.body.dataset.moved;
});
document.querySelector("[data-save]").addEventListener("click", (event) => {
  const layout = {};
  for (const frame of frames) layout[frame.id] = [Number(frame.dataset.x), Number(frame.dataset.y)];
  if (window.lavish?.queuePrompt) {
    window.lavish.queuePrompt("Save this arrangement into the canvas's layout JSON (each frame's at).", {
      tag: "arrangement", text: "Save the frame arrangement", element: event.currentTarget, data: { layout },
    });
  } else navigator.clipboard?.writeText(JSON.stringify(layout));
});

document.fonts.ready.then(() => {
  for (const element of document.querySelectorAll("[data-scroll]")) {
    const [top, left] = element.dataset.scroll.split(",").map(Number);
    element.scrollTop = top;
    element.scrollLeft = left;
  }
  layoutPages();
  const deep = location.hash ? document.getElementById(location.hash.slice(1)) : null;
  if (deep?.classList.contains("canvas-frame")) enter(deep);
  else apply();
});

