// Synthesised wooden sounds (WebAudio, no samples).
let ctx=null,enabled=true;
export function setSound(on){enabled=on}
export function unlockAudio(){if(!ctx){try{ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(ctx&&ctx.state==='suspended')ctx.resume()}
function knock(t,freq,dur,gain){
  const c=ctx;const len=Math.floor(c.sampleRate*dur);const buf=c.createBuffer(1,len,c.sampleRate);const d=buf.getChannelData(0);
  for(let i=0;i<len;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/len,6)}
  const src=c.createBufferSource();src.buffer=buf;
  const bp=c.createBiquadFilter();bp.type='bandpass';bp.frequency.value=freq;bp.Q.value=4;
  const g=c.createGain();g.gain.value=gain;
  src.connect(bp).connect(g).connect(c.destination);src.start(t);
  const o=c.createOscillator();o.type='sine';o.frequency.setValueAtTime(freq*.55,t);o.frequency.exponentialRampToValueAtTime(freq*.35,t+dur);
  const og=c.createGain();og.gain.setValueAtTime(gain*.35,t);og.gain.exponentialRampToValueAtTime(.0001,t+dur*1.4);
  o.connect(og).connect(c.destination);o.start(t);o.stop(t+dur*1.5);
}
export function play(kind){
  if(!enabled||!ctx)return;const t=ctx.currentTime+.01;
  if(kind==='move')knock(t,1500+Math.random()*300,.07,.9);
  else if(kind==='capture'){knock(t,1100,.08,1);knock(t+.07,1700,.06,.7)}
  else if(kind==='check'){knock(t,2200,.06,.7);knock(t+.12,2200,.06,.6)}
  else if(kind==='select')knock(t,2600,.03,.25);
  else if(kind==='end'){[0,.18,.36].forEach((d,i)=>knock(t+d,900+i*250,.12,.8))}
  else if(kind==='castle'){knock(t,1500,.07,.9);knock(t+.16,1300,.07,.8)}
}
