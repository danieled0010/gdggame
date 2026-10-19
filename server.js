'use strict';
// GDG Tech Challenge: dependency-free online / local multiplayer quiz server.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const QRCode = require('./vendor/QRCode');
const PORT = Number(process.env.PORT || 3000);
const HOST = '0.0.0.0';
const ROOT = __dirname;
const QUESTIONS = JSON.parse(fs.readFileSync(path.join(ROOT, 'questions.json'), 'utf8')).questions;
const nicknamePolicy = require('./nickname-filter');
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(ROOT, 'data'));
const DATA_FILE = path.join(DATA_DIR, 'session.json');
const configuredURL = process.env.PUBLIC_BASE_URL || process.env.RENDER_EXTERNAL_URL || '';
const PUBLIC_BASE_URL = (() => {
  if (!configuredURL) return '';
  const url = new URL(configuredURL);
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_BASE_URL must be an HTTP(S) origin, for example https://quiz.example.com');
  }
  return url.origin;
})();
const ONLINE = Boolean(PUBLIC_BASE_URL);
const PRODUCTION = ONLINE || process.env.NODE_ENV === 'production';
if (PRODUCTION && !process.env.ADMIN_TOKEN) throw new Error('Set ADMIN_TOKEN before starting an online server');
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || crypto.randomBytes(18).toString('hex');
if (!/^[A-Za-z0-9_-]{32,256}$/.test(ADMIN_TOKEN)) throw new Error('ADMIN_TOKEN must contain 32–256 letters, numbers, underscores or hyphens');
fs.mkdirSync(DATA_DIR, {recursive:true, mode:0o700});
const MAX_PLAYERS = 60;
const FOCUS_MIN_AWAY_MS = 2500; // Ignore brief OS interruptions; this remains only a heuristic.
const clients = new Set();
const nicePin = () => String(crypto.randomInt(100000,1000000));
const newGame = () => ({gameId:crypto.randomUUID(), pin:nicePin(), phase:'lobby', index:-1, deadline:0, remaining:0, paused:false, answers:{}, history:{}, players:{}, focusMode:'warn', updated:Date.now()});
let state;
try {
  const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  state = raw && raw.gameId && raw.players && typeof raw.pin === 'string' ? raw : newGame();
  if (state.phase === 'question') { if (!state.paused) state.remaining = Math.max(0, state.deadline - Date.now()); state.paused = true; }
} catch (_) { state = newGame(); }
if (!['warn','penalty'].includes(state.focusMode)) state.focusMode='warn'; // Migration from v1 saves
const allPlayerIds = () => Object.keys(state.players);
let saveTimer;
let revealTimer;
function scheduleAutoReveal() {
  clearTimeout(revealTimer);
  if(state.phase!=='question' || state.paused)return;
  const questionIndex=state.index, deadline=state.deadline;
  revealTimer=setTimeout(()=>{
    if(state.phase==='question' && !state.paused && state.index===questionIndex && state.deadline===deadline && Date.now()>=deadline) reveal();
  },Math.max(0,deadline-Date.now())+15);
}
function saveNow() {
  clearTimeout(saveTimer);
  const temp = DATA_FILE + '.tmp';
  try { fs.writeFileSync(temp, JSON.stringify(state, null, 2), {mode:0o600}); fs.renameSync(temp, DATA_FILE); }
  catch (err) { console.error('Session save failed:', err.message); }
}
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 120);
}
function networkIPs() {
  const result = [];
  for (const [name, entries] of Object.entries(os.networkInterfaces())) {
    for (const item of entries || []) if (item.family === 'IPv4' && !item.internal) result.push({interface:name, ip:item.address});
  }
  return result;
}
function ranking() {
  const players = Object.values(state.players).map(p => ({id:p.id, name:p.name, score:p.score, correct:p.correct, joined:p.joined}));
  players.sort((a,b)=>b.score-a.score || b.correct-a.correct || a.joined-b.joined);
  let lastScore=null, lastRank=0;
  return players.map((p,i)=> {
    if(p.score!==lastScore){lastRank=i+1;lastScore=p.score;}
    return {...p, rank:lastRank};
  });
}
function snapshot(role, playerId) {
  const activeQuestion = QUESTIONS[state.index];
  const visibleQuestion = activeQuestion && state.index >= 0 ? {
    id:activeQuestion.id, number:state.index+1, category:activeQuestion.category,
    difficulty:activeQuestion.difficulty, prompt:activeQuestion.question,
    options:activeQuestion.options, code:activeQuestion.code || null,
    codeLanguage:activeQuestion.code_language || null, duration:activeQuestion.time_sec
  } : null;
  const base = {
    gameId:state.gameId,pin:state.pin,phase:state.phase,paused:state.paused,
    questionCount:QUESTIONS.length,index:state.index,question:visibleQuestion,
    remainingMs:state.phase === 'question' ? (state.paused ? state.remaining : Math.max(0,state.deadline-Date.now())) : 0,
    answeredCount:Object.keys(state.answers || {}).length,playerCount:allPlayerIds().length,
    serverTime:Date.now(), leaderboard:ranking().slice(0,state.phase === 'finished' ? 60 : 10),
    joiningAllowed:state.phase==='lobby',focusMode:state.focusMode,
  };
  if (state.phase==='lobby') base.names = Object.values(state.players).map(p=>p.name);
  if (state.phase==='reveal' || state.phase==='leaderboard' || state.phase==='finished') {
    if (visibleQuestion) {
      base.correctIndex=activeQuestion.correct_index;
      base.explanation=activeQuestion.explanation;
      base.distribution=activeQuestion.options.map((_,i)=>Object.values(state.answers||{}).filter(a=>a.choice === i).length);
    }
  }
  if (role==='player') {
    const p=state.players[playerId];
    if (p) {
      const rank=ranking().find(r=>r.id===p.id);
      base.me={id:p.id,name:p.name,score:p.score,correct:p.correct,rank:rank.rank,
        answer:state.answers[p.id] ? state.answers[p.id].choice : null,
        earned:state.answers[p.id] ? state.answers[p.id].points : 0,
        focusWarnings:p.focusWarnings||0,focusPenalty:p.focusPenalty||0,lastFocus:p.lastFocus||null};
    }
    delete base.names;
    base.leaderboard= state.phase==='finished' ? ranking().slice(0,5) : state.phase==='leaderboard' ? ranking().slice(0,5) : [];
  }
  if (role==='host') {
    base.players=ranking();
    base.focusReport=Object.values(state.players).map(p=>({name:p.name,warnings:p.focusWarnings||0,penalty:p.focusPenalty||0}));
    base.fullAnswers=Object.entries(state.answers||{}).map(([id,a])=>({name:state.players[id]?.name, choice:a.choice, points:a.points}));
  }
  return base;
}
function pushClient(client) {
  try { client.res.write('data: '+JSON.stringify(snapshot(client.role,client.playerId))+'\n\n'); }
  catch (_) {clients.delete(client);}
}
function broadcast() { for(const c of clients) pushClient(c); }
function json(res,status,value) {
  const data=JSON.stringify(value);
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(data);
}
function fail(res,status,message) { json(res,status,{error:message}); }
function parseBody(req) { return new Promise((resolve,reject)=>{
  let content=''; req.on('data',x=>{content+=x;if(content.length>12000){reject(new Error('Request too large'));req.destroy();}});
  req.on('end',()=>{try{
    const body=JSON.parse(content||'{}');
    if (!body || typeof body!=='object' || Array.isArray(body)) throw new Error();
    resolve(body);
  }catch(_){reject(new Error('Invalid JSON object'));}});
  req.on('error',reject);
});}
function sameSecret(value,expected) {
  if (typeof value!=='string' || typeof expected!=='string') return false;
  const a=Buffer.from(value), b=Buffer.from(expected);
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function authorizePlayer(id,token) {
  const p=typeof id==='string' && Object.hasOwn(state.players,id) ? state.players[id] : null;
  return p && sameSecret(token,p.secret) ? p : null;
}
function broadcastChange() {state.updated=Date.now();save();broadcast();}
function startQuestion(i) {
  if(i<0 || i>=QUESTIONS.length) return false;
  state.index=i;state.phase='question';state.paused=false;state.remaining=QUESTIONS[i].time_sec*1000;
  state.deadline=Date.now()+state.remaining;state.answers={};scheduleAutoReveal();broadcastChange();return true;
}
function reveal() {
  if(state.phase!=='question') return false;
  clearTimeout(revealTimer);state.phase='reveal';state.paused=false;state.remaining=0;state.deadline=0;broadcastChange();return true;
}
function nextStage() {
  if (state.phase==='lobby') { if(!allPlayerIds().length) return 'At least one player must join first.';startQuestion(0);return null; }
  if (state.phase==='question') {reveal();return null;}
  if(state.phase==='reveal' || state.phase==='leaderboard') {
    if(state.index===QUESTIONS.length-1){state.phase='finished';broadcastChange();return null;}
    startQuestion(state.index+1);return null;
  }
  return 'The quiz has already ended.';
}
const publicFiles = {
  '/':'index.html','/screen':'index.html','/join':'index.html','/host':'index.html',
  '/app.css':'app.css','/app.js':'app.js',
};
const staticMime={'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8'};
function serveStatic(res,pathname){
  const file=publicFiles[pathname]; if(!file) return false;
  const body=fs.readFileSync(path.join(ROOT,'public',file));
  res.writeHead(200,{'Content-Type':staticMime[file.split('.').pop()],'Content-Length':body.length,
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});
  res.end(body);return true;
}
function qrSVG(text) {
  const qr = new QRCode(-1,0); qr.addData(text);qr.make();
  const border=4,size=qr.getModuleCount(),matrix=qr.modules;
  let rects='';for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(matrix[y][x])rects+=`<rect x="${x+border}" y="${y+border}" width="1" height="1"/>`;
  const total=size+border*2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="${total}" height="${total}" fill="#ffffff"/><g fill="#1e1e1e">${rects}</g></svg>`;
}
const server=http.createServer(async(req,res)=>{
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','DENY');
  let url;try{url=new URL(req.url,'http://localhost');}catch(_){return fail(res,400,'Invalid URL');}
  const p=url.pathname;
  if(req.method==='GET' && p==='/healthz')return json(res,200,{ok:true});
  if(req.method==='GET' && p==='/' && ONLINE){res.writeHead(302,{'Location':'/join','Cache-Control':'no-store'});return res.end();}
  if(req.method==='GET' && serveStatic(res,p))return;
  if(req.method==='GET' && p==='/api/config'){
    return json(res,200,{online:ONLINE,joinUrl:ONLINE?PUBLIC_BASE_URL+'/join':null,ips:ONLINE?[]:networkIPs(),port:PORT,questionCount:QUESTIONS.length});
  }
  if(req.method==='GET' && p==='/api/qr.svg') {
    const ip=url.searchParams.get('ip')||'';
    const allowed=ONLINE || networkIPs().some(n=>n.ip===ip) || ip==='127.0.0.1';
    if(!allowed) return fail(res,400,'Choose a local network address');
    const value=ONLINE?PUBLIC_BASE_URL+'/join':`http://${ip}:${PORT}/join`;
    const body=qrSVG(value);
    res.writeHead(200,{'Content-Type':'image/svg+xml','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(body);
  }
  if(req.method==='GET' && p==='/api/state') {
    const role=url.searchParams.get('role');
    if(role==='host')return sameSecret(url.searchParams.get('key'),ADMIN_TOKEN) ? json(res,200,snapshot('host')) : fail(res,401,'Host code required');
    if(role==='player'){
      const id=url.searchParams.get('id');if(authorizePlayer(id,url.searchParams.get('token')))return json(res,200,snapshot('player',id));
      return fail(res,401,'Rejoin required');
    }
    return json(res,200,snapshot('screen'));
  }
  if(req.method==='GET' && p==='/events') {
    const role=url.searchParams.get('role')||'screen';let playerId=null;
    if(role==='host' && !sameSecret(url.searchParams.get('key'),ADMIN_TOKEN))return fail(res,401,'Host code required');
    if(role==='player'){
      playerId=url.searchParams.get('id');if(!authorizePlayer(playerId,url.searchParams.get('token')))return fail(res,401,'Rejoin required');
    }
    if(!['host','player','screen'].includes(role))return fail(res,400,'Invalid role');
    if(clients.size>=200)return fail(res,503,'Too many live connections. Please try again shortly.');
    res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
    res.write(': connected\n\n');const client={res,role,playerId};clients.add(client);pushClient(client);
    res.on('close',()=>clients.delete(client));return;
  }
  if(req.method==='GET' && p==='/api/export.csv'){
    if(!sameSecret(url.searchParams.get('key'),ADMIN_TOKEN))return fail(res,401,'Host code required');
    const escapeCell=(s)=>{s=String(s??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';};
    const rows=[['rank','nickname','score','correct_answers'],...ranking().map(x=>[x.rank,x.name,x.score,x.correct])];
    const csv='\ufeff'+rows.map(row=>row.map(escapeCell).join(',')).join('\r\n')+'\r\n';
    res.writeHead(200,{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="gdg-tech-challenge-results.csv"','Cache-Control':'no-store'});return res.end(csv);
  }
  if(req.method==='POST' && p==='/api/join'){
    try{
      const body=await parseBody(req);if(state.phase!=='lobby')return fail(res,409,'The game has already started');
      if(body.pin!==state.pin)return fail(res,403,'Incorrect game PIN');
      const nicknameCheck=nicknamePolicy.check(body.name);
      if(!nicknameCheck.ok)return fail(res,400,nicknameCheck.message);
      const name=nicknameCheck.name;
      if(Object.values(state.players).some(pl=>pl.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return fail(res,409,'Nickname already taken');
      if(allPlayerIds().length>=MAX_PLAYERS)return fail(res,409,'The lobby is full');
      const id=crypto.randomUUID(); const secret=crypto.randomBytes(24).toString('hex');
      state.players[id]={id,secret,name,score:0,correct:0,joined:Date.now(),focusWarnings:0,focusPenalty:0,lastFocus:null,awaySince:0,awayQuestion:null,lastWarnQuestion:null};
      json(res,200,{id,token:secret,gameId:state.gameId,name});broadcastChange();return;
    }catch(err){return fail(res,400,err.message);}
  }
  if(req.method==='POST' && p==='/api/answer'){
    try{
      const b=await parseBody(req);const player=authorizePlayer(b.id,b.token);
      if(!player)return fail(res,401,'Rejoin required');
      if(state.phase!=='question' || state.paused || Date.now()>=state.deadline)return fail(res,409,'This question is closed');
      if(b.questionId!==undefined && b.questionId!==QUESTIONS[state.index].id)return fail(res,409,'This question is closed');
      if(state.answers[player.id])return fail(res,409,'Answer already submitted');
      if(!Number.isInteger(b.choice)||b.choice<0||b.choice>3)return fail(res,400,'Invalid answer');
      const correct=b.choice===QUESTIONS[state.index].correct_index;
      const points=correct ? 1000+Math.floor(300*Math.max(0,state.deadline-Date.now())/(QUESTIONS[state.index].time_sec*1000)) : 0;
      state.answers[player.id]={choice:b.choice,points};state.history ||= {};state.history[QUESTIONS[state.index].id] ||= {};state.history[QUESTIONS[state.index].id][player.id]={choice:b.choice,points};player.score+=points;if(correct)player.correct++;
      json(res,200,{accepted:true,points});broadcastChange();return;
    }catch(err){return fail(res,400,err.message);}
  }
  // A lightweight attention reminder, not a cheat detector. The server only records
  // tab/background changes, never which app or website a player visited.
  if(req.method==='POST' && p==='/api/focus') {
    try {
      const b=await parseBody(req);
      const player=authorizePlayer(b.id,b.token);
      if(!player)return fail(res,401,'Rejoin required');
      const question=QUESTIONS[state.index];
      if(b.action==='away') {
        if(state.phase==='question' && !state.paused && question &&
           b.questionId===question.id && !state.answers[player.id] && Date.now()<state.deadline) {
          if(!player.awaySince || player.awayQuestion!==question.id) {
            player.awaySince=Date.now();player.awayQuestion=question.id;
          }
        }
        return json(res,200,{ok:true});
      }
      if(b.action==='return') {
        const valid=question && b.questionId===question.id &&
          (state.phase==='question'||state.phase==='reveal') &&
          player.awayQuestion===question.id && player.awaySince>0;
        const awayMs=valid?Date.now()-player.awaySince:0;
        player.awaySince=0;player.awayQuestion=null;
        if(valid && awayMs>=FOCUS_MIN_AWAY_MS && player.lastWarnQuestion!==question.id) {
          player.focusWarnings=(player.focusWarnings||0)+1;
          player.lastWarnQuestion=question.id; // At most one warning per question.
          let penalty=0;
          if(state.focusMode==='penalty' && player.focusWarnings>=4) {
            penalty=Math.min(500,player.score);
            player.score-=penalty;
            player.focusPenalty=(player.focusPenalty||0)+penalty;
          }
          player.lastFocus={questionIndex:state.index,count:player.focusWarnings,penalty,at:Date.now()};
          broadcastChange();
        }
        return json(res,200,{ok:true,warningCount:player.focusWarnings||0});
      }
      return fail(res,400,'Invalid focus action');
    }catch(err){return fail(res,400,err.message);}
  }
  if(req.method==='POST' && p==='/api/host'){
    try{
      const b=await parseBody(req);
      if(!sameSecret(b.key,ADMIN_TOKEN))return fail(res,401,'Invalid host access code');
      if(b.action==='next') {const error=nextStage();if(error)return fail(res,409,error);}
      else if(b.action==='pause'){
        if(state.phase!=='question')return fail(res,409,'No active question to pause');
        if(!state.paused){state.remaining=Math.max(0,state.deadline-Date.now());state.paused=true;}
        else{state.deadline=Date.now()+state.remaining;state.paused=false;}
        scheduleAutoReveal();broadcastChange();
      }
      else if(b.action==='showLeaderboard') {
        if(state.phase!=='reveal')return fail(res,409,'Finish the active question first');
        state.phase='leaderboard';broadcastChange();
      }
      else if(b.action==='hideLeaderboard') {
        if(state.phase!=='leaderboard')return fail(res,409,'The leaderboard is not open');
        state.phase='reveal';broadcastChange();
      }
      else if(b.action==='setFocusMode') {
        if(state.phase!=='lobby')return fail(res,409,'Set the rule before starting the game');
        if(!['warn','penalty'].includes(b.mode))return fail(res,400,'Invalid rule');
        state.focusMode=b.mode;broadcastChange();
      }
      else if(b.action==='reset'){
        if(b.confirm!=='RESET')return fail(res,400,'Please confirm RESET');
        clearTimeout(revealTimer);state=newGame();broadcastChange();
      }
      else return fail(res,400,'Unknown action');
      return json(res,200,{ok:true});
    }catch(err){return fail(res,400,err.message);}
  }
  return fail(res,404,'Not found');
});
server.requestTimeout=15000;
server.headersTimeout=10000;
const tick=setInterval(()=>{if(state.phase==='question'&&!state.paused && Date.now()>=state.deadline)reveal();else if(state.phase==='question'&&!state.paused)broadcast();},1000);
const heartbeat=setInterval(()=>{for(const c of clients)try{c.res.write(': heartbeat\n\n');}catch(_){clients.delete(c);}},20000);
function shutdown() {
  clearInterval(tick);clearInterval(heartbeat);clearTimeout(revealTimer);
  saveNow();
  for(const c of clients)c.res.end();
  server.close(()=>process.exit(0));
  server.closeIdleConnections();
  setTimeout(()=>process.exit(0),5000).unref();
}
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
server.listen(PORT,HOST,()=>{
  saveNow();
  console.log('\n======================================================');
  console.log(` GDG Tech Challenge | ${ONLINE?'Online':'Offline LAN'}`);
  console.log('======================================================');
  const base=PUBLIC_BASE_URL || `http://localhost:${PORT}`;
  console.log(` Host control: ${base}/host${PRODUCTION?' (use ADMIN_TOKEN from your hosting settings)':'#key='+ADMIN_TOKEN}`);
  console.log(` Projector:    ${base}/screen`);
  console.log(` Game PIN:     ${state.pin}`);
  if(ONLINE) console.log(` Join:         ${base}/join`);
  else for(const n of networkIPs())console.log(` Join (${n.interface}): http://${n.ip}:${PORT}/join`);
  console.log(ONLINE?'\n Public game ready. Share the join link with your players.':'\n No Internet needed. Keep this terminal window open.');
  if(state.paused)console.log(' Restored session: active question was PAUSED for safety.');
  console.log(' Stop with Control+C.\n');
});
