"""OM-era foreground recall frequency; deduplicate copied/forked transcript entries."""
import json
from pathlib import Path
from collections import Counter
seen=set(); counts=Counter(); recalls=[]; sessions=set(); recall_sessions=set()
for p in sorted((Path.home()/'.pi/agent/sessions').glob('*/*.jsonl')):
    if p.name[:10]>'2026-09-24': continue
    # Explicit recall/module-shadowing smoke fixture, not organic use.
    if '01a0bf2a-5295-74cd-bbc0-43fe035a8534' in p.name: continue
    active=False; folded=False
    for line in p.open():
        try:e=json.loads(line)
        except ValueError:continue
        if str(e.get('customType','')).startswith('om.') or e.get('details',{}).get('type')=='om.folded':active=True
        if e.get('type')=='compaction' and e.get('details',{}).get('type')=='om.folded':folded=True
        t=e.get('timestamp','');m=e.get('message',{})
        if not active or not '2026-09-20'<=t<'2026-09-25' or m.get('role')!='assistant':continue
        key=(e.get('id'),t)
        if key in seen:continue
        seen.add(key);sessions.add(str(p));counts['assistant_requests']+=1
        if folded:counts['requests_after_om_compaction']+=1
        for b in m.get('content',[]):
            if not isinstance(b,dict) or b.get('type')!='toolCall':continue
            counts['tool_calls']+=1
            if b.get('name')=='recall':
                counts['recall_calls']+=1;recall_sessions.add(str(p))
                recalls.append(dict(path=str(p),entry=e['id'],time=t,args=b.get('arguments'),after_compaction=folded))
print(json.dumps(dict(counts=counts,files_contributing=len(sessions),files_with_recall=len(recall_sessions),recalls=recalls),indent=2))
