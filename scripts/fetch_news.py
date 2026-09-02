import json,re,time,html,hashlib,urllib.parse,urllib.request
from datetime import datetime,timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]; C=json.loads((ROOT/"config.json").read_text()); OUT=ROOT/"data/news.json"
HEAD={"User-Agent":"Mozilla/5.0 MBA-News-Radar/4.0"}
def clean(s): return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",s or ""))).strip()
def lo(s): return clean(s).lower()
def hit(t,a): return [x for x in a if x.lower() in t]
def classify(t,f):
 d={k:len(hit(t,v)) for k,v in C["industries"].items()}; b=max(d,key=d.get); return b if d[b] else f
def pv(t):
 g={"Strategy":["strategy","market entry","m&a","acquisition","merger","transformation"],"Operations":["supply chain","procurement","logistics","manufacturing","inventory","capacity","cost"],"Product":["product","launch","innovation","portfolio","approval"],"Commercial":["pricing","sales","distribution","market share","marketing","brand","consumer"],"Policy":["policy","regulation","rbi","government","budget","tariff"],"Trade & Exports":["export","import","trade","shipping","wto","fta"],"Companies":["earnings","quarterly","management commentary","capex"]}
 return max(g,key=lambda k:sum(x in t for x in g[k]))
def rank(title,desc,ind,pri,date):
 t=lo(title+" "+desc); sec=hit(t,C["industries"].get(ind,[])); biz=hit(t,C["business"]); pls=[p for p in C["players"].get(ind,[]) if p.lower() in t]; junk=hit(t,C["negative"])
 # Context/near-keyword gate: broad or junk stories need multiple independent anchors.
 anchors=len(sec)+len(biz)+(2 if pls else 0)
 if junk and anchors<3:return None
 if anchors<1:return None
 india=bool(re.search(r"\bindia(n)?\b|\brbi\b|\brupee\b|\bmumbai\b|\bdelhi\b",t)); glob=bool(re.search(r"\bexport|\bimport|\bglobal|\bchina|\beurope|\btrade|\bshipping|\bu\.?s\.?\b|\bwto\b|\bfta\b",t))
 try:
  days=max(0,(datetime.now(timezone.utc)-parsedate_to_datetime(date)).total_seconds()/86400); rec=10 if days<=2 else 8 if days<=7 else 5 if days<=14 else 2
 except: rec=4
 # 0-100: sector 20, business 20, India 15, company 10, GD/current-affairs 10, source 10, recency 10, India/global link 5
 sector=min(20,len(sec)*5); impact=min(20,len(biz)*5); india_s=15 if india else 4; company=10 if pls else 0
 gd=10 if (ind=="Current Affairs" or any(x in t for x in ["policy","regulation","geopolit","inflation","gdp","rbi","tariff","trade"])) else 5
 source=min(10,pri*3+1); linkage=5 if india and glob else 0
 score=min(100,sector+impact+india_s+company+gd+source+rec+linkage)
 why=(sec[:2]+biz[:2]+(["India"] if india else [])+pls[:1]+(["global/trade linkage"] if india and glob else []))
 return score," · ".join(why[:7]),("Global" if glob and not india else "India"),(pls[0] if pls else "")
def fetch(src):
 u="https://news.google.com/rss/search?q="+urllib.parse.quote(src["q"])+"&hl=en-IN&gl=IN&ceid=IN:en"
 req=urllib.request.Request(u,headers=HEAD)
 with urllib.request.urlopen(req,timeout=25) as r: root=ET.fromstring(r.read())
 out=[]
 for it in root.findall(".//item"):
  title=clean(it.findtext("title")); desc=clean(it.findtext("description")); link=clean(it.findtext("link")); date=clean(it.findtext("pubDate"))
  ind=classify(lo(title+" "+desc),src["industry"]); rr=rank(title,desc,ind,src["priority"],date)
  if not rr:continue
  score,why,geo,player=rr
  out.append({"id":hashlib.sha1((title+link).encode()).hexdigest()[:12],"title":title,"summary":desc[:650],"link":link,"date":date,"source":src["name"],"industry":ind,"pivot":pv(lo(title+" "+desc)),"score":score,"reason":"Why ranked: "+why,"geo":geo,"player":player})
 return out
old=[]
if OUT.exists():
 try:old=json.loads(OUT.read_text()).get("stories",[])
 except:pass
all_,status=[],[]
for s in C["sources"]:
 try:
  a=fetch(s);all_+=a;status.append({"source":s["name"],"ok":True,"count":len(a)})
 except Exception as e:status.append({"source":s["name"],"ok":False,"count":0,"error":str(e)[:140]})
 time.sleep(.15)
d={}
for s in all_:
 k=re.sub("[^a-z0-9]","",lo(re.sub(r"\s+-\s+[^-]+$","",s["title"])))
 if k not in d or d[k]["score"]<s["score"]:d[k]=s
stories=sorted(d.values(),key=lambda x:x["score"],reverse=True)
if not stories and old:stories=old
OUT.write_text(json.dumps({"generated_at":datetime.now(timezone.utc).isoformat(),"story_count":len(stories),"source_status":status,"stories":stories},ensure_ascii=False,indent=2))
print(f"{len(stories)} stories; {sum(x['ok'] for x in status)}/{len(status)} feeds healthy")
