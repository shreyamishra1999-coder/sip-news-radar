import json,re,time,html,hashlib,urllib.parse,urllib.request
from datetime import datetime,timezone,timedelta
from email.utils import parsedate_to_datetime
from pathlib import Path
import xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1];C=json.loads((ROOT/"config.json").read_text());DATA=ROOT/"data";ARCH=DATA/"archive";ARCH.mkdir(parents=True,exist_ok=True);LATEST=DATA/"latest.json";HISTORY=DATA/"history.json";HEAD={"User-Agent":"Mozilla/5.0 MBA-News-Radar/5.0"};RETENTION_DAYS=90
def clean(s):return re.sub(r"\s+"," ",html.unescape(re.sub(r"<[^>]+>"," ",s or ""))).strip()
def lo(s):return clean(s).lower()
def hit(t,a):return[x for x in a if x.lower() in t]
def classify(t,f):
 d={k:len(hit(t,v)) for k,v in C["industries"].items()};b=max(d,key=d.get);return b if d[b] else f
def pivot(t):
 g={"Strategy":["strategy","market entry","m&a","acquisition","merger","transformation"],"Operations":["supply chain","procurement","logistics","manufacturing","inventory","capacity","cost"],"Product":["product","launch","innovation","portfolio","approval"],"Commercial":["pricing","sales","distribution","market share","marketing","brand","consumer"],"Policy":["policy","regulation","rbi","government","budget","tariff"],"Trade & Exports":["export","import","trade","shipping","wto","fta"],"Companies":["earnings","quarterly","management commentary","capex"]};return max(g,key=lambda k:sum(x in t for x in g[k]))
def summary(title,desc):
 d=clean(desc);bits=[x.strip() for x in re.split(r"(?<=[.!?])\s+",d) if len(x.strip())>30 and lo(x)!=lo(title)]
 if bits:
  s=" ".join(bits[:3]);return s[:480].rstrip()+"…" if len(s)>480 else s
 return "This development matched the radar’s sector and business-impact criteria. Open the original report for full context, figures and management or policy detail."
def rank(title,desc,ind,pri,date):
 t=lo(title+" "+desc);sec=hit(t,C["industries"].get(ind,[]));biz=hit(t,C["business"]);pls=[p for p in C["players"].get(ind,[]) if p.lower() in t];junk=hit(t,C["negative"]);anchors=len(sec)+len(biz)+(2 if pls else 0)
 if junk and anchors<3:return None
 if anchors<1:return None
 india=bool(re.search(r"\bindia(n)?\b|\brbi\b|\brupee\b|\bmumbai\b|\bdelhi\b",t));glob=bool(re.search(r"\bexport|\bimport|\bglobal|\bchina|\beurope|\btrade|\bshipping|\bu\.?s\.?\b|\bwto\b|\bfta\b",t))
 try:
  dt=parsedate_to_datetime(date);dt=dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc);days=max(0,(datetime.now(timezone.utc)-dt).total_seconds()/86400);rec=10 if days<=2 else 8 if days<=7 else 5 if days<=14 else 2
 except:rec=4
 gd=10 if ind=="Current Affairs" or any(x in t for x in["policy","regulation","geopolit","inflation","gdp","rbi","tariff","trade"])else 5;score=min(100,min(20,len(sec)*5)+min(20,len(biz)*5)+(15 if india else 4)+(10 if pls else 0)+gd+min(10,pri*3+1)+rec+(5 if india and glob else 0));why=sec[:2]+biz[:2]+(["India"]if india else[])+pls[:1]+(["global/trade linkage"]if india and glob else[]);return score," · ".join(why[:7]),("Global"if glob and not india else"India"),(pls[0]if pls else"")
def fetch(src):
 u="https://news.google.com/rss/search?q="+urllib.parse.quote(src["q"])+"&hl=en-IN&gl=IN&ceid=IN:en";req=urllib.request.Request(u,headers=HEAD)
 with urllib.request.urlopen(req,timeout=25)as r:xml=ET.fromstring(r.read())
 out=[]
 for it in xml.findall(".//item"):
  title=clean(it.findtext("title"));desc=clean(it.findtext("description"));link=clean(it.findtext("link"));date=clean(it.findtext("pubDate"));ind=classify(lo(title+" "+desc),src["industry"]);rr=rank(title,desc,ind,src["priority"],date)
  if not rr:continue
  score,why,geo,player=rr;key=hashlib.sha1(re.sub(r"[^a-z0-9]","",lo(re.sub(r"\s+-\s+[^-]+$","",title))).encode()).hexdigest()[:16];out.append({"id":key,"title":title,"summary":summary(title,desc),"link":link,"date":date,"source":src["name"],"industry":ind,"pivot":pivot(lo(title+" "+desc)),"score":score,"reason":"Why ranked: "+why,"geo":geo,"player":player})
 return out
now=datetime.now(timezone.utc);stamp=now.isoformat();today=now.date().isoformat();tf=ARCH/f"{today}.json";existing={}
if tf.exists():
 try:existing={x["id"]:x for x in json.loads(tf.read_text()).get("stories",[])}
 except:pass
fetched=[];status=[]
for src in C["sources"]:
 try:a=fetch(src);fetched+=a;status.append({"source":src["name"],"ok":True,"count":len(a)})
 except Exception as e:status.append({"source":src["name"],"ok":False,"count":0,"error":str(e)[:140]})
 time.sleep(.15)
lm={}
for s in fetched:
 old=existing.get(s["id"]);s["first_seen"]=old.get("first_seen",stamp)if old else stamp;s["last_seen"]=stamp;s["is_new"]=not bool(old)
 if s["id"]not in lm or lm[s["id"]]["score"]<s["score"]:lm[s["id"]]=s
 if s["id"]not in existing or existing[s["id"]].get("score",0)<=s["score"]:existing[s["id"]]=s
ts=sorted(existing.values(),key=lambda x:x["score"],reverse=True);tf.write_text(json.dumps({"date":today,"generated_at":stamp,"story_count":len(ts),"stories":ts},ensure_ascii=False,indent=2))
cut=now.date()-timedelta(days=RETENTION_DAYS)
for f in ARCH.glob("*.json"):
 try:
  if datetime.strptime(f.stem,"%Y-%m-%d").date()<cut:f.unlink()
 except:pass
dates=sorted([f.stem for f in ARCH.glob("*.json")],reverse=True);HISTORY.write_text(json.dumps({"generated_at":stamp,"retention_days":RETENTION_DAYS,"dates":dates},indent=2));latest=sorted(lm.values(),key=lambda x:x["score"],reverse=True)
if not latest and LATEST.exists():
 try:latest=json.loads(LATEST.read_text()).get("stories",[])
 except:pass
LATEST.write_text(json.dumps({"generated_at":stamp,"story_count":len(latest),"source_status":status,"stories":latest},ensure_ascii=False,indent=2));print(f"latest={len(latest)} today={len(ts)} healthy={sum(x['ok'] for x in status)}/{len(status)} archives={len(dates)}")