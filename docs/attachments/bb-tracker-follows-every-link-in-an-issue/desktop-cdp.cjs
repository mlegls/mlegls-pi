// Run on the browser host with Node 22+: node desktop-cdp.cjs <private-connection.json> [link text]
// A diagnostic for this encounter, not an acceptance test. Never print the connection.
const fs = require('node:fs');
const { wsEndpoint } = JSON.parse(fs.readFileSync(process.argv[2]));
const ws = new WebSocket(wsEndpoint);
const pending = new Map();
let id = 0;
ws.onmessage = ({ data }) => {
  const m = JSON.parse(data);
  if (!m.id) return;
  const p = pending.get(m.id);
  pending.delete(m.id);
  m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result);
};
function call(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
ws.onopen = async () => {
  try {
    const { targetInfos } = await call('Target.getTargets');
    if (targetInfos.length !== 1) throw Error('Expected exactly the one leased tab');
    const { sessionId } = await call('Target.attachToTarget', { targetId: targetInfos[0].targetId, flatten: true });
    const evaluate = expression => call('Runtime.evaluate', { expression, returnByValue: true }, sessionId);
    if (process.argv[3]) {
      const found = await evaluate('(()=>{const a=[...document.querySelectorAll("a")].find(a=>a.textContent==='+JSON.stringify(process.argv[3])+'); if(!a) throw Error("Link missing"); a.scrollIntoView({block:"center"}); const r=a.getClientRects()[0]; return {x:r.x+r.width/2,y:r.y+r.height/2};})()');
      if (found.exceptionDetails) throw Error(found.exceptionDetails.text);
      const { x, y } = found.result.value;
      for (const type of ['mousePressed', 'mouseReleased']) {
        await call('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 }, sessionId);
      }
      console.log('Clicked '+process.argv[3]+'; inspect a fresh capture after loading.');
    } else {
      const state = await evaluate('JSON.stringify({title:document.title,links:[...document.querySelectorAll("a")].filter(a=>/Mission|cases-first/.test(a.textContent)).map(a=>({text:a.textContent,href:a.getAttribute("href")}))})');
      console.log(state.result.value);
    }
  } catch (e) {
    console.error(e.message);
    process.exitCode = 1;
  } finally { ws.close(); }
};
