(() => {
  'use strict';
  const root=document.getElementById('app');
  const mode=location.pathname==='/host' ? 'host' : location.pathname==='/join' ? 'player':'screen';
  const KEY='gdg-tc-player';
  let hiddenRound=null;
  const LETTERS=['A','B','C','D'];
  let state=null,config=null,stream=null,online=false,error='',chosenIp='',hostKey='',credentials=null,connecting=false;
  const html=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const capitalize=s=>s?String(s).charAt(0).toUpperCase()+String(s).slice(1):'';
  const number=n=>Number(n||0).toLocaleString('en-US');
  const getStored=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'null');}catch(_){return null;}};
  const saveStored=v=>{try{v?localStorage.setItem(KEY,JSON.stringify(v)):localStorage.removeItem(KEY);}catch(_){}};
  const fromHash=new URLSearchParams(location.hash.replace(/^#/,'' )).get('key');
  hostKey=fromHash||sessionStorage.getItem('gdg-tc-host')||'';
  if(fromHash){sessionStorage.setItem('gdg-tc-host',fromHash);history.replaceState(null,'',location.pathname);}
  credentials=getStored();
  const brand=()=>`<div class="brandmark"><span class="mark" aria-hidden="true"><span></span><span></span><span></span><span></span></span><span>GDG on Campus <span class="muted">/ Sapienza</span></span></div>`;
  const status=()=>`<span class="top-status"><span class="live-dot ${online?'':'off'}"></span>${online?(config?.online?'ONLINE':'LOCAL NETWORK'):'RECONNECTING'}</span>`;
  const footer=()=>`<footer class="footer"><span>// STUDENTS BUILDING TOGETHER</span><span class="dots" aria-hidden="true"><span></span><span></span><span></span><span></span></span><span>TECH CHALLENGE · 2026</span></footer>`;
  const tag=(txt,t='green')=>`<span class="tag ${t}">${html(txt)}</span>`;
  const formatTime=ms=>`${Math.max(0,Math.ceil((ms||0)/1000))}s`;
  const optionTile=(s,i,correctIndex)=>`<div class="option-tile ${correctIndex!==undefined?(correctIndex===i?'correct':'dim'):''}"><span class="letter">${LETTERS[i]}</span><span>${html(s)}</span></div>`;
  const timerClass=(ms,duration)=>ms<=5000?'danger':ms<=duration*500?'warning':'safe';
  const prompt=(q)=>`<h1>${html(q.prompt)}</h1>${q.code?`<pre class="code-block">${html(q.code)}</pre>`:''}`;
  function eventURL(){
    const q=new URLSearchParams();q.set('role',mode==='player' && credentials?'player':mode==='host'?'host':'screen');
    if(mode==='host')q.set('key',hostKey);
    if(mode==='player' && credentials){q.set('id',credentials.id);q.set('token',credentials.token);}
    return '/events?'+q.toString();
  }
  function connect(){
    if(stream)stream.close();
    if(mode==='host'&&!hostKey){online=false;render();return;}
    if(typeof EventSource==='undefined'){error='This browser does not support live updates.';render();return;}
    stream=new EventSource(eventURL());
    stream.onopen=()=>{online=true;error='';render();};
    stream.onmessage=e=>{
      try{
        const next=JSON.parse(e.data);
        if(mode==='player' && credentials && next.gameId!==credentials.gameId){saveStored(null);credentials=null;connect();return;}
        state=next;online=true;render();
      }catch(err){console.warn('Invalid live message',err);}
    };
    stream.onerror=async()=>{
      online=false;render();
      // A reset or a cloud restart can invalidate a saved player session.
      if(mode==='player' && credentials){
        const previous=credentials;
        try{
          const r=await fetch('/api/state?'+new URLSearchParams({role:'player',id:previous.id,token:previous.token}));
          if(r.status===401 && credentials===previous){credentials=null;saveStored(null);state=null;connect();}
        }catch(_){} // Preserve credentials while the network is unavailable.
      }
    };
  }
  async function request(url,data){
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});
    let parsed={};try{parsed=await r.json();}catch(_){ }
    if(!r.ok)throw new Error(parsed.error||`Request failed (${r.status})`);
    return parsed;
  }
  async function init(){
    try{config=await (await fetch('/api/config',{cache:'no-store'})).json();}
    catch(_){config={ips:[],port:3000};}
    const ips=(config.ips||[]).map(x=>x.ip);
    chosenIp=ips.find(ip=>ip===location.hostname)||ips.find(ip=>ip.startsWith('192.168.'))||ips.find(ip=>ip.startsWith('10.'))||ips[0]||'';
    if(mode==='player' && credentials){
      try{const q=new URLSearchParams({role:'player',id:credentials.id,token:credentials.token});
        const r=await fetch('/api/state?'+q);if(r.status===401)throw new Error('Session expired');if(!r.ok)throw new Error('Server unavailable');
        state=await r.json();if(credentials.gameId!==state.gameId)throw new Error('Game changed');
      }catch(err){
        if(err.message==='Session expired'||err.message==='Game changed'){credentials=null;saveStored(null);}
      }
    }
    if(mode==='host'&&hostKey){
      try{const r=await fetch('/api/state?'+new URLSearchParams({role:'host',key:hostKey}));if(!r.ok)throw new Error();state=await r.json();}
      catch(_){hostKey='';sessionStorage.removeItem('gdg-tc-host');error='Incorrect or expired host code.';}
    }
    if(!state){try{state=await(await fetch('/api/state')).json();}catch(_){} }
    render();connect();
  }
  function render(){
    if(mode==='player')return renderPlayer();
    if(mode==='host')return renderHost();
    renderScreen();
  }
  function wrapScreen(body){root.innerHTML=`<main class="app-shell"><div class="topline">${brand()}${status()}</div><section class="stage">${body}</section>${footer()}</main>`;}
  const joinURL=()=>config?.joinUrl||(chosenIp?`http://${chosenIp}:${config?.port||3000}/join`:'');
  function networkPicker(){
    if(config?.online)return '<p class="mini muted">Join from any Internet connection: Wi-Fi or mobile data.</p>';
    const addresses=config?.ips||[];
    return addresses.length>0?`<label class="mini mono" for="ip-select">Wi-Fi address for phones</label><select id="ip-select" class="select" aria-label="Select local IP address">${addresses.map(x=>`<option value="${html(x.ip)}" ${x.ip===chosenIp?'selected':''}>${html(x.interface)} · ${html(x.ip)}</option>`).join('')}</select>`:
      '<div class="notice error">No local IPv4 address detected. Connect this Mac to the venue Wi-Fi.</div>';
  }
  function renderScreen(){
    if(!state){wrapScreen('<h1>Connecting to the quiz…</h1>');return;}
    const q=state.question;
    if(state.phase==='lobby'){
      const link=joinURL();
      wrapScreen(`<div class="lobby-grid"><article class="board hero-board"><div class="hero-copy"><div class="eyebrow">// GDG ON CAMPUS · SAPIENZA</div><h1>Ready to<br>think in code?</h1><p class="lead">${state.questionCount} questions. Four answers. One podium.<br>Grab your phone and join the challenge.</p>${tag('CODE · CLOUD · SECURITY · AI','yellow')}</div><div class="hero-bottom"><div><div class="eyebrow">PLAYERS JOINED</div><div class="counter">${state.playerCount}<span class="counter-caption"> ${state.playerCount===1?'player joined':'players joined'}</span></div></div><div class="dots" aria-hidden="true"><span></span><span></span><span></span><span></span></div></div><div class="name-cloud">${(state.names||[]).slice(0,35).map(name=>`<span>${html(name)}</span>`).join('')}</div></article><article class="board join-panel"><div class="eyebrow">SCAN → JOIN → PLAY</div><h2>Join the challenge</h2>${link?`<img class="qr" alt="QR code to join the quiz" src="/api/qr.svg${config?.online?'':'?ip='+encodeURIComponent(chosenIp)}"/>`:'<div class="notice error">Connect the Mac to Wi-Fi first.</div>'}<div class="mono small">GAME PIN</div><div class="pin">${html(state.pin)}</div><div class="join-url">${link?`<a href="${html(link)}">${html(link)}</a>`:'Awaiting network...'}</div>${networkPicker()}${chosenIp==='127.0.0.1'?'<div class="notice error">127.0.0.1 works only on this Mac. Choose a Wi-Fi IP instead.</div>':''}</article></div>`);
      const sel=document.getElementById('ip-select');if(sel)sel.addEventListener('change',e=>{chosenIp=e.target.value;render();});
      return;
    }
    if(state.phase==='question'&&q){
      const remaining=state.remainingMs;const pct=Math.min(100,100*remaining/(q.duration*1000));
      wrapScreen(`<div class="q-head"><div class="gapline">${tag(`CHALLENGE ${String(q.number).padStart(2,'0')} / ${state.questionCount}`,'blue')}${tag(q.category,'green')}${state.paused?'<span class="status-pill pause">PAUSED</span>':''}</div><div class="gapline"><span class="count-pill">${state.answeredCount} / ${state.playerCount} answered</span><div class="timer ${remaining<=5000?'timer-low':''}">${formatTime(remaining)}</div></div></div><div class="progress ${timerClass(remaining,q.duration)}"><div style="width:${pct}%"></div></div><div class="question-area"><div>${prompt(q)}</div></div><div class="screen-options">${q.options.map((o,i)=>optionTile(o,i)).join('')}</div>`);return;
    }
    if(state.phase==='reveal'&&q){
      const total=state.answeredCount;
      wrapScreen(`<div class="q-head">${tag(`ANSWER REVEAL · ${String(q.number).padStart(2,'0')}/${state.questionCount}`,'green')}${tag(`${total} answers`,'blue')}</div><h2>${html(q.prompt)}</h2><div class="result-grid"><div class="board result-card"><div class="eyebrow">// RESPONSE DISTRIBUTION</div>${q.options.map((o,i)=>`<div class="result-line ${i===state.correctIndex?'winner':''}"><b>${LETTERS[i]}${i===state.correctIndex?' ✓':''}</b><div class="result-bar"><div style="width:${total?100*(state.distribution[i]||0)/total:0}%"></div></div><span>${state.distribution[i]||0}</span></div>`).join('')}</div><div class="board soft result-card"><div class="eyebrow">// CORRECT ANSWER</div><h1 style="font-size:clamp(48px,6vw,90px);margin:15px 0">${LETTERS[state.correctIndex]}</h1><div class="explanation">${html(state.explanation)}</div></div></div>`);return;
    }
    if(state.phase==='leaderboard'){
      const top=state.leaderboard.slice(0,5);
      wrapScreen(`<div class="stage-heading"><div><div class="eyebrow">// GIT LOG --LEADERBOARD</div><h1>Who's climbing<br>the ranks?</h1></div>${tag(`${state.index+1} / ${state.questionCount} completed`,'yellow')}</div><div class="board blue"><div class="leaderboard">${top.length?top.map(p=>`<div class="leader-row"><span class="position">#${p.rank}</span><strong>${html(p.name)}</strong><span class="points">${number(p.score)} pts</span></div>`).join(''):'<p>No players yet.</p>'}</div></div><p class="lead">The next challenge is coming up. Stay sharp.</p>`);return;
    }
    if(state.phase==='finished'){
      const top=state.leaderboard;const byRank=rank=>top.find(p=>p.rank===rank);
      const stand=(rank,c)=>{const p=byRank(rank);return `<div class="stand ${c}"><div class="place">${rank===1?'★':''} #${rank}</div><div class="person">${p?html(p.name):'—'}</div><div class="number">${p?number(p.score)+' pts':'No winner'}</div></div>`;};
      wrapScreen(`<div class="stage-heading"><div><div class="eyebrow">// CHALLENGE COMPLETE</div><h1>And the winners are...</h1></div>${tag(`${state.playerCount} players`,'yellow')}</div><div class="podium">${stand(2,'p2')}${stand(1,'p1')}${stand(3,'p3')}</div><p style="text-align:center" class="lead">Thanks for playing. Keep building, keep learning, keep curious.</p>${top.some(p=>p.rank<=3 && top.filter(x=>x.rank===p.rank).length>1)?'<div class="notice">Podium tie detected. Confirm a tie-break rule before awarding prizes.</div>':''}`);return;
    }
    wrapScreen('<div class="board">Waiting for the host...</div>');
  }
  function mobileWrap(body){
    const last=state?.me?.lastFocus;
    const showFocus=last && state?.question && last.questionIndex===state.index && ['question','reveal'].includes(state.phase);
    const warningText=showFocus ? (last.penalty>0
      ? `⚠ Page switch #${last.count}. −${number(last.penalty)} points.`
      : last.count<=3 ? `⚠ Stay on the quiz page — warning ${last.count}/3.`
      : `⚠ Another page switch was detected (#${last.count}).`) : '';
    root.innerHTML=`${showFocus?`<div class="focus-banner" role="status">${html(warningText)}</div>`:''}`+`<main class="mobile-shell"><div class="topline">${brand()}<div class="live-dot ${online?'':'off'}"></div></div>${body}<div class="spacer"></div><div class="footer"><span>CODE. THINK. COMPETE.</span><span>${config?.online?'ONLINE GAME':'LOCAL GAME'}</span></div></main>`;
  }
  function renderPlayer(){
    if(!state)return mobileWrap('<h1>Connecting…</h1>');
    if(!credentials){
      if(state.phase!=='lobby')return mobileWrap(`<div class="eyebrow">// GDG TECH CHALLENGE</div><h1>Game in progress.</h1><div class="mobile-card yellow">The quiz has already started. Ask the host to reset the game if you need to join.</div>`);
      if(document.querySelector('#join-form') && !error)return; // Do not erase a half-typed nickname when lobby changes.
      mobileWrap(`<div class="eyebrow">// WELCOME, DEVELOPER</div><h1>Let's play.</h1><p class="muted">You only need a nickname and the game PIN from the projector.</p><section class="mobile-card green"><form id="join-form"><div class="input-group"><label for="nickname">YOUR NICKNAME</label><input id="nickname" name="nickname" minlength="2" maxlength="18" required autocomplete="nickname" placeholder="e.g. GDG is the best"/></div><div class="input-group"><label for="game-pin">GAME PIN</label><input id="game-pin" name="pin" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required placeholder="6 digits"/></div><button class="button" type="submit">JOIN THE CHALLENGE →</button></form></section>${error?`<div class="notice error">${html(error)}</div>`:''}<p class="mini muted">Keep it fun! Nicknames and scores are stored on the quiz server and visible during the game.</p>`);
      const form=document.getElementById('join-form');form.addEventListener('submit',async e=>{
        e.preventDefault();const btn=form.querySelector('button');btn.disabled=true;btn.textContent='Joining…';
        try{credentials=await request('/api/join',{name:form.querySelector('#nickname').value,pin:form.querySelector('#game-pin').value.trim()});saveStored(credentials);error='';connect();render();}
        catch(err){error=err.message;btn.disabled=false;btn.textContent='JOIN THE CHALLENGE →';const oldName=form.querySelector('#nickname').value,oldPin=form.querySelector('#game-pin').value;render();document.getElementById('nickname').value=oldName;document.getElementById('game-pin').value=oldPin;}
      });return;
    }
    const me=state.me;
    if(!me){mobileWrap('<div class="mobile-card">Reconnecting to your game…</div>');return;}
    if(state.phase==='lobby')return mobileWrap(`<div class="eyebrow">// YOU ARE IN</div><h1>Nice to meet you,<br>${html(me.name)}.</h1><div class="mobile-card green"><div class="tag blue">✓ JOINED</div><h2 style="margin-top:15px">Waiting for the host</h2><p>Keep this page open. Your answers will appear here when the game begins.</p><p class="mini">Page switch reminders: ${state.focusMode==='penalty'?'3 warnings, then up to 500 points deducted per additional flagged question.':'warnings only; no automatic score penalty.'} Brief interruptions under 2.5 seconds are ignored.</p><div class="dots"><span></span><span></span><span></span><span></span></div></div><div class="rank-info"><div><strong>${state.playerCount}</strong><small>Players ready</small></div><div><strong>${number(me.score)}</strong><small>Your points</small></div></div>`);
    if(state.phase==='question'){
      const q=state.question; const chosen=me.answer;
      mobileWrap(`<div class="gapline"><span class="tag blue">QUESTION ${q.number} / ${state.questionCount}</span><span class="spacer"></span><span class="mobile-timer">${formatTime(state.remainingMs)}</span></div><div class="progress ${timerClass(state.remainingMs,q.duration)}"><div style="width:${Math.min(100,100*state.remainingMs/(q.duration*1000))}%"></div></div><div class="mobile-question">${html(q.prompt)}</div>${q.code?`<pre class="mobile-code">${html(q.code)}</pre>`:''}<div class="mobile-answers">${LETTERS.map((l,i)=>`<button type="button" class="answer-btn ${chosen===i?'chosen':chosen!==null?'muted':''}" data-choice="${i}" ${chosen!==null||state.paused?'disabled':''}>${l}</button>`).join('')}</div><div class="option-labels">${q.options.map((o,i)=>`<span><strong>${LETTERS[i]}.</strong> ${html(o)}</span>`).join('')}</div><div class="notice ${chosen!==null?'ok':''}">${state.paused?'Host paused the timer.':chosen!==null?`Answer ${LETTERS[chosen]} received. Waiting for the reveal.`:'Tap A, B, C or D to answer.'}</div>${error?`<div class="notice error">${html(error)}</div>`:''}`);
      document.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',async()=>{
        if(connecting)return;connecting=true;error='';document.querySelectorAll('[data-choice]').forEach(b=>b.disabled=true);
        try{await request('/api/answer',{id:credentials.id,token:credentials.token,choice:Number(btn.dataset.choice),questionId:q.id});}
        catch(err){error=err.message;render();}finally{connecting=false;}
      }));return;
    }
    if(state.phase==='reveal')return mobileWrap(`<div class="eyebrow">// ANSWER REVEALED</div><h1>${me.answer===state.correctIndex?'Nailed it!':me.answer===null?'Time is up.':'Not this time.'}</h1><div class="mobile-card ${me.answer===state.correctIndex?'green':'yellow'}"><span class="tag">Correct: ${LETTERS[state.correctIndex]}</span><h2 style="margin-top:18px">${html(state.question.options[state.correctIndex])}</h2><p>${html(state.explanation)}</p><div class="rank-info"><div><strong>+${number(me.earned)}</strong><small>This question</small></div><div><strong>${number(me.score)}</strong><small>Total score</small></div></div></div><p class="muted">Wait for the next question…</p>`);
    if(state.phase==='leaderboard')return mobileWrap(`<div class="eyebrow">// LIVE LEADERBOARD</div><h1>Keep it up!</h1><div class="mobile-card blue"><div class="eyebrow">YOUR CURRENT RANK</div><h1>#${me.rank}</h1><p><strong>${number(me.score)}</strong> points earned.</p></div><div class="board"><div class="leaderboard">${state.leaderboard.slice(0,5).map(p=>`<div class="host-player"><span class="number">#${p.rank}</span><strong>${html(p.name)}</strong><span class="score">${number(p.score)}</span></div>`).join('')}</div></div><p>Next question is coming up…</p>`);
    if(state.phase==='finished')return mobileWrap(`<div class="eyebrow">// THAT'S A WRAP</div><h1>Well played,<br>${html(me.name)}!</h1><div class="mobile-card yellow"><span class="tag green">FINAL RESULT</span><div class="rank-info" style="margin-top:18px"><div><strong>#${me.rank}</strong><small>Final rank</small></div><div><strong>${number(me.score)}</strong><small>Points</small></div></div><p>${me.rank<=3?'Go claim your podium moment!':'Thanks for playing — see you at the next event!'}</p></div><div class="board"><h2>Top 5</h2>${state.leaderboard.slice(0,5).map(p=>`<div class="host-player"><span class="number">#${p.rank}</span><strong>${html(p.name)}</strong><span class="score">${number(p.score)}</span></div>`).join('')}</div>`);
  }
  function renderHost(){
    if(!hostKey){root.innerHTML=`<main class="host-shell"><div class="topline">${brand()}${tag('PRESENTER ACCESS','yellow')}</div><div style="max-width:510px;margin:8vh auto" class="board"><div class="eyebrow">// PRIVATE HOST PANEL</div><h1 style="font-size:44px">Enter host code</h1><p>${config?.online?'Enter the private ADMIN_TOKEN from your hosting settings.':'Find the private host link printed in the Mac Terminal when the server starts.'}</p><form id="host-login"><div class="input-group"><label for="host-token">HOST CODE</label><input id="host-token" type="password" autocomplete="off" required/></div><button class="button" type="submit">UNLOCK CONTROLS →</button></form>${error?`<div class="notice error">${html(error)}</div>`:''}</div></main>`;
      document.getElementById('host-login').addEventListener('submit',async e=>{
        e.preventDefault();const input=document.getElementById('host-token');const v=input.value.trim();
        try{const r=await fetch('/api/state?'+new URLSearchParams({role:'host',key:v}));if(!r.ok)throw new Error('Invalid host code');
          hostKey=v;sessionStorage.setItem('gdg-tc-host',v);state=await r.json();error='';connect();render();
        }catch(err){error=err.message;render();}
      });return;
    }
    if(!state){root.innerHTML='<main class="host-shell"><h1>Connecting to host control…</h1></main>';return;}
    const labels={lobby:'START GAME →',question:'REVEAL ANSWER →',reveal:state.index===state.questionCount-1?'SHOW PODIUM →':'NEXT QUESTION →',leaderboard:state.index===state.questionCount-1?'SHOW PODIUM →':'NEXT QUESTION →',finished:'GAME FINISHED'};
    const q=state.question;
    root.innerHTML=`<main class="host-shell"><div class="topline">${brand()}${status()}</div><div class="host-top"><div><div class="eyebrow">// CONTROL DECK · DO NOT PROJECT THIS WINDOW</div><h1>Presenter dashboard</h1></div><div class="gapline">${tag(capitalize(state.phase),'yellow')}<a class="button secondary small" href="/screen" target="_blank" rel="noopener">OPEN PROJECTOR ↗</a></div></div><div class="host-stat-grid"><div class="host-stat"><strong>${state.playerCount}</strong><small>PLAYERS</small></div><div class="host-stat"><strong>${Math.max(0,state.index+1)} / ${state.questionCount}</strong><small>QUESTION</small></div><div class="host-stat"><strong>${state.phase==='question'?formatTime(state.remainingMs):'—'}</strong><small>${state.paused?'PAUSED':'TIME LEFT'}</small></div></div><div class="host-grid"><section class="board"><h2>Game controls</h2><p class="host-detail">${state.phase==='lobby'?'Lobby open. Let players scan the QR code on the projector.':state.phase==='question'?'Question live. Answer submissions close automatically when the timer expires.':state.phase==='reveal'?'Answer shown. Continue when you are ready.':state.phase==='leaderboard'?'Leaderboard break. Continue when ready.':'Final results shown. You can export the score table.'}</p>${q?`<div class="host-code">${html(q.code || q.prompt)}</div><p class="host-detail"><strong>${html(q.category)} · ${q.duration}s</strong> | ${state.answeredCount} / ${state.playerCount} answered ${state.phase!=='question'?`| Correct: ${LETTERS[state.correctIndex??0]}`:''}</p>`:''}<div class="host-controls"><button class="button green" id="host-next" ${state.phase==='finished'||(state.phase==='lobby'&&!state.playerCount)?'disabled':''}>${labels[state.phase]}</button><button class="button secondary" id="host-leader" ${['reveal','leaderboard'].includes(state.phase)?'':'disabled'}>${state.phase==='leaderboard'?'HIDE LEADERBOARD':'SHOW LEADERBOARD'}</button>${state.phase==='question'?`<button class="button secondary" id="host-pause">${state.paused?'RESUME TIMER':'PAUSE TIMER'}</button>`:''}</div>${state.phase==='lobby'?`<div class="focus-setting"><label for="focus-mode"><strong>Page-switch deterrent</strong> <span class="mini muted">During unanswered questions only; one flag maximum per question. Brief changes under 2.5s ignored.</span></label><select class="select" id="focus-mode"><option value="warn" ${state.focusMode==='warn'?'selected':''}>Warnings only (recommended)</option><option value="penalty" ${state.focusMode==='penalty'?'selected':''}>After 3 warnings, −500 pts per additional flagged question</option></select><p class="mini muted">Visibility changes can also be caused by calls or the phone OS. This cannot detect screenshots or other devices. Explain the rule to players before starting.</p></div>`:''}<hr style="border:0;border-top:2px solid #ccc;margin:25px 0"/><div class="gapline"><a class="button secondary small" id="host-export" href="/api/export.csv?key=${encodeURIComponent(hostKey)}">↓ EXPORT CSV</a><button class="button warn small" id="host-reset">RESET GAME</button></div><p class="mini muted">Reset creates a new game PIN and clears all players and scores. Saved session state is kept on the quiz server.</p>${error?`<div class="notice error">${html(error)}</div>`:''}</section><section class="board"><div class="gapline" style="justify-content:space-between"><h2>Leaderboard</h2>${tag(state.pin,'blue')}</div><div class="host-detail"><div class="leaderboard">${state.players?.length?state.players.slice(0,40).map(p=>`<div class="host-player"><span class="number">#${p.rank}</span><strong>${html(p.name)}</strong><span class="score">${number(p.score)} pts</span>${(()=>{const f=state.focusReport?.find(x=>x.name===p.name);return f?.warnings?`<span class="host-flag" title="Page background notices, not evidence of cheating">⚠ ${f.warnings}${f.penalty?` · −${number(f.penalty)} pts`:``}</span>`:``})()}</div>`).join(''):'<p>No players yet. Open /screen on the projector and share the PIN.</p>'}</div></div></section></div><div class="host-footer">${config?.online?'ADMIN CODE IS PRIVATE · PLAYERS CAN USE WI-FI OR MOBILE DATA':'ADMIN CODE IS PRIVATE · INTERNET IS NOT REQUIRED · CONNECT ALL DEVICES TO THE SAME WI-FI'}</div></main>`;
    const next=document.getElementById('host-next');if(next)next.addEventListener('click',()=>act('next'));
    const leader=document.getElementById('host-leader');
    if(leader)leader.addEventListener('click',()=>act(state.phase==='leaderboard'?'hideLeaderboard':'showLeaderboard'));
    const focusMode=document.getElementById('focus-mode');
    if(focusMode)focusMode.addEventListener('change',e=>act('setFocusMode',{mode:e.target.value}));
    const pause=document.getElementById('host-pause');if(pause)pause.addEventListener('click',()=>act('pause'));
    document.getElementById('host-reset').addEventListener('click',()=>{
      if(confirm('Reset the game? This clears ALL players and scores and creates a new PIN.'))act('reset');
    });
  }
  async function act(action,extra={}){
    try{error='';await request('/api/host',{key:hostKey,action,...extra,...(action==='reset'?{confirm:'RESET'}:{})});}
    catch(err){error=err.message;render();}
  }
  // Optional Page Visibility API warning. Does not inspect other apps/sites or screenshots.
  // Request timestamps are server-based; the reminder is intentionally not a cheating verdict.
  document.addEventListener('visibilitychange',()=>{
    if(mode!=='player' || !credentials)return;
    if(document.hidden){
      if(state?.phase==='question' && !state.paused && state.me?.answer===null) {
        hiddenRound=state.question.id;
        fetch('/api/focus',{method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({id:credentials.id,token:credentials.token,action:'away',questionId:hiddenRound}),
          keepalive:true}).catch(()=>{});
      }
    } else if(hiddenRound){
      const questionId=hiddenRound;hiddenRound=null;
      fetch('/api/focus',{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({id:credentials.id,token:credentials.token,action:'return',questionId}),
        keepalive:true}).catch(()=>{});
    }
  });
  init();
})();
