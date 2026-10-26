// Procedural textures: wood grain, laser-engraved board, table.
import * as THREE from 'three';

// ---------- value noise ----------
function makeNoise(seed){
  const P=new Uint8Array(512);let s=seed*9301+49297;
  const rnd=()=>{s=(s*9301+49297)%233280;return s/233280};
  const p=[...Array(256).keys()];
  for(let i=255;i>0;i--){const j=Math.floor(rnd()*(i+1));[p[i],p[j]]=[p[j],p[i]]}
  for(let i=0;i<512;i++)P[i]=p[i&255];
  const G=new Float32Array(256);for(let i=0;i<256;i++)G[i]=rnd();
  const f=t=>t*t*(3-2*t);
  function n2(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
    const a=G[P[(xi&255)+P[yi&255]]],b=G[P[((xi+1)&255)+P[yi&255]]],c=G[P[(xi&255)+P[(yi+1)&255]]],d=G[P[((xi+1)&255)+P[(yi+1)&255]]];
    const u=f(xf),v=f(yf);return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v}
  return (x,y,oct=4)=>{let t=0,a=.5,fr=1;for(let i=0;i<oct;i++){t+=a*n2(x*fr,y*fr);a*=.5;fr*=2.03}return t}
}

// Wood grain canvas. Grain runs along the given axis ('x' = lines horizontal).
export function woodCanvas(w,h,o){
  const {light,dark,seed=1,freq=18,warp=2.5,stretch=10,axis='x',fleck=0.0,contrast=1}=o;
  const c=document.createElement('canvas');c.width=w;c.height=h;
  const ctx=c.getContext('2d');const img=ctx.createImageData(w,h);const d=img.data;
  const N=makeNoise(seed);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    let u=x/w,v=y/h; if(axis==='y'){const t=u;u=v;v=t}
    const n=N(u*2,v*stretch*.2,4);
    let g=(v*freq+n*warp+N(u*.7+3,v*3,2)*1.5);
    g=g-Math.floor(g); g=Math.pow(Math.abs(Math.sin(g*Math.PI)),6)*0.75; // late-wood lines
    let t=Math.min(1,(g+ N(u*40,v*stretch*8,2)*.35 + n*.35)*contrast);
    if(fleck){const fl=N(u*90,v*20,1);if(fl>.72)t+=fleck*(fl-.72)*3}
    t=Math.max(0,Math.min(1,t));
    const i=(y*w+x)*4;
    d[i]=light[0]+(dark[0]-light[0])*t;d[i+1]=light[1]+(dark[1]-light[1])*t;d[i+2]=light[2]+(dark[2]-light[2])*t;d[i+3]=255;
  }
  ctx.putImageData(img,0,0);return c;
}

export function canvasTex(c,{srgb=true,repeat=1,aniso=8}={}){
  const t=new THREE.CanvasTexture(c);
  if(srgb)t.colorSpace=THREE.SRGBColorSpace;else t.colorSpace=THREE.NoColorSpace;
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=aniso;return t;
}

// ---------- engraving primitives (drawn white on black into a mask) ----------
function crossLatin(c,s){c.fillRect(-.045*s,-.26*s,.09*s,.52*s);c.fillRect(-.17*s,-.12*s,.34*s,.085*s)}
function crossPattee(c,s,L=.25,wi=.05,wo=.2){
  for(let k=0;k<4;k++){c.save();c.rotate(k*Math.PI/2);c.beginPath();
    c.moveTo(-wi*s,0);c.lineTo(-wo*s/2,-L*s);c.quadraticCurveTo(0,-L*s*.9,wo*s/2,-L*s);c.lineTo(wi*s,0);c.closePath();c.fill();c.restore()}
}
function crossPotent(c,s,L,w){ // Jerusalem central cross (cross potent)
  c.fillRect(-w/2*s,-L*s,w*s,2*L*s);c.fillRect(-L*s,-w/2*s,2*L*s,w*s);
  const bw=w*2.6;
  c.fillRect(-bw/2*s,-L*s,bw*s,w*s*.85);c.fillRect(-bw/2*s,L*s-w*s*.85,bw*s,w*s*.85);
  c.fillRect(-L*s,-bw/2*s,w*s*.85,bw*s);c.fillRect(L*s-w*s*.85,-bw/2*s,w*s*.85,bw*s);
}
function greek(c,s,L,w){c.fillRect(-w/2*s,-L*s,w*s,2*L*s);c.fillRect(-L*s,-w/2*s,2*L*s,w*s)}
function shieldPath(c,s){c.beginPath();c.moveTo(-.3*s,-.33*s);c.lineTo(.3*s,-.33*s);c.lineTo(.3*s,.02*s);
  c.quadraticCurveTo(.28*s,.26*s,0,.38*s);c.quadraticCurveTo(-.28*s,.26*s,-.3*s,.02*s);c.closePath()}

function hatchSquare(c,s){ // engraved background of a decorated square
  c.fillStyle='rgba(255,255,255,0.42)';c.fillRect(-s/2,-s/2,s,s);
  c.strokeStyle='rgba(255,255,255,0.35)';c.lineWidth=s*.012;
  for(let k=-s;k<s;k+=s*.07){c.beginPath();c.moveTo(k,-s/2);c.lineTo(k+s,s/2);c.stroke()}
  // corner flourishes
  c.strokeStyle='rgba(255,255,255,.9)';c.lineWidth=s*.022;
  c.strokeRect(-s*.45,-s*.45,s*.9,s*.9);
  for(let k=0;k<4;k++){c.save();c.rotate(k*Math.PI/2);c.beginPath();c.arc(-s*.37,-s*.37,s*.05,0,Math.PI*2);c.stroke();c.restore()}
}
function medallion(c,s,type){
  c.save();
  const W='#fff',B='#000';
  if(type===0){ // Latin cross in a circle
    c.fillStyle=B;c.beginPath();c.arc(0,0,.36*s,0,7);c.fill();
    c.strokeStyle=W;c.lineWidth=.03*s;c.beginPath();c.arc(0,0,.34*s,0,7);c.stroke();
    c.lineWidth=.012*s;c.beginPath();c.arc(0,0,.29*s,0,7);c.stroke();
    c.fillStyle=W;crossLatin(c,s*1.05);
  }else if(type===1){ // cross pattée in a shield
    c.fillStyle=B;shieldPath(c,s);c.fill();c.strokeStyle=W;c.lineWidth=.028*s;c.stroke();
    c.save();c.scale(.82,.82);c.lineWidth=.014*s;shieldPath(c,s);c.stroke();c.restore();
    c.fillStyle=W;c.translate(0,.01*s);crossPattee(c,s,.2,.04,.17);
  }else if(type===2){ // Jerusalem cross
    c.fillStyle=B;c.beginPath();c.arc(0,0,.37*s,0,7);c.fill();
    c.strokeStyle=W;c.lineWidth=.026*s;c.beginPath();c.arc(0,0,.35*s,0,7);c.stroke();
    c.fillStyle=W;crossPotent(c,s,.19,.06);
    for(const [dx,dy] of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.save();c.translate(dx*.15*s,dy*.15*s);greek(c,s,.055,.03);c.restore()}
  }else{ // St Benedict medal cross with C S P B
    c.fillStyle=B;c.beginPath();c.arc(0,0,.37*s,0,7);c.fill();
    c.strokeStyle=W;c.lineWidth=.022*s;c.beginPath();c.arc(0,0,.355*s,0,7);c.stroke();
    c.lineWidth=.012*s;c.beginPath();c.arc(0,0,.31*s,0,7);c.stroke();
    // dots ring
    c.fillStyle=W;for(let k=0;k<24;k++){const a=k/24*Math.PI*2;c.beginPath();c.arc(Math.cos(a)*.333*s,Math.sin(a)*.333*s,.008*s,0,7);c.fill()}
    c.fillStyle=W;greek(c,s,.27,.07);
    c.fillStyle=W;c.font=`bold ${Math.round(.12*s)}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';
    c.fillText('C',-.15*s,-.15*s);c.fillText('S',.15*s,-.15*s);c.fillText('P',-.15*s,.16*s);c.fillText('B',.15*s,.16*s);
  }
  c.restore();
}

// Running baroque scroll along a band (local coords: x along, y across, centered)
function scrollBand(c,len,th,phase=0){
  c.save();
  c.strokeStyle='#fff';c.fillStyle='#fff';
  c.lineWidth=th*.05;c.strokeRect(-len/2+th*.05,-th/2+th*.06,len-th*.1,th-th*.12);
  c.lineWidth=th*.025;c.strokeRect(-len/2+th*.13,-th/2+th*.15,len-th*.26,th-th*.3);
  const inner=th*.32, p=th*1.5; const n=Math.max(1,Math.round((len-th*.4)/p)); const pp=(len-th*.4)/n;
  c.beginPath();c.rect(-len/2+th*.15,-th/2+th*.16,len-th*.3,th-th*.32);c.clip();
  c.lineWidth=th*.045;c.lineCap='round';
  // stem
  c.beginPath();for(let x=-len/2+th*.2;x<=len/2-th*.2;x+=2){const y=Math.sin((x+len/2)/pp*Math.PI*2+phase)*inner*.35;x===-len/2+th*.2?c.moveTo(x,y):c.lineTo(x,y)}c.stroke();
  for(let i=0;i<n*2;i++){
    const x0=-len/2+th*.2+(i+.25)*pp/2; const up=i%2===0?-1:1;
    // spiral volute
    c.lineWidth=th*.035;c.beginPath();
    const cx=x0+pp*.12,cy=up*inner*.42;
    for(let k=0;k<=40;k++){const t=k/40;const a=t*Math.PI*2.6*(up)+ (up<0?Math.PI*.5:-Math.PI*.5);const r=inner*.55*(1-t*.8);
      const x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;k?c.lineTo(x,y):c.moveTo(x,y)}
    c.stroke();
    c.beginPath();c.arc(cx,cy,th*.035,0,7);c.fill();
    // acanthus leaf
    c.save();c.translate(x0-pp*.12,-up*inner*.18);c.rotate(up*.6);
    c.beginPath();c.ellipse(0,0,pp*.11,inner*.16,0,0,7);c.fill();c.restore();
  }
  c.restore();
}

function drawMaskImage(c,img,x,y,w,h,rot){
  c.save();c.translate(x+w/2,y+h/2);if(rot)c.rotate(Math.PI);
  c.globalCompositeOperation='lighten';
  c.drawImage(img,-w/2,-h/2,w,h);c.restore();
}


// Procedural engraved side panels (Christ the King / St Benedict), white-on-black mask
function arcText(c,txt,r,start,end,size){c.save();c.font=`bold ${size}px Georgia,serif`;c.textAlign='center';c.textBaseline='middle';
  const n=txt.length;for(let i=0;i<n;i++){const a=start+(end-start)*(i+.5)/n;c.save();c.rotate(a);c.translate(0,-r);c.fillText(txt[i],0,0);c.restore()}c.restore()}
function chiRho(c,s){c.fillRect(-.035*s,-.3*s,.07*s,.6*s);c.lineWidth=.06*s;c.lineCap='round';
  c.beginPath();c.moveTo(-.2*s,-.12*s);c.lineTo(.2*s,.28*s);c.moveTo(.2*s,-.12*s);c.lineTo(-.2*s,.28*s);c.stroke();
  c.beginPath();c.arc(.08*s,-.2*s,.11*s,-Math.PI/2-.2,Math.PI/2+.2);c.stroke()}
function frame(c,w,h,s){c.strokeStyle='#fff';c.lineWidth=s*.04;c.strokeRect(-w/2+s*.12,-h/2+s*.12,w-s*.24,h-s*.24);
  c.lineWidth=s*.015;c.strokeRect(-w/2+s*.22,-h/2+s*.22,w-s*.44,h-s*.44);
  for(const [x,y] of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.save();c.translate(x*(w/2-s*.42),y*(h/2-s*.42));c.fillStyle='#fff';crossPattee(c,s*.7,.25,.05,.2);c.restore()}}
function panelArt(c,w,h,s,kind){
  c.save();c.fillStyle='#fff';c.strokeStyle='#fff';frame(c,w,h,s);
  c.textAlign='center';c.textBaseline='middle';
  if(kind==='christ'){
    // rays + Chi-Rho in a laurel circle, Alpha/Omega, IHS, scroll text
    c.save();c.translate(0,-h*.17);
    c.lineWidth=s*.012;for(let k=0;k<48;k++){const a=k/48*Math.PI*2;c.beginPath();c.moveTo(Math.cos(a)*s*1.05,Math.sin(a)*s*1.05);c.lineTo(Math.cos(a)*s*(k%2?1.4:1.6),Math.sin(a)*s*(k%2?1.4:1.6));c.stroke()}
    c.lineWidth=s*.05;c.beginPath();c.arc(0,0,s*.95,0,7);c.stroke();c.lineWidth=s*.015;c.beginPath();c.arc(0,0,s*.82,0,7);c.stroke();
    for(let k=0;k<28;k++){const a=k/28*Math.PI*2;c.save();c.rotate(a);c.translate(0,-s*.885);c.rotate(.6);c.beginPath();c.ellipse(0,0,s*.025,s*.06,0,0,7);c.fill();c.restore()}
    chiRho(c,s*2.2);
    c.font=`bold ${s*.38}px Georgia,serif`;c.fillText('Α',-s*.55,s*.2);c.fillText('Ω',s*.55,s*.2);
    c.restore();
    c.font=`bold ${s*.6}px Georgia,serif`;c.fillText('IHS',0,h*.12);
    c.save();c.translate(0,h*.24);c.lineWidth=s*.02;c.strokeRect(-w*.36,-s*.32,w*.72,s*.64);
    c.font=`italic ${s*.2}px Georgia,serif`;c.fillText('EGO SUM VIA,',0,-s*.12);c.fillText('VERITAS ET VITA',0,s*.14);c.restore();
    c.save();c.translate(0,h*.37);crossLatin(c,s*1.4);c.restore();
  }else{
    // St Benedict medal reverse: cross with CSSML / NDSMD, CSPB, PAX, VRS NSMV SMQL IVB
    c.save();c.translate(0,-h*.12);const R=s*1.75;
    c.lineWidth=s*.06;c.beginPath();c.arc(0,0,R,0,7);c.stroke();c.lineWidth=s*.02;c.beginPath();c.arc(0,0,R*.8,0,7);c.stroke();
    arcText(c,'✠ V R S N S M V S M Q L I V B',R*.9,-Math.PI*.92,Math.PI*.92,s*.17);
    c.fillRect(-s*.13,-R*.72,s*.26,R*1.44);c.fillRect(-R*.72,-s*.13,R*1.44,s*.26);
    c.fillStyle='#000';c.font=`bold ${s*.15}px Georgia,serif`;
    'CSSML'.split('').forEach((ch,i)=>c.fillText(ch,0,-R*.6+i*R*.3));
    'NDSMD'.split('').forEach((ch,i)=>{if(i!==2)c.fillText(ch,-R*.6+i*R*.3,0)});
    c.fillStyle='#fff';c.font=`bold ${s*.3}px Georgia,serif`;
    c.fillText('C',-R*.42,-R*.42);c.fillText('S',R*.42,-R*.42);c.fillText('P',-R*.42,R*.42);c.fillText('B',R*.42,R*.42);
    c.font=`bold ${s*.24}px Georgia,serif`;c.fillText('PAX',0,-R-s*.25);
    c.restore();
    // crozier (abbot's staff) and open Rule
    c.save();c.translate(0,h*.2);c.lineWidth=s*.07;c.lineCap='round';
    c.beginPath();c.moveTo(-s*.9,s*.9);c.lineTo(s*.6,-s*.6);c.stroke();
    c.beginPath();c.arc(s*.78,-s*.86,s*.26,Math.PI*.8,Math.PI*2.4);c.stroke();
    c.lineWidth=s*.03;c.beginPath();c.moveTo(-s*.95,-s*.45);c.quadraticCurveTo(-s*.5,-s*.62,0,-s*.45);c.quadraticCurveTo(s*.5,-s*.62,s*.95,-s*.45);
    c.lineTo(s*.95,s*.15);c.quadraticCurveTo(s*.5,-s*.02,0,s*.15);c.quadraticCurveTo(-s*.5,-s*.02,-s*.95,s*.15);c.closePath();c.stroke();
    c.beginPath();c.moveTo(0,-s*.45);c.lineTo(0,s*.15);c.stroke();
    c.font=`italic ${s*.13}px Georgia,serif`;c.fillText('AUSCULTA',-s*.48,-s*.2);c.fillText('O FILI',s*.48,-s*.2);c.restore();
    c.font=`bold ${s*.24}px Georgia,serif`;c.fillText('ORA ET LABORA',0,h*.4);
  }
  c.restore();
}

// Board layout in world units (square = 1)
export const BOARD={W:18.5,H:9,sq:1,panelW:4.4,gap:.35,border:.5};

export function loadImage(src){return new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.onerror=()=>r(null);i.src=src})}

// Build board top textures: color map + (R=height, G=roughness) map
export function buildBoardTextures(ppu,imgs){
  const {W,H,panelW,gap,border}=BOARD;
  const cw=Math.round(W*ppu),ch=Math.round(H*ppu);
  // wood base at half res then scaled
  const wood=woodCanvas(Math.round(cw/2),Math.round(ch/2),{light:[236,214,172],dark:[214,180,128],seed:7,freq:9,warp:3,stretch:6,axis:'x',contrast:.9});
  const mask=document.createElement('canvas');mask.width=cw;mask.height=ch;
  const m=mask.getContext('2d');m.fillStyle='#000';m.fillRect(0,0,cw,ch);
  const X=x=>(x+W/2)*ppu, Z=z=>(z+H/2)*ppu;
  const s=ppu;
  // squares
  for(let f=0;f<8;f++)for(let r=1;r<=8;r++){
    const dark=(f+r)%2===0; if(!dark)continue;
    const cx=X(f-3.5),cy=Z(4.5-r);
    m.save();m.translate(cx,cy);
    hatchSquare(m,s);
    const type=[0,1,2,3][(f*3+r*5+ (f>>1))%4];
    // rotate emblems on black's half so they face each player
    if(r>=5)m.rotate(Math.PI);
    medallion(m,s,type);
    m.restore();
  }
  // playing area frame
  m.strokeStyle='#fff';m.lineWidth=s*.04;m.strokeRect(X(-4)-s*.04,Z(-4)-s*.04,8*s+s*.08,8*s+s*.08);
  m.lineWidth=s*.015;m.strokeRect(X(-4)-s*.1,Z(-4)-s*.1,8*s+s*.2,8*s+s*.2);
  // outer bands top/bottom
  const bandTh=border*.9*s;
  m.save();m.translate(X(0),Z(-H/2+border/2));scrollBand(m,(W-.1)*s,bandTh,0);m.restore();
  m.save();m.translate(X(0),Z(H/2-border/2));m.rotate(Math.PI);scrollBand(m,(W-.1)*s,bandTh,0);m.restore();
  // side bands (outer edges)
  for(const sx of [-1,1]){m.save();m.translate(X(sx*(W/2-border/2)),Z(0));m.rotate(Math.PI/2);scrollBand(m,(H-border*2)*s,bandTh,1);m.restore()}
  // gaps between playing area and panels
  for(const sx of [-1,1]){m.save();m.translate(X(sx*(4+gap/2)),Z(0));m.rotate(Math.PI/2);scrollBand(m,8*s,gap*.95*s,2);m.restore()}
  // panels
  const px0=4+gap, pw=panelW, ph=8;
  const right=imgs.benedict, left=imgs.christ;
  if(right)drawMaskImage(m,right,X(px0),Z(-4),pw*s,ph*s,false);
  else{m.save();m.translate(X(px0+pw/2),Z(0));panelArt(m,pw*s,ph*s,s,'benedict');m.restore()}
  if(left)drawMaskImage(m,left,X(-px0-pw),Z(-4),pw*s,ph*s,true);
  else{m.save();m.translate(X(-px0-pw/2),Z(0));m.rotate(Math.PI);panelArt(m,pw*s,ph*s,s,'christ');m.restore()}
  for(const sx of [-1,1]){m.strokeStyle='#fff';m.lineWidth=s*.03;const x=sx>0?X(px0):X(-px0-pw);m.strokeRect(x,Z(-4),pw*s,ph*s)}

  // composite
  const col=document.createElement('canvas');col.width=cw;col.height=ch;const cc=col.getContext('2d');
  cc.imageSmoothingQuality='high';cc.drawImage(wood,0,0,cw,ch);
  const cd=cc.getImageData(0,0,cw,ch),md=m.getImageData(0,0,cw,ch);
  const hr=document.createElement('canvas');hr.width=cw;hr.height=ch;const hc=hr.getContext('2d');const hd=hc.createImageData(cw,ch);
  const a=cd.data,b=md.data,h=hd.data;const burnt=[88,52,26];
  for(let i=0;i<a.length;i+=4){
    const mv=b[i]/255; const k=Math.min(1,mv*.88);
    a[i]=a[i]*(1-k)+burnt[0]*k;a[i+1]=a[i+1]*(1-k)+burnt[1]*k;a[i+2]=a[i+2]*(1-k)+burnt[2]*k;
    h[i]=255-mv*200; h[i+1]=110+mv*120; h[i+2]=0; h[i+3]=255;
  }
  cc.putImageData(cd,0,0);hc.putImageData(hd,0,0);
  return {color:col,hr};
}
