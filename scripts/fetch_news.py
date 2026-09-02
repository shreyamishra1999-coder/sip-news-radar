import json, re, time, html, hashlib, urllib.parse, urllib.request
from datetime import datetime, timezone
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
CFG=json.loads((ROOT/"config.json").read_text(encoding="utf-8"))
OUT=ROOT/"data/news.json"
UA={"User-Agent":"Mozilla/5.0 MBA-Interview-News-Radar/3.0"}

def clean(s):
    s=html.unescape(re.sub(r"<[^>]+>"," ",s or ""))
    return re.sub(r"\s+"," ",s).strip()
def low(s): return clean(s).lower()
def matches(text, terms): return [t for t in terms if t.lower() in text]
def pivot(t):
    groups={"Strategy":["strategy","market entry","m&a","acquisition","merger","transformation"],
    "Operations":["supply chain","procurement","logistics","manufacturing","inventory","capacity","cost"],
    "Product":["product","launch","innovation","portfolio","approval"],
    "Commercial":["pricing","sales","distribution","market share","marketing","brand","consumer"],
    "Policy":["policy","regulation","rbi","government","budget","tariff"],
    "Trade & Exports":["export","import","trade","shipping","wto","fta"],
    "Companies":["earnings","quarterly","management commentary","capex"]}
    return max(groups, key=lambda k:sum(x in t for x in groups[k]))
def classify(t, fallback):
    scores={k:len(matches(t,v)) for k,v in CFG["industries"].items()}
    best=max(scores,key=scores.get)
    return best if scores[best] else fallback
def rank(title, desc, industry, priority):
    t=low(title+" "+desc)
    sector=matches(t,CFG["industries"].get(industry,[]))
    biz=matches(t,CFG["business"])
    players=[p for p in CFG["players"].get(industry,[]) if p.lower() in t]
    junk=matches(t,CFG["negative"])
    # Context gate: generic junk is rejected unless strong sector/business evidence exists.
    if junk and len(sector)+len(biz)+(2 if players else 0)<2: return None
    # Broad articles require at least one meaningful sector/business/company anchor.
    if not sector and not biz and not players: return None
    india=bool(re.search(r"\bindia(n)?\b|\brbi\b|\brupee\b|\bmumbai\b|\bdelhi\b",t))
    glob=bool(re.search(r"\bexport|\bimport|\bglobal|\bchina|\beurope|\btrade|\bshipping|\bus\b|\bu\.s\.",t))
    s=10 + min(20,len(sector)*5)+min(20,len(biz)*5)+(15 if india else 0)+(10 if players else 0)+priority*3+(5 if india and glob else 0)
    s=min(100,s)
    why=(sector[:2]+biz[:2]+(["India"] if india else [])+players[:1]+(["global/trade"] if glob else []))
    return s, " · ".join(why[:6]) or "priority source", ("Global" if glob and not india else "India"), (players[0] if players else "")
def fetch(src):
    q=urllib.parse.quote(src["q"])
    url=f"https://news.google.com/rss/search?q={q}&hl=en-IN&gl=IN&ceid=IN:en"
    req=urllib.request.Request(url,headers=UA)
    with urllib.request.urlopen(req,timeout=25) as r: data=r.read()
    root=ET.fromstring(data)
    out=[]
    for it in root.findall(".//item"):
        title=clean(it.findtext("title")); desc=clean(it.findtext("description"))
        link=clean(it.findtext("link")); date=clean(it.findtext("pubDate"))
        industry=classify(low(title+" "+desc),src["industry"])
        ranked=rank(title,desc,industry,src["priority"])
        if not ranked: continue
        score,why,geo,player=ranked
        out.append({"id":hashlib.sha1((title+link).encode()).hexdigest()[:12],"title":title,"summary":desc[:600],
        "link":link,"date":date,"source":src["name"],"industry":industry,"pivot":pivot(low(title+" "+desc)),
        "score":score,"reason":"Why ranked: "+why,"geo":geo,"player":player})
    return out

old=[]
if OUT.exists():
    try: old=json.loads(OUT.read_text(encoding="utf-8")).get("stories",[])
    except: pass
stories=[]; status=[]
for src in CFG["sources"]:
    try:
        items=fetch(src); stories+=items; status.append({"source":src["name"],"ok":True,"count":len(items)})
    except Exception as e:
        status.append({"source":src["name"],"ok":False,"count":0,"error":str(e)[:120]})
    time.sleep(.2)
# Deduplicate normalized headlines, retain highest score.
dedup={}
for s in stories:
    key=re.sub(r"[^a-z0-9]","",low(re.sub(r"\s+-\s+[^-]+$","",s["title"])))
    if key not in dedup or dedup[key]["score"]<s["score"]: dedup[key]=s
stories=sorted(dedup.values(),key=lambda x:x["score"],reverse=True)
# Fail-safe: never overwrite a useful snapshot with an empty failed run.
if not stories and old: stories=old
payload={"generated_at":datetime.now(timezone.utc).isoformat(),"story_count":len(stories),"source_status":status,"stories":stories}
OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding="utf-8")
print(f"Wrote {len(stories)} stories; {sum(x['ok'] for x in status)}/{len(status)} sources OK")
