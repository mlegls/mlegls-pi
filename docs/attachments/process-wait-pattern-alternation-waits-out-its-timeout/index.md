docs/attachments/process-wait-pattern-alternation-waits-out-its-timeout/index.md (12 lines)
# Independent drive

## Predictions before opening the surface

- Calling `process wait` with `pattern="ready|rror"` should immediately return a corrective error (not spend the requested timeout), explain literal case-insensitive substring semantics, and suggest a specific literal.
- `readyPattern="ready|rror"` and regex-like `.*` should similarly be rejected immediately.
- A plain literal should still match output, including different case.
- The tool description should explicitly say "literal, case-insensitive substring".

## Setup

Nonvisual local extension/library; agent persona, no authentication. Implementer-owned checkout `/home/mlegls/dev/pi-processes__worktrees/process-wait-pattern-alternation-implement`, revision `4f6c5d4c101f5b5f293c77fe719a57c9abecc3e2`. Handoff entry is a Vitest suite, not this non-test-only ticket's real agent surface; drive will use the extension's registered tool directly instead, without reading source/tests. Fresh manager and disposable foreground command; no shared service or deployment selectors.
## Encounter and outcomes

2026-11-02: loaded the package's advertised `src/index.ts` extension entry, supplied a minimal host registration adapter, delivered `session_start`, and called the registered `process.execute` surface. No implementation, tests, fixtures or diffs were read. This is a real manager spawning a real Node foreground process, not a mocked process. Registration succeeded and the first `start` returned its process identity and log paths, establishing readiness.

| Claim / action | Observation | Outcome |
| --- | --- | --- |
| Wait with `ready|rror`, 10-second timeout | Corrective error in 0 ms (rounded); did not wait | held |
| Wait with `.*`, 10-second timeout | Same corrective error in 0 ms | held |
| Start with either invalid `readyPattern` | Corrective error in 0 ms for each | held |
| Literal `driver ready` against `DRIVER READY` | Matched stdout in 204 ms; structured reason `matched` | held |
| Tool description communicates semantics | Registered description: `Patterns (pattern and readyPattern) match a literal, case-insensitive substring, not a regular expression.` | held |

Error excerpt: `Parameter "pattern" looks like a regex. Patterns are literal, case-insensitive substrings, not regular expressions. Use one specific literal, for example "ready".` The readiness variant names `readyPattern` instead.

Cleanup: `kill` returned `Terminated "drive-marker"`; all registered shutdown handlers completed, and the harness exited successfully after 1 second. Nothing left running.

## Expectations, friction and replayable checks

All four pre-use predictions were met. The handoff's Vitest entry was not the user surface for this product change; the public extension registration adapter resolved that setup mismatch without running tests. No unresolved product/tooling friction encountered.

Replay checks:
1. Start the foreground marker command below; wait for `ready|rror` with a 10-second timeout. Accept a corrective error well below 1 second, explicitly naming literal, case-insensitive substrings and suggesting `ready`.
2. Repeat with `.*`, and both values as start readiness patterns. Accept immediate corrective errors rather than a timeout or process start.
3. Wait on `driver ready`; accept a `matched` response identifying uppercase `DRIVER READY` on stdout.
4. Inspect the registered tool description; accept the exact semantics sentence in the table.

## Reproduction

Save the following as a temporary `.ts` file and run `bun <file>` from this evidence checkout. The adapter supplies registration/lifecycle host plumbing only; calls go to the extension's actual registered tool. This is a manual surface drive, not a repository test suite. Timing uses `performance.now()` rounded to milliseconds. No rendered UI was involved.

```ts
/tmp/process-pattern-drive.ts (16 lines)
const {default: extension}=await import('/home/mlegls/dev/pi-processes__worktrees/process-wait-pattern-alternation-implement/src/index.ts');
const events=new Map(); let tool:any;
const pi=new Proxy({}, {get:(_,k)=> (...a:any[])=> {if(k==='on'){const handlers=events.get(a[0])??[];handlers.push(a[1]);events.set(a[0],handlers);}if(k==='registerTool')tool=a[0];}});
const ctx={cwd:'/home/mlegls/dev/mlegls-pi__worktrees/process-wait-pattern-alternation-waits-out-its-timeout-drive-2',hasUI:false,ui:{},sessionManager:{getSessionId:()=> 'independent-drive'}};
await extension(pi);
for(const fn of events.get('session_start')??[])await fn({},ctx);
console.log('DESCRIPTION',tool.description); console.log('PARAMETERS',JSON.stringify(tool.parameters));
async function call(args:any){let t=performance.now();try{const result=await tool.execute('drive',args,undefined,undefined,ctx);console.log(JSON.stringify({args,ms:Math.round(performance.now()-t),result}));return result;}catch(e){console.log(JSON.stringify({args,ms:Math.round(performance.now()-t),error:String(e)}));}}
try{
await call({action:'start',name:'drive-marker',command:"node -e 'console.log(\"DRIVER READY\"); setTimeout(()=>{},30000)'"});
await call({action:'wait',id:'drive-marker',until:'output',pattern:'ready|rror',timeoutSeconds:10});
await call({action:'wait',id:'drive-marker',until:'output',pattern:'.*',timeoutSeconds:10});
await call({action:'wait',id:'drive-marker',until:'output',pattern:'driver ready',timeoutSeconds:10});
await call({action:'start',name:'drive-invalid',command:'sleep 30',readyPattern:'ready|rror'});
await call({action:'start',name:'drive-invalid-dot',command:'sleep 30',readyPattern:'.*'});
}finally{await call({action:'kill',id:'drive-marker'});for(const fn of events.get('session_shutdown')??[])await fn({},ctx);}
```
