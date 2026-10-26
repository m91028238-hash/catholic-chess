import { Chess } from '../vendor/chess.js?v=2';
import { ChessScene } from './scene.js?v=2';
import * as AI from './ai.js?v=2';
import { play, setSound, unlockAudio } from './sound.js?v=2';

const $=id=>document.getElementById(id);
const params=new URLSearchParams(location.search);
const FAST=params.has('fast');

// ---------- difficulty & campaign ----------
const DIFFS=[
  {name:'Easy',cfg:{engine:'mini',depth:1,noise:150,blunder:.25}},
  {name:'Medium',cfg:{engine:'mini',depth:2,noise:30,blunder:.05}},
  {name:'Hard',cfg:{engine:'mini',depth:3,noise:0,blunder:0}},
];
const LADDER=[
  {name:'Brother Novice',note:'A young monk learning the moves',cfg:DIFFS[0].cfg},
  {name:'Brother Anselm',note:'Patient, careful, fond of pawns',cfg:{engine:'mini',depth:2,noise:90,blunder:.12}},
  {name:'Venerable Bede',note:'Monk and historian of Jarrow',cfg:DIFFS[1].cfg},
  {name:'St Thomas Aquinas',note:'The Angelic Doctor',cfg:DIFFS[2].cfg},
];
const lsGet=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:v}catch(e){return d}};
const lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}};
let S=Object.assign({mode:'ai',diff:2,color:'w',clock:0,rotate:true,sound:true,camp:1},JSON.parse(lsGet('cc_settings','{}')));
S.diff=Math.min(Math.max(1,+S.diff||2),3);
const unlocked=()=>Math.max(1,Math.min(LADDER.length,+lsGet('cc_lvl',1)||1));
const saveS=()=>lsSet('cc_settings',JSON.stringify(S));

// ---------- state ----------
let game=new Chess(),human='w',over=null,selected=null,targets=[],pendingPromo=null,thinking=false,clocks=null,clockTimer=null,lastTick=0,started=false,resignArm=0,drawOffer=null,aiToken=0,menuOpen=false,current=null;
const scene=new ChessScene($('stage'),{onTap:onSquare});
scene.fast=FAST;
scene.onCapture=()=>{};

function opponentName(){if(current.mode==='campaign')return LADDER[current.level-1].name;if(current.mode==='ai')return DIFFS[current.diff-1].name;return ''}
function aiCfg(){return current.mode==='campaign'?LADDER[current.level-1].cfg:DIFFS[current.diff-1].cfg}
const isAI=()=>current&&current.mode!=='2p';
const colorName=c=>c==='w'?'White':'Black';

function toast(msg,ms=2600){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._h);t._h=setTimeout(()=>t.classList.remove('show'),ms)}

function setObjective(){
  let o='';
  if(current.mode==='campaign'){const n=current.level;o=n<LADDER.length?`Level ${n}: Defeat ${LADDER[n-1].name} to unlock Level ${n+1}`:`Level ${n}: Defeat ${LADDER[n-1].name} to complete the ladder`}
  else if(current.mode==='ai')o=`You play ${colorName(human)} vs the computer (${DIFFS[current.diff-1].name})`;
  else o='Two players, one device: pass and play';
  $('obj').textContent=o;
}
function setStatus(){
  let s;
  if(over)s=over.title;
  else if(thinking)s=`${opponentName()} is thinking…`;
  else{
    const chk=game.inCheck()?'Check! ':'';
    if(isAI())s=chk+(game.turn()===human?'Your move':`${opponentName()} to move`);
    else s=chk+`${colorName(game.turn())} to move`;
  }
  $('status').textContent=s;
}
function kingSq(c){const b=game.board();for(const row of b)for(const p of row)if(p&&p.type==='k'&&p.color===c)return p.square}
function refreshMarkers(){
  const h=game.history({verbose:true});const last=h.length?h[h.length-1]:null;
  scene.setMarkers({last,selected,targets,check:game.inCheck()?kingSq(game.turn()):null});
}
function renderHistory(){
  const h=game.history();let html='';
  for(let i=0;i<h.length;i+=2)html+=`<span class="mv"><b>${i/2+1}.</b> ${h[i]}${h[i+1]?' '+h[i+1]:''}</span>`;
  const el=$('hist');el.innerHTML=html||'<span class="mv dim">Moves will appear here</span>';el.scrollLeft=el.scrollWidth;
}
function fmt(ms){ms=Math.max(0,ms);const s=Math.ceil(ms/1000);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
function renderClocks(){
  const top=$('clkTop'),bot=$('clkBot');
  // bottom = the side the camera faces
  const bs=scene.view.side,ts=bs==='w'?'b':'w';
  const label=c=>{if(isAI())return c===human?'You':opponentName();return colorName(c)};
  const txt=c=>label(c)+(clocks?' · '+fmt(clocks[c]):'');
  bot.textContent=txt(bs);top.textContent=txt(ts);
  bot.className='clk'+(game.turn()===bs&&!over?' on':'')+(clocks&&clocks[bs]<30000?' low':'')+(bs==='w'?' cw':' cb');
  top.className='clk'+(game.turn()===ts&&!over?' on':'')+(clocks&&clocks[ts]<30000?' low':'')+(ts==='w'?' cw':' cb');
}
function tickClock(){
  if(!clocks||over||!started||menuOpen){lastTick=performance.now();return}
  const now=performance.now();clocks[game.turn()]-=now-lastTick;lastTick=now;
  if(clocks[game.turn()]<=0){clocks[game.turn()]=0;const loser=game.turn();const win=loser==='w'?'b':'w';
    // opponent cannot mate -> draw
    const pcs=game.board().flat().filter(p=>p&&p.color===win&&p.type!=='k');
    const cantMate=pcs.length===0||(pcs.length===1&&(pcs[0].type==='n'||pcs[0].type==='b'));
    if(cantMate)endGame('draw','Time out — draw','Flag fell, but no mating material remains');
    else endGame(win,`Time out — ${resultWho(win)}`,`${colorName(loser)} ran out of time`);
  }
  renderClocks();
}
function resultWho(win){if(isAI())return win===human?'you win':`${opponentName()} wins`;return `${colorName(win)} wins`}

// ---------- game flow ----------
function startGame(){
  AI.cancel();aiToken++;thinking=false;
  current={mode:S.mode,diff:S.diff,level:Math.min(S.camp,unlocked())};
  game=new Chess();over=null;selected=null;targets=[];pendingPromo=null;drawOffer=null;started=false;
  human=S.color==='r'?(Math.random()<.5?'w':'b'):S.color;
  if(current.mode==='2p')human='w';
  clocks=S.clock?{w:S.clock*60000,b:S.clock*60000}:null;lastTick=performance.now();
  hidePanels();
  scene.clearPieces();scene.sync(game.board(),false);
  scene.setView(current.mode==='2p'?'w':human,false);
  if(isAI()){AI.preload(aiCfg());AI.newGame()}
  setObjective();renderHistory();refreshMarkers();renderClocks();setStatus();updateButtons();
  closeMenu();
  if(isAI()&&game.turn()!==human)setTimeout(aiMove,FAST?10:1200);
}
function updateButtons(){
  $('bDraw').hidden=isAI();$('bRotate').hidden=isAI();
  $('bRotate').textContent='Rotate: '+(S.rotate?'On':'Off');
  $('bSound').textContent=S.sound?'Sound: On':'Sound: Off';
  $('bUndo').disabled=!game.history().length;
}
function hidePanels(){$('result').hidden=true;$('promo').hidden=true;$('offer').hidden=true}

function onSquare(sq){
  unlockAudio();
  if(over||thinking||pendingPromo||menuOpen)return;
  if(isAI()&&game.turn()!==human)return;
  if(selected){
    const t=targets.find(t=>t.sq===sq);
    if(t){
      if(t.promo){pendingPromo={from:selected,to:sq};showPromo();return}
      doMove({from:selected,to:sq});return;
    }
  }
  const p=game.get(sq);
  if(p&&p.color===game.turn()){
    if(selected===sq){selected=null;targets=[]}else{
      selected=sq;const ms=game.moves({square:sq,verbose:true});
      const seen={};targets=[];for(const m of ms){if(seen[m.to])continue;seen[m.to]=1;targets.push({sq:m.to,capture:!!m.captured,promo:!!m.promotion})}
      play('select');
    }
  }else{selected=null;targets=[]}
  refreshMarkers();
}
function showPromo(){
  const c=game.turn();const g={w:{q:'♕',r:'♖',b:'♗',n:'♘'},b:{q:'♛',r:'♜',b:'♝',n:'♞'}}[c];
  $('promoBtns').innerHTML=['q','r','b','n'].map(k=>`<button data-p="${k}" aria-label="Promote to ${{q:'queen',r:'rook',b:'bishop',n:'knight'}[k]}">${g[k]}</button>`).join('')+'<button data-p="x" class="small">Cancel</button>';
  $('promo').hidden=false;
}
$('promoBtns').addEventListener('click',e=>{const b=e.target.closest('button');if(!b||!pendingPromo)return;const p=b.dataset.p;const pm=pendingPromo;pendingPromo=null;$('promo').hidden=true;
  if(p==='x'){selected=null;targets=[];refreshMarkers();return}doMove({...pm,promotion:p})});

async function doMove(m){
  let mv;try{mv=game.move(m)}catch(e){return}
  if(!mv)return;
  started=true;selected=null;targets=[];drawOffer=null;$('offer').hidden=true;
  play(mv.captured?'capture':(mv.flags.includes('k')||mv.flags.includes('q'))?'castle':'move');
  refreshMarkers();renderHistory();updateButtons();
  const anim=scene.animateMove(mv);
  if(game.inCheck())setTimeout(()=>play('check'),FAST?0:250);
  if(checkEnd()){renderClocks();return}
  setStatus();renderClocks();
  await anim;
  if(over)return;
  if(isAI()&&game.turn()!==human)aiMove();
  else if(current.mode==='2p'&&S.rotate)setTimeout(()=>{if(!over)scene.setView(game.turn());renderClocks()},FAST?0:350);
}
async function aiMove(){
  if(over||game.turn()===human)return;
  const tok=++aiToken;thinking=true;setStatus();
  const t0=performance.now();
  const fen=game.fen();
  const uci=await AI.bestMove(fen,aiCfg());
  if(tok!==aiToken)return;
  const wait=FAST?0:Math.max(0,550-(performance.now()-t0));
  await new Promise(r=>setTimeout(r,wait));
  if(tok!==aiToken)return;
  thinking=false;
  if(AI.fellBack()&&!aiMove._warned){aiMove._warned=1;toast('Stockfish unavailable; using the built-in engine')}
  if(!uci||uci==='(none)'){setStatus();return}
  doMove({from:uci.slice(0,2),to:uci.slice(2,4),promotion:uci[4]});
}
function checkEnd(){
  let r=null;
  if(game.isCheckmate()){const win=game.turn()==='w'?'b':'w';r=[win,`Checkmate — ${resultWho(win)}`,`${colorName(win)} mates in ${Math.ceil(game.history().length/2)} moves`]}
  else if(game.isStalemate())r=['draw','Stalemate — draw',`${colorName(game.turn())} has no legal move`];
  else if(game.isThreefoldRepetition())r=['draw','Draw by repetition','The same position occurred three times'];
  else if(game.isInsufficientMaterial())r=['draw','Draw — insufficient material','Neither side can deliver mate'];
  else if(game.isDrawByFiftyMoves())r=['draw','Draw — fifty-move rule','Fifty moves without a capture or pawn move'];
  if(r){endGame(...r);return true}return false;
}
function endGame(winner,title,detail){
  over={winner,title,detail};thinking=false;AI.cancel();aiToken++;
  play('end');setStatus();renderClocks();updateButtons();
  let extra='',btns=`<button id="rAgain">${current.mode==='campaign'&&!(winner===human)?'Try again':'Play again'}</button>`;
  if(current.mode==='campaign'){
    const n=current.level;
    if(winner===human){
      const best=Math.max(+lsGet('cc_best',0)||0,n);lsSet('cc_best',best);
      if(n<LADDER.length){const nu=Math.max(unlocked(),n+1);lsSet('cc_lvl',nu);extra=`Level ${n+1} unlocked: ${LADDER[n].name}`;btns=`<button id="rNext">Next: ${LADDER[n].name}</button>`+btns;toast(`Level ${n+1} unlocked`)}
      else{lsSet('cc_lvl',LADDER.length);extra='You have completed the ladder'}
    }else extra=winner==='draw'?'A draw does not unlock the next level':'Each attempt is a fresh game';
  }
  $('rTitle').textContent=title;$('rDetail').textContent=detail+(extra?' · '+extra:'');
  $('rBtns').innerHTML=btns+'<button id="rMenu" class="ghost">Menu</button>';
  $('result').hidden=false;
  $('rAgain').onclick=()=>startGame();
  $('rMenu').onclick=()=>openMenu();
  if($('rNext'))$('rNext').onclick=()=>{S.camp=current.level+1;saveS();startGame()};
}

// ---------- controls ----------
$('bUndo').onclick=()=>{
  unlockAudio();if(!game.history().length)return;
  if(isAI()){
    const hist=game.history({verbose:true});if(!hist.some(m=>m.color===human)){toast('Nothing to undo yet');return}
    AI.cancel();aiToken++;thinking=false;
    game.undo();while(game.history().length&&game.turn()!==human)game.undo();
  }else game.undo();
  over=null;selected=null;targets=[];pendingPromo=null;hidePanels();
  scene.sync(game.board(),true);
  if(current.mode==='2p'&&S.rotate)scene.setView(game.turn());
  refreshMarkers();renderHistory();setStatus();renderClocks();updateButtons();
  if(isAI()&&game.turn()!==human)aiMove();
};
$('bResign').onclick=()=>{
  if(over)return;
  if(performance.now()-resignArm>3000){resignArm=performance.now();toast('Tap Resign again to confirm');return}
  resignArm=0;
  const loser=isAI()?human:game.turn();const win=loser==='w'?'b':'w';
  endGame(win,`${isAI()?'You resigned':colorName(loser)+' resigns'} — ${resultWho(win)}`,'Game ended by resignation');
};
$('bDraw').onclick=()=>{
  if(over||isAI())return;
  const by=game.turn(),to=by==='w'?'b':'w';drawOffer=by;
  $('offerTxt').textContent=`${colorName(by)} offers a draw. ${colorName(to)}, do you accept?`;$('offer').hidden=false;
};
$('offerYes').onclick=()=>{$('offer').hidden=true;endGame('draw','Draw agreed','Both players agreed to a draw')};
$('offerNo').onclick=()=>{$('offer').hidden=true;drawOffer=null;toast('Draw declined')};
$('bRotate').onclick=()=>{S.rotate=!S.rotate;saveS();updateButtons();if(S.rotate&&!over)scene.setView(game.turn());renderClocks()};
const CAMS=['Player','Top','Side'];$('bView').textContent='Camera: '+scene.camMode;
$('bView').onclick=()=>{scene.camMode=CAMS[(CAMS.indexOf(scene.camMode)+1)%3];localStorage.setItem('camMode',scene.camMode);$('bView').textContent='Camera: '+scene.camMode;scene.setView(current&&current.mode==='2p'?(S.rotate?game.turn():scene.view.side):human)};
$('bSound').onclick=()=>{S.sound=!S.sound;setSound(S.sound);saveS();updateButtons();unlockAudio();play('select')};
$('menuBtn').onclick=()=>openMenu();

// ---------- menu ----------
function chips(el,items,val,cb){el.innerHTML=items.map(([v,l])=>`<button class="chip${v==val?' sel':''}" data-v="${v}">${l}</button>`).join('');
  el.onclick=e=>{const b=e.target.closest('button');if(!b)return;cb(b.dataset.v);renderMenu()}}
function renderMenu(){
  chips($('mMode'),[['ai','vs Computer'],['2p','2 Players'],['campaign','Campaign']],S.mode,v=>{S.mode=v;saveS()});
  chips($('mDiff'),DIFFS.map((d,i)=>[i+1,d.name]),S.diff,v=>{S.diff=+v;saveS()});
  chips($('mColor'),[['w','White'],['b','Black'],['r','Random']],S.color,v=>{S.color=v;saveS()});
  chips($('mClock'),[[0,'None'],[5,'5 min'],[10,'10 min'],[15,'15 min']],S.clock,v=>{S.clock=+v;saveS()});
  chips($('mRot'),[['1','On'],['0','Off']],S.rotate?'1':'0',v=>{S.rotate=v==='1';saveS()});
  $('secDiff').hidden=S.mode!=='ai';$('secColor').hidden=S.mode==='2p';$('secRot').hidden=S.mode!=='2p';$('secCamp').hidden=S.mode!=='campaign';
  const u=unlocked();if(S.camp>u)S.camp=u;
  $('mCamp').innerHTML=LADDER.map((l,i)=>{const n=i+1,lock=n>u;return `<button class="lvl${n==S.camp?' sel':''}${lock?' locked':''}" data-n="${n}" ${lock?'disabled':''}><span class="ln">${n}</span><span class="lt"><b>${l.name}</b><small>${lock?'Locked':l.note}</small></span>${n<=(+lsGet('cc_best',0)||0)?'<span class="ok">✓</span>':''}</button>`}).join('');
  $('mCamp').onclick=e=>{const b=e.target.closest('button');if(!b||b.disabled)return;S.camp=+b.dataset.n;saveS();renderMenu()};
  $('mResume').hidden=!(current&&!over&&game.history().length);
}
function openMenu(){menuOpen=true;renderMenu();$('menu').classList.add('open')}
function closeMenu(){menuOpen=false;$('menu').classList.remove('open');lastTick=performance.now()}
$('mStart').onclick=()=>{unlockAudio();startGame()};
$('mResume').onclick=()=>closeMenu();

// ---------- boot ----------
setSound(S.sound);
clockTimer=setInterval(tickClock,200);
const ro=new ResizeObserver(()=>scene.resize());ro.observe($('stage'));
$('status').textContent='Preparing the board…';
scene.init().then(()=>{
  current={mode:S.mode,diff:S.diff,level:Math.min(S.camp,unlocked())};
  scene.sync(game.board(),false);setObjective();renderHistory();refreshMarkers();renderClocks();setStatus();updateButtons();
  if(params.has('play'))startGame();else openMenu();
  document.body.classList.add('ready');
});

// test hooks
window.CC={
  get fen(){return game.fen()},get over(){return over},get thinking(){return thinking},get turn(){return game.turn()},get human(){return human},
  get history(){return game.history()},get busy(){return scene.busy},get view(){return scene.view.side},
  tap:onSquare,screen:sq=>scene.squareToScreen(sq),start:(o)=>{Object.assign(S,o);startGame()},
  load:(fen)=>{game.load(fen);scene.sync(game.board(),false);refreshMarkers();setStatus()},
  pieces:()=>scene.pieces.filter(p=>p.userData.square).map(p=>p.userData.color+p.userData.type+p.userData.square).sort(),
  promo:(p)=>{const b=document.querySelector(`#promoBtns [data-p="${p}"]`);b&&b.click()},
  engine:()=>AI.engineStatus(),
};
