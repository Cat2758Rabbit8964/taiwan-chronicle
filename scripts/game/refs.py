import json, re, urllib.request, urllib.parse, html
GJ='/Users/c_a_t/claude_projects/taiwan-chronicle/data/game.json'
import os
D=json.load(open(GJ)); P=D['people']
UA={'User-Agent':'Mozilla/5.0 (taiwan-chronicle research)'}
def get(u,t=30):
    for i in range(3):
        try: return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=t).read().decode('utf-8','replace')
        except Exception as e: err=e
    raise err
def clean(n): return re.sub(r'[·・]','',re.sub(r'[(（].*','',n))
rep=[]
for p in P:
    name=clean(p['name']); yrs=re.findall(r'\d{4}',p['life'])
    if p.get('refs'): continue
    refs=[]
    if p['country']=='台灣' and 'memory.nhrm' not in p['ref']:
        try:
            t=get('https://memory.nhrm.gov.tw/FullSearch/FullSearch?searchKeyword='+urllib.parse.quote(name))
            for m in re.finditer(r'"Title":"([^"]*)","Content":"((?:[^"\\]|\\.)*)","HitRate":"[^"]*","LinkUrl":"(/TopicExploration/Person/Detail/\d+)"',t):
                if clean(html.unescape(m.group(1)))==name:
                    body=html.unescape(m.group(2))
                    ok=any(y in body for y in yrs) or any(y in body for y in [p['died'][:4]])
                    rep.append((p['name'],'memory',ok,body[:60].replace('\n',' ')))
                    if ok: refs.append({'label':f'國家人權記憶庫「{p["name"]}」','url':'https://memory.nhrm.gov.tw'+m.group(3)})
                    break
        except Exception as e: rep.append((p['name'],'memory-ERR',False,str(e)[:40]))
    if p['country']=='日本':
        u='https://kotobank.jp/word/'+urllib.parse.quote(name)
        try:
            t=get(u); ti=re.search(r'<title>(.*?)</title>',t,re.S)
            ok=bool(ti and name in ti.group(1)) and any(y in t[:60000] for y in yrs)
            rep.append((p['name'],'kotobank',ok,(ti.group(1)[:50] if ti else '')))
            if ok: refs.append({'label':f'コトバンク「{p["name"]}」','url':u})
        except Exception as e: rep.append((p['name'],'kotobank-ERR',False,str(e)[:40]))
    if refs: p['refs']=refs
    else: p.pop('refs',None)
json.dump(D,open(GJ,'w'),ensure_ascii=False,indent=1)
json.dump(rep,open('/tmp/refs_report.json','w'),ensure_ascii=False,indent=1)
print('有其他連結:',sum(1 for p in P if p.get('refs')),'/',len(P))
print('未通過驗證:',[(r[0],r[1]) for r in rep if not r[2]])
