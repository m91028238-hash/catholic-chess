// Small alpha-beta engine for the gentlest levels (runs in a Web Worker).
import { Chess } from '../vendor/chess.js?v=2';
const V={p:100,n:310,b:325,r:500,q:900,k:0};
// piece-square tables from white's view, a8..h1 order (index = rank8 first)
const PST={
p:[0,0,0,0,0,0,0,0,50,50,50,50,50,50,50,50,10,10,20,30,30,20,10,10,5,5,10,25,25,10,5,5,0,0,0,20,20,0,0,0,5,-5,-10,0,0,-10,-5,5,5,10,10,-20,-20,10,10,5,0,0,0,0,0,0,0,0],
n:[-50,-40,-30,-30,-30,-30,-40,-50,-40,-20,0,0,0,0,-20,-40,-30,0,10,15,15,10,0,-30,-30,5,15,20,20,15,5,-30,-30,0,15,20,20,15,0,-30,-30,5,10,15,15,10,5,-30,-40,-20,0,5,5,0,-20,-40,-50,-40,-30,-30,-30,-30,-40,-50],
b:[-20,-10,-10,-10,-10,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,10,10,5,0,-10,-10,5,5,10,10,5,5,-10,-10,0,10,10,10,10,0,-10,-10,10,10,10,10,10,10,-10,-10,5,0,0,0,0,5,-10,-20,-10,-10,-10,-10,-10,-10,-20],
r:[0,0,0,0,0,0,0,0,5,10,10,10,10,10,10,5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,-5,0,0,0,0,0,0,-5,0,0,0,5,5,0,0,0],
q:[-20,-10,-10,-5,-5,-10,-10,-20,-10,0,0,0,0,0,0,-10,-10,0,5,5,5,5,0,-10,-5,0,5,5,5,5,0,-5,0,0,5,5,5,5,0,-5,-10,5,5,5,5,5,0,-10,-10,0,5,0,0,0,0,-10,-20,-10,-10,-5,-5,-10,-10,-20],
k:[-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-30,-40,-40,-50,-50,-40,-40,-30,-20,-30,-30,-40,-40,-30,-30,-20,-10,-20,-20,-20,-20,-20,-20,-10,20,20,0,0,0,0,20,20,20,30,10,0,0,10,30,20]};
function evaluate(g){
  const b=g.board();let s=0;
  for(let r=0;r<8;r++)for(let f=0;f<8;f++){const c=b[r][f];if(!c)continue;
    const idx=c.color==='w'?r*8+f:(7-r)*8+f;const v=V[c.type]+PST[c.type][idx];s+=c.color==='w'?v:-v}
  return g.turn()==='w'?s:-s;
}
function order(ms){return ms.sort((a,b)=>((b.captured?V[b.captured]*10-V[b.piece]:0)+(b.promotion?800:0))-((a.captured?V[a.captured]*10-V[a.piece]:0)+(a.promotion?800:0)))}
let nodes=0;
function qs(g,a,b,d){nodes++;const st=evaluate(g);if(st>=b)return b;if(st>a)a=st;if(d<=0)return a;
  const ms=order(g.moves({verbose:true}).filter(m=>m.captured));
  for(const m of ms){g.move(m);const sc=-qs(g,-b,-a,d-1);g.undo();if(sc>=b)return b;if(sc>a)a=sc}return a}
function search(g,depth,a,b){
  if(g.isCheckmate())return -100000-depth;if(g.isDraw())return 0;
  if(depth===0)return qs(g,a,b,3);
  const ms=order(g.moves({verbose:true}));
  for(const m of ms){g.move(m);const sc=-search(g,depth-1,-b,-a);g.undo();if(sc>=b)return b;if(sc>a)a=sc}
  return a;
}
onmessage=(e)=>{
  const {id,fen,depth=2,noise=0,blunder=0}=e.data;
  const g=new Chess(fen);const ms=g.moves({verbose:true});
  if(!ms.length){postMessage({id,move:null});return}
  if(Math.random()<blunder){const m=ms[Math.floor(Math.random()*ms.length)];postMessage({id,move:m.from+m.to+(m.promotion||'')});return}
  let best=null,bs=-1e9;
  for(const m of order(ms)){g.move(m);let sc=-search(g,depth-1,-1e9,1e9);g.undo();sc+= (Math.random()*2-1)*noise;if(sc>bs){bs=sc;best=m}}
  postMessage({id,move:best.from+best.to+(best.promotion||'')});
};
