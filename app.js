/* SIP News Radar: a browser-only daily briefing tool. Data is stored locally in this browser. */
const DEFAULT = {
  brief: 'SIP preparation: opportunities, policy, sector developments, skills and deadlines.',
  keywords: ['SIP','internship','summer internship','placement','recruitment','application','deadline','policy','skills','industry','career','education'],
  sources: [
    ['SIP opportunities','https://news.google.com/rss/search?q=SIP+internship+opportunities+when:7d&hl=en-IN&gl=IN&ceid=IN:en',3],
    ['Education & careers','https://news.google.com/rss/search?q=student+internship+career+India+when:7d&hl=en-IN&gl=IN&ceid=IN:en',2],
    ['Policy & industry','https://news.google.com/rss/search?q=India+education+policy+skills+industry+when:7d&hl=en-IN&gl=IN&ceid=IN:en',2]
  ]
};
const key = 'sip-news-radar-v1';
let state = JSON.parse(localStorage.getItem(key) || 'null') || {...DEFAULT, archive:{}};
let activeFilter = 'all';
const $ = s => document.querySelector(s);
const esc = s => String(s||'').replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const dayKey = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata'}).format(new Date());
const prettyDay = d => new Date(d+'T12:00:00').toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
const save = () => localStorage.setItem(key, JSON.stringify(state));

function draw() {
  const today = dayKey(), stories = state.archive[today]?.stories || [];
  $('#briefText').textContent = state.brief; $('#todayLabel').textContent = prettyDay(today);
  $('#storyCount').textContent = stories.length; $('#sourceCount').textContent = state.sources.length;
  $('#highCount').textContent = stories.filter(s=>s.score>=60).length; $('#archiveCount').textContent = Object.keys(state.archive).length;
  $('#sources').innerHTML = state.sources.map(([name,,priority])=>`<div class="source-row"><span>${esc(name)}</span><small>Priority ${priority}</small></div>`).join('');
  const filtered = stories.filter(s=>activeFilter==='all'||(activeFilter==='high'&&s.score>=60)||(activeFilter==='opportunity'&&/opportun|internship|application|deadline|recruit/i.test(s.title+' '+s.summary)));
  const feed=$('#feed'); feed.innerHTML='';
  if(!filtered.length){feed.innerHTML=`<div class="empty">No stories in this view yet. Choose <b>Refresh daily brief</b> to collect today’s articles.</div>`;}
  filtered.forEach(story=>{const n=$('#storyTemplate').content.cloneNode(true);n.querySelector('.source').textContent=story.source;n.querySelector('.score').textContent=`Relevance ${story.score}`;let a=n.querySelector('.story-title');a.textContent=story.title;a.href=story.link;n.querySelector('.story-meta').textContent=`${story.date ? new Date(story.date).toLocaleDateString('en-IN',{day:'numeric',month:'short'})+' · ' : ''}${story.publisher||'Source article'}`;n.querySelector('.story-reason').textContent=story.reason;a=n.querySelector('.original-link');a.href=story.link;feed.append(n)});
  const dates=Object.keys(state.archive).sort().reverse(); $('#archive').innerHTML=dates.length?dates.map(d=>`<article class="archive-card"><h3>${prettyDay(d)}</h3><p>${state.archive[d].stories.length} saved articles · refreshed ${state.archive[d].refreshedAt||'—'}</p><button data-date="${d}">View this brief →</button></article>`).join(''):'<div class="empty">Your saved daily briefs will appear here.</div>';
}
function score(item, priority){const text=(item.title+' '+item.summary).toLowerCase();const hits=state.keywords.filter(k=>text.includes(k.toLowerCase()));const urgency=/deadline|apply|application|registration|last date|opportunity|internship/.test(text)?12:0;return {score:Math.min(99,Math.round(22+priority*11+hits.length*10+urgency)),reason:hits.length?`Matched: ${hits.slice(0,4).join(', ')}${urgency?' · includes an action signal':''}`:`Included from a priority source${urgency?' · includes an action signal':''}`};}
function xmlItems(xml, source, priority){const doc=new DOMParser().parseFromString(xml,'text/xml');return [...doc.querySelectorAll('item')].map(i=>{const title=i.querySelector('title')?.textContent?.trim()||'';const link=i.querySelector('link')?.textContent?.trim()||'';const summary=(i.querySelector('description')?.textContent||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();const publisher=(title.match(/\s+-\s+([^–-]+)$/)||[])[1]||source;const ranked=score({title,summary},priority);return {title:title.replace(/\s+-\s+[^–-]+$/,''),link,summary,date:i.querySelector('pubDate')?.textContent||'',publisher,source, ...ranked};}).filter(x=>x.title&&x.link)}
async function fetchSource([name,url,priority]) { const proxy='https://api.allorigins.win/raw?url='+encodeURIComponent(url); const response=await fetch(proxy); if(!response.ok)throw new Error(name); return xmlItems(await response.text(),name,Number(priority)); }
async function refresh(){const btn=$('#refreshBtn');btn.disabled=true;btn.textContent='Collecting articles…';$('#status').textContent='Reading active sources';try{const results=await Promise.allSettled(state.sources.map(fetchSource));const failures=results.filter(r=>r.status==='rejected').length;const unique=new Map;results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).forEach(s=>{const k=s.title.toLowerCase().replace(/[^a-z0-9]/g,'');if(!unique.has(k)||unique.get(k).score<s.score)unique.set(k,s)});const stories=[...unique.values()].sort((a,b)=>b.score-a.score).slice(0,60);state.archive[dayKey()]={stories,refreshedAt:new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})};save();$('#status').textContent=failures?`${failures} source${failures>1?'s':''} unavailable`:`Updated ${new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`;draw()}catch(e){$('#status').textContent='Couldn’t reach the feeds — try again shortly.'}finally{btn.disabled=false;btn.textContent='Refresh daily brief'}}
function openSettings(){ $('#briefInput').value=state.brief;$('#keywordsInput').value=state.keywords.join(', ');$('#sourcesInput').value=state.sources.map(x=>x.join(' | ')).join('\n');$('#settingsDialog').showModal(); }
function applySettings(e){e.preventDefault();const sources=$('#sourcesInput').value.split('\n').map(x=>x.split('|').map(y=>y.trim())).filter(x=>x.length>=2&&x[0]&&x[1]).map(x=>[x[0],x[1],Math.max(1,Math.min(3,Number(x[2])||1))]);if(!sources.length)return;state.brief=$('#briefInput').value.trim()||DEFAULT.brief;state.keywords=$('#keywordsInput').value.split(',').map(x=>x.trim()).filter(Boolean);state.sources=sources;save();$('#settingsDialog').close();draw();}
$('#refreshBtn').onclick=refresh;$('#editBrief').onclick=openSettings;$('#manageSources').onclick=openSettings;$('#saveSettings').onclick=applySettings;
document.querySelectorAll('.chip').forEach(b=>b.onclick=()=>{document.querySelectorAll('.chip').forEach(x=>x.classList.remove('active'));b.classList.add('active');activeFilter=b.dataset.filter;draw();});
$('#archive').onclick=e=>{const b=e.target.closest('[data-date]');if(!b)return;const d=b.dataset.date;state.archive[dayKey()]=state.archive[d];save();activeFilter='all';document.querySelectorAll('.chip').forEach(x=>x.classList.toggle('active',x.dataset.filter==='all'));draw();window.scrollTo({top:0,behavior:'smooth'});};
$('#exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state.archive,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='sip-news-radar-archive.json';a.click();URL.revokeObjectURL(a.href)};
draw();

