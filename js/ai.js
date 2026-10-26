// Engine manager: Stockfish.js (lite, single-threaded WASM) + small alpha-beta worker.
const V='2';
let sf=null,sfReady=null,sfFailed=false,mini=null,reqId=0,pending=null;
function startSF(){
  if(sfReady)return sfReady;
  sfReady=new Promise((res,rej)=>{
    try{
      const wasm=new URL('vendor/stockfish/stockfish-18-lite-single.wasm?v='+V,location.href).href;
      sf=new Worker('vendor/stockfish/stockfish-18-lite-single.js?v='+V+'#'+encodeURIComponent(wasm)+',worker');
    }catch(e){sfFailed=true;rej(e);return}
    const to=setTimeout(()=>{sfFailed=true;rej(new Error('timeout'))},25000);
    sf.onmessage=(e)=>{const l=String(e.data);
      if(l==='uciok'){sf.postMessage('isready')}
      else if(l==='readyok'&&!sf._ok){sf._ok=true;clearTimeout(to);res()}
      else if(l.startsWith('bestmove')&&pending&&pending.engine==='sf'){const p=pending;pending=null;p.resolve(l.split(' ')[1])}
    };
    sf.onerror=(e)=>{sfFailed=true;clearTimeout(to);rej(e)};
    sf.postMessage('uci');
  });
  return sfReady;
}
function startMini(){if(!mini){mini=new Worker(new URL('./mini-worker.js?v='+V,import.meta.url),{type:'module'});
  mini.onmessage=(e)=>{if(pending&&pending.engine==='mini'&&e.data.id===pending.id){const p=pending;pending=null;p.resolve(e.data.move)}}}return mini}
export function preload(cfg){if(cfg.engine==='sf'&&!sfFailed)startSF().catch(()=>{});else startMini()}
export function engineStatus(){return sfFailed?'fallback':(sf&&sf._ok?'ready':(sf?'loading':'idle'))}
export function newGame(){if(sf&&sf._ok)sf.postMessage('ucinewgame')}
export function cancel(){if(pending){const p=pending;pending=null;if(p.engine==='sf'&&sf)sf.postMessage('stop');p.resolve(null)}}
export async function bestMove(fen,cfg){
  cancel();
  if(cfg.engine==='sf'&&!sfFailed){
    try{await startSF()}catch(e){return bestMove(fen,{engine:'mini',depth:3,noise:10})}
    return new Promise(resolve=>{pending={engine:'sf',resolve};
      sf.postMessage('setoption name Skill Level value '+cfg.skill);
      sf.postMessage('position fen '+fen);
      let go='go';if(cfg.depth)go+=' depth '+cfg.depth;if(cfg.movetime)go+=' movetime '+cfg.movetime;
      sf.postMessage(go);
    });
  }
  const w=startMini();const id=++reqId;
  return new Promise(resolve=>{pending={engine:'mini',id,resolve};w.postMessage({id,fen,depth:cfg.depth||2,noise:cfg.noise||0,blunder:cfg.blunder||0})});
}
export const fellBack=()=>sfFailed;
