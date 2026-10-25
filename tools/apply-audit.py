#!/usr/bin/env python3
"""python3 tools/apply-audit.py reply.txt out-name  -> يكتب tools/overrides/<out-name>.json من رد المراجع (كتلة JSON)."""
import json,re,sys
txt=open(sys.argv[1],encoding='utf-8').read()
m=re.search(r'```json\s*(.*?)```',txt,re.S);raw=m.group(1) if m else txt
items=json.loads(raw)
out={}
for it in items:
    r=it['replacement'];r.pop('id',None);out[it['id']]=r
json.dump(out,open(f'tools/overrides/{sys.argv[2]}.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(len(out),'overrides')
