// Procedural St Peter's Basilica: nave, vault, crossing, dome, baldacchino, altar, mosaics.
// Everything is built from simple three.js geometry and canvas textures (no downloads).
import * as THREE from 'three';
import { canvasTex } from './textures.js?v=5';

export const FLOOR=-3.5;
export const BOUNDS={x:28.5,yMin:FLOOR+0.6,yMax:92,zMin:-60,zMax:112};
const NW=30, WALL_TOP=26.5, CROSS_TOP=58, Z0=-62, Z1=114, NAVE0=-6, DOME_Z=-34;

const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]};
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const goldGrad=(g,x0,y0,x1,y1)=>{const l=g.createLinearGradient(x0,y0,x1,y1);l.addColorStop(0,'#a87a2a');l.addColorStop(.45,'#e9c76a');l.addColorStop(.55,'#f3d98a');l.addColorStop(1,'#9a6c22');return l};
function veins(g,w,h,col,n){g.strokeStyle=col;for(let i=0;i<n;i++){g.lineWidth=.5+rnd()*1.5;g.beginPath();let x=rnd()*w,y=rnd()*h;g.moveTo(x,y);for(let k=0;k<8;k++){x+=(rnd()-.4)*w*.15;y+=(rnd()-.5)*h*.12;g.lineTo(x,y)}g.stroke()}}

// ---------- textures ----------
function cosmatiTex(){ // one 1024px floor tile: quincunx of porphyry and serpentine roundels
  const S=1024,[c,g]=cv(S,S);
  g.fillStyle='#e6dac2';g.fillRect(0,0,S,S);veins(g,S,S,'rgba(150,130,100,.18)',40);
  const red='#7c2226',grn='#2e5a48',gry='#8c8a86',crm='#efe4cc';
  const speck=(x,y,r,base,dot)=>{g.save();g.beginPath();g.arc(x,y,r,0,7);g.clip();g.fillStyle=base;g.fillRect(x-r,y-r,2*r,2*r);g.fillStyle=dot;for(let i=0;i<r*r/30;i++){g.fillRect(x-r+rnd()*2*r,y-r+rnd()*2*r,2,2)}g.restore()};
  const triRing=(x,y,r0,r1,n)=>{for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,am=(a0+a1)/2;
    g.fillStyle=i%2?red:grn;g.beginPath();g.moveTo(x+Math.cos(a0)*r0,y+Math.sin(a0)*r0);g.lineTo(x+Math.cos(a1)*r0,y+Math.sin(a1)*r0);g.lineTo(x+Math.cos(am)*r1,y+Math.sin(am)*r1);g.closePath();g.fill();
    g.fillStyle=crm;g.beginPath();g.moveTo(x+Math.cos(a0)*r1,y+Math.sin(a0)*r1);g.lineTo(x+Math.cos(a1)*r1,y+Math.sin(a1)*r1);g.lineTo(x+Math.cos(am)*r0,y+Math.sin(am)*r0);g.closePath();g.fill()}};
  const roundel=(x,y,R,main)=>{g.fillStyle=gry;g.beginPath();g.arc(x,y,R,0,7);g.fill();triRing(x,y,R*.62,R*.92,Math.round(R/9));
    g.fillStyle=main===red?grn:red;g.beginPath();g.arc(x,y,R*.62,0,7);g.fill();speck(x,y,R*.5,main,'rgba(255,220,200,.25)')};
  // border band with triangles
  g.fillStyle=gry;g.fillRect(0,0,S,40);g.fillRect(0,S-40,S,40);g.fillRect(0,0,40,S);g.fillRect(S-40,0,40,S);
  for(let i=0;i<32;i++){const x=i*32;g.fillStyle=i%2?red:grn;
    for(const y of [8,S-32]){g.beginPath();g.moveTo(x,y+24);g.lineTo(x+16,y);g.lineTo(x+32,y+24);g.fill()}
    for(const xx of [8,S-32]){g.beginPath();g.moveTo(xx+24,x);g.lineTo(xx,x+16);g.lineTo(xx+24,x+32);g.fill()}}
  // interlaced bands linking the roundels
  g.strokeStyle=gry;g.lineWidth=26;g.beginPath();g.moveTo(190,190);g.lineTo(834,834);g.moveTo(834,190);g.lineTo(190,834);g.stroke();
  g.strokeStyle=crm;g.lineWidth=12;g.stroke();
  roundel(512,512,270,red);for(const [x,y] of [[190,190],[834,190],[190,834],[834,834]])roundel(x,y,120,grn);
  g.strokeStyle='rgba(40,30,20,.35)';g.lineWidth=2;g.strokeRect(40,40,S-80,S-80);
  return c;
}
function marbleCanvas(w,h,base,vein){const [c,g]=cv(w,h);g.fillStyle=base;g.fillRect(0,0,w,h);veins(g,w,h,vein,Math.round(w*h/6000));return c}
function bayTex(){ // one nave bay: marble wall with a gilded arched niche
  const W=256,H=480,[c,g]=cv(W,H);g.drawImage(marbleCanvas(W,H,'#e2d5bc','rgba(140,120,95,.2)'),0,0);
  g.fillStyle='#b9a68a';g.fillRect(0,H-40,W,40); // dado
  const x0=46,x1=210,yt=110,yb=H-40,r=(x1-x0)/2;
  const rg=g.createLinearGradient(0,yt,0,yb);rg.addColorStop(0,'#5a3c26');rg.addColorStop(1,'#3a2618');
  g.fillStyle=rg;g.beginPath();g.moveTo(x0,yb);g.lineTo(x0,yt+r);g.arc(W/2,yt+r,r,Math.PI,0);g.lineTo(x1,yb);g.fill();
  g.strokeStyle=goldGrad(g,0,yt,0,yb);g.lineWidth=9;g.stroke();
  g.fillStyle='#7c2226';g.fillRect(14,yt+r+10,18,yb-yt-r-20);g.fillRect(W-32,yt+r+10,18,yb-yt-r-20); // porphyry strips
  g.fillStyle=goldGrad(g,0,0,0,30);g.fillRect(0,0,W,22);
  return c;
}
function cofferTex(){const S=256,[c,g]=cv(S,S);g.fillStyle='#e9dfc8';g.fillRect(0,0,S,S);
  for(let i=0;i<5;i++){const m=24+i*12;const t=0.35+i*0.13;g.fillStyle=i===4?'#7a5a24':`rgb(${200-i*25|0},${170-i*25|0},${110-i*18|0})`;g.fillRect(m,m,S-2*m,S-2*m)}
  const cx=S/2;g.fillStyle=goldGrad(g,cx-40,cx-40,cx+40,cx+40);
  for(let k=0;k<8;k++){g.save();g.translate(cx,cx);g.rotate(k*Math.PI/4);g.beginPath();g.ellipse(0,-22,10,22,0,0,7);g.fill();g.restore()}
  g.beginPath();g.arc(cx,cx,11,0,7);g.fillStyle='#fff0b0';g.fill();
  g.strokeStyle=goldGrad(g,0,0,S,S);g.lineWidth=6;g.strokeRect(24,24,S-48,S-48);return c}
function friezeTex(text){const [c,g]=cv(2048,96);const b=g.createLinearGradient(0,0,0,96);b.addColorStop(0,'#16284e');b.addColorStop(1,'#0e1a36');g.fillStyle=b;g.fillRect(0,0,2048,96);
  g.fillStyle=goldGrad(g,0,0,0,96);g.fillRect(0,0,2048,7);g.fillRect(0,89,2048,7);
  g.font='600 54px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillStyle='#f0cf72';g.fillText(text,1024,50,2000);return c}
function domeTex(){const W=1024,H=512,[c,g]=cv(W,H);const hh=H/2; // dome uses top half only
  const bg=g.createLinearGradient(0,0,0,hh);bg.addColorStop(0,'#fff6d8');bg.addColorStop(.12,'#f6d47c');bg.addColorStop(.5,'#3a5a8c');bg.addColorStop(1,'#24406c');g.fillStyle=bg;g.fillRect(0,0,W,H);
  const n=16,cw=W/n;
  for(let i=0;i<n;i++){for(let r=0;r<5;r++){const y=hh*(.2+r*.16),h=hh*.11,w=cw*(.32+r*.09);g.fillStyle=goldGrad(g,0,y,0,y+h);g.globalAlpha=.85;g.fillRect(i*cw+(cw-w)/2,y,w,h);g.globalAlpha=1}
    g.fillStyle=goldGrad(g,i*cw,0,i*cw+12,0);g.fillRect(i*cw-6,hh*.12,12,hh)}
  g.fillStyle='#fffbe8';g.fillRect(0,0,W,hh*.1);return c}
function drumTex(){const W=2048,H=256,[c,g]=cv(W,H);g.drawImage(marbleCanvas(W,H,'#e6dac2','rgba(140,120,95,.2)'),0,0);
  const n=16,cw=W/n;for(let i=0;i<n;i++){const x=i*cw+cw*.3,w=cw*.4;const l=g.createLinearGradient(0,40,0,170);l.addColorStop(0,'#fffbe6');l.addColorStop(1,'#ffd98a');g.fillStyle=l;g.beginPath();g.moveTo(x,170);g.lineTo(x,70);g.arc(x+w/2,70,w/2,Math.PI,0);g.lineTo(x+w,170);g.fill();g.strokeStyle='#b88a34';g.lineWidth=5;g.stroke()}
  g.drawImage(friezeTex('TV ES PETRVS ET SVPER HANC PETRAM AEDIFICABO ECCLESIAM MEAM · TIBI DABO CLAVES REGNI CAELORVM ·'),0,190,W,66);return c}
function gloryTex(){const S=512,[c,g]=cv(S,S),cx=S/2;g.translate(cx,cx);
  for(let i=0;i<48;i++){g.rotate(Math.PI*2/48);const L=i%2?230:250;const l=g.createLinearGradient(0,0,0,-L);l.addColorStop(0,'rgba(255,214,120,.95)');l.addColorStop(1,'rgba(200,140,40,0)');g.fillStyle=l;g.beginPath();g.moveTo(-9,0);g.lineTo(0,-L);g.lineTo(9,0);g.fill()}
  const w=g.createRadialGradient(0,0,10,0,0,120);w.addColorStop(0,'#fff8e0');w.addColorStop(.6,'#ffcf6a');w.addColorStop(1,'#d08a20');g.fillStyle=w;g.beginPath();g.ellipse(0,0,105,120,0,0,7);g.fill();
  g.strokeStyle='#8a5a1a';g.lineWidth=4;g.stroke();g.strokeStyle='rgba(140,90,30,.5)';g.lineWidth=2;
  for(let k=-3;k<=3;k++){g.beginPath();g.moveTo(k*30,-118);g.lineTo(k*30,118);g.stroke();g.beginPath();g.moveTo(-104,k*34);g.lineTo(104,k*34);g.stroke()}
  // dove of the Holy Spirit
  g.fillStyle='#fffdf6';g.beginPath();g.ellipse(0,6,16,34,0,0,7);g.fill();g.beginPath();g.arc(0,-30,11,0,7);g.fill();
  for(const s of [-1,1]){g.beginPath();g.moveTo(s*8,-4);g.quadraticCurveTo(s*60,-40,s*90,-8);g.quadraticCurveTo(s*55,6,s*10,14);g.fill()}
  g.beginPath();g.moveTo(-12,36);g.lineTo(0,62);g.lineTo(12,36);g.fill();return c}

// ---------- devotional mosaic panels ----------
const FLESH='#d6a678',DARK='#2a1a10';
function face(g,x,y,s,{hair='#3a2414',beard=null,beardLen=1,hood=null}={}){
  if(hair&&!hood){g.fillStyle=hair;g.beginPath();g.ellipse(x,y-6*s,58*s,66*s,0,0,7);g.fill();g.beginPath();g.moveTo(x-56*s,y-10*s);g.quadraticCurveTo(x-66*s,y+70*s,x-50*s,y+112*s);g.lineTo(x+50*s,y+112*s);g.quadraticCurveTo(x+66*s,y+70*s,x+56*s,y-10*s);g.fill()}
  g.fillStyle=FLESH;g.fillRect(x-18*s,y+40*s,36*s,60*s);
  const fg=g.createRadialGradient(x-12*s,y-10*s,8*s,x,y,72*s);fg.addColorStop(0,'#ecc49a');fg.addColorStop(1,'#b88456');g.fillStyle=fg;g.beginPath();g.ellipse(x,y,44*s,58*s,0,0,7);g.fill();
  if(hair&&!hood){g.fillStyle=hair;g.beginPath();g.ellipse(x,y-46*s,46*s,22*s,0,Math.PI,0);g.fill();g.beginPath();g.moveTo(x-46*s,y-40*s);g.quadraticCurveTo(x,y-56*s,x+46*s,y-40*s);g.lineTo(x+46*s,y-28*s);g.quadraticCurveTo(x,y-50*s,x-46*s,y-28*s);g.fill()}
  if(beard){g.fillStyle=beard;g.beginPath();g.moveTo(x-42*s,y+6*s);g.quadraticCurveTo(x-36*s,y+(58+26*beardLen)*s,x,y+(64+30*beardLen)*s);g.quadraticCurveTo(x+36*s,y+(58+26*beardLen)*s,x+42*s,y+6*s);g.quadraticCurveTo(x+26*s,y+34*s,x,y+28*s);g.quadraticCurveTo(x-26*s,y+34*s,x-42*s,y+6*s);g.fill()}
  g.strokeStyle=DARK;g.lineWidth=3*s;g.lineCap='round';
  for(const d of [-1,1]){g.beginPath();g.arc(x+d*18*s,y-12*s,13*s,Math.PI*1.15,Math.PI*1.85);g.stroke();
    g.fillStyle='#f4ead8';g.beginPath();g.ellipse(x+d*18*s,y-2*s,10*s,5*s,0,0,7);g.fill();g.fillStyle=DARK;g.beginPath();g.arc(x+d*18*s,y-2*s,3.6*s,0,7);g.fill()}
  g.beginPath();g.moveTo(x-3*s,y-10*s);g.lineTo(x-4*s,y+18*s);g.quadraticCurveTo(x,y+22*s,x+5*s,y+18*s);g.stroke();
  g.strokeStyle='#8a3a2a';g.beginPath();g.moveTo(x-9*s,y+33*s);g.quadraticCurveTo(x,y+36*s,x+9*s,y+33*s);g.stroke();
}
function halo(g,x,y,R,cross){const h=g.createRadialGradient(x,y,R*.2,x,y,R);h.addColorStop(0,'#f8e39a');h.addColorStop(1,'#d9aa48');g.fillStyle=h;g.beginPath();g.arc(x,y,R,0,7);g.fill();g.strokeStyle='#8a5a1a';g.lineWidth=4;g.stroke();
  g.strokeStyle='rgba(140,90,30,.6)';g.lineWidth=2;g.beginPath();g.arc(x,y,R-10,0,7);g.stroke();
  if(cross){g.fillStyle='#9a2a20';for(const a of [-Math.PI/2,Math.PI,0]){g.save();g.translate(x,y);g.rotate(a);g.beginPath();g.moveTo(R*.62,-14);g.lineTo(R-6,-22);g.lineTo(R-6,22);g.lineTo(R*.62,14);g.fill();g.restore()}}}
function bust(g,x,y,col,{trim=null,mantle=null,side=1}={}){g.fillStyle=col;g.beginPath();g.moveTo(x-210,700);g.quadraticCurveTo(x-200,y+40,x-50,y);g.lineTo(x+50,y);g.quadraticCurveTo(x+200,y+40,x+210,700);g.fill();
  if(trim){g.strokeStyle=trim;g.lineWidth=8;g.beginPath();g.moveTo(x-46,y+4);g.quadraticCurveTo(x,y+40,x+46,y+4);g.stroke();g.beginPath();g.moveTo(x+70*side,y+20);g.lineTo(x+86*side,700);g.stroke()}
  if(mantle){g.fillStyle=mantle;g.beginPath();g.moveTo(x-210*side,700);g.quadraticCurveTo(x-200*side,y+40,x-50*side,y);g.quadraticCurveTo(x-20*side,y+120,x+40*side,y+200);g.quadraticCurveTo(x+120*side,y+300,x+150*side,700);g.fill();
    g.strokeStyle='rgba(10,15,30,.45)';g.lineWidth=3;for(let k=0;k<4;k++){g.beginPath();g.moveTo(x-150*side+k*30*side,y+100+k*40);g.quadraticCurveTo(x-60*side+k*30*side,y+260,x+k*40*side,700);g.stroke()}}}
function key(g,x,y,len,ang,col){g.save();g.translate(x,y);g.rotate(ang);g.fillStyle=col;g.strokeStyle='rgba(60,40,10,.7)';g.lineWidth=2;
  g.beginPath();g.arc(0,0,len*.14,0,7);g.fill();g.stroke();g.fillStyle='rgba(60,40,10,.6)';g.beginPath();g.arc(0,0,len*.06,0,7);g.fill();g.fillStyle=col;
  g.fillRect(-len*.03,len*.12,len*.06,len*.8);g.strokeRect(-len*.03,len*.12,len*.06,len*.8);g.fillRect(-len*.03,len*.72,len*.18,len*.06);g.fillRect(-len*.03,len*.84,len*.18,len*.06);g.restore()}
function tiara(g,x,y,s){g.fillStyle='#ece6da';g.beginPath();g.moveTo(x-50*s,y+60*s);g.quadraticCurveTo(x-56*s,y-50*s,x,y-70*s);g.quadraticCurveTo(x+56*s,y-50*s,x+50*s,y+60*s);g.closePath();g.fill();
  for(const [yy,w] of [[48,52],[8,50],[-32,42]]){g.fillStyle=goldGrad(g,0,y+(yy-8)*s,0,y+(yy+8)*s);g.fillRect(x-w*s,y+(yy-7)*s,2*w*s,14*s);for(let k=-2;k<=2;k++){g.beginPath();g.moveTo(x+(k*18-6)*s,y+(yy-7)*s);g.lineTo(x+k*18*s,y+(yy-20)*s);g.lineTo(x+(k*18+6)*s,y+(yy-7)*s);g.fill()}}
  g.fillStyle='#d4a640';g.beginPath();g.arc(x,y-74*s,8*s,0,7);g.fill();g.fillRect(x-3*s,y-104*s,6*s,26*s);g.fillRect(x-10*s,y-96*s,20*s,5*s);
  g.fillStyle='#ece6da';for(const d of [-1,1])g.fillRect(x+d*30*s-8*s,y+60*s,16*s,46*s)}
function text(g,t,x,y,size,col='#7a1a14'){g.font=`600 ${size}px Georgia,serif`;g.textAlign='center';g.textBaseline='middle';g.fillStyle=col;g.fillText(t,x,y)}
export function panelCanvas(kind){
  const W=512,H=700,[c,g]=cv(W,H);seed=11+kind.length*7;
  g.fillStyle=goldGrad(g,0,0,W,H);g.fillRect(0,0,W,H);
  const cx=W/2;
  if(kind==='christ'){halo(g,cx,230,118,true);bust(g,cx,330,'#7a2a1c',{trim:'#d9aa48',mantle:'#1f3b6c',side:1});face(g,cx,240,1,{hair:'#3a2414',beard:'#3a2414'});
    g.fillStyle='#8a2418';g.fillRect(cx+40,440,120,150);g.strokeStyle='#e9c76a';g.lineWidth=7;g.strokeRect(cx+46,446,108,138);g.fillStyle='#e9c76a';g.fillRect(cx+94,470,12,90);g.fillRect(cx+70,495,60,12);
    g.fillStyle=FLESH;g.beginPath();g.ellipse(cx-80,470,26,32,0,0,7);g.fill();g.fillRect(cx-92,410,10,50);g.fillRect(cx-78,404,10,56);
    text(g,'IC',cx-170,110,58);text(g,'XC',cx+170,110,58);}
  if(kind==='mary'){halo(g,cx,230,118,false);bust(g,cx,330,'#1f3b6c');
    g.fillStyle='#5e1a22';g.beginPath();g.moveTo(cx-215,700);g.quadraticCurveTo(cx-200,300,cx-80,170);g.quadraticCurveTo(cx,120,cx+80,170);g.quadraticCurveTo(cx+200,300,cx+215,700);g.fill();
    g.strokeStyle='#e9c76a';g.lineWidth=7;g.beginPath();g.moveTo(cx-150,700);g.quadraticCurveTo(cx-120,330,cx-62,200);g.quadraticCurveTo(cx,160,cx+62,200);g.quadraticCurveTo(cx+120,330,cx+150,700);g.stroke();
    face(g,cx,250,.92,{hood:true});g.fillStyle='#1f3b6c';g.beginPath();g.ellipse(cx,196,44,14,0,Math.PI,0);g.fill();
    const star=(x,y)=>{g.fillStyle='#f3d98a';g.beginPath();for(let k=0;k<8;k++){const a=k*Math.PI/4,r=k%2?6:16;g.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}g.fill()};star(cx,165);star(cx-120,420);star(cx+120,420);
    g.fillStyle=FLESH;g.beginPath();g.ellipse(cx-34,520,24,40,.5,0,7);g.fill();g.beginPath();g.ellipse(cx+34,520,24,40,-.5,0,7);g.fill();
    text(g,'MP',cx-170,110,58);text(g,'ΘY',cx+170,110,58);}
  if(kind==='peter'){halo(g,cx,230,118,false);bust(g,cx,330,'#2c4a7a',{mantle:'#c49a3c',side:-1});face(g,cx,240,1,{hair:'#d8d2c6',beard:'#d8d2c6',beardLen:.35});
    g.fillStyle='#d8d2c6';for(let k=-3;k<=3;k++){g.beginPath();g.arc(cx+k*13,190,9,0,7);g.fill()}
    key(g,cx-36,410,190,-.35,'#e2b84e');key(g,cx+36,410,190,.35,'#d8dadc');g.fillStyle=FLESH;g.beginPath();g.ellipse(cx,440,40,28,0,0,7);g.fill();
    text(g,'S.',cx-175,110,52);text(g,'PETRVS',cx+150,110,44);}
  if(kind==='keys'){g.fillStyle='#8a1e20';g.beginPath();g.moveTo(80,140);g.lineTo(W-80,140);g.lineTo(W-80,470);g.quadraticCurveTo(W-80,600,cx,640);g.quadraticCurveTo(80,600,80,470);g.fill();g.strokeStyle='#e9c76a';g.lineWidth=8;g.stroke();
    tiara(g,cx,170,1.15);key(g,cx-110,300,300,-.62,'#e2b84e');key(g,cx+110,300,300,.62,'#d8dadc');
    g.strokeStyle='#c0303a';g.lineWidth=6;g.beginPath();g.moveTo(cx-40,470);g.quadraticCurveTo(cx,520,cx+40,470);g.moveTo(cx,500);g.lineTo(cx-20,570);g.moveTo(cx,500);g.lineTo(cx+20,570);g.stroke();}
  if(kind==='chirho'){g.strokeStyle='#2e6a3c';g.lineWidth=26;g.beginPath();g.arc(cx,320,190,0,7);g.stroke();g.fillStyle='#3e8a4c';
    for(let k=0;k<36;k++){const a=k/36*Math.PI*2;g.save();g.translate(cx+Math.cos(a)*190,320+Math.sin(a)*190);g.rotate(a+.6);g.beginPath();g.ellipse(0,0,8,22,0,0,7);g.fill();g.restore()}
    g.strokeStyle='#7a1a14';g.lineWidth=30;g.lineCap='butt';g.beginPath();g.moveTo(cx-110,200);g.lineTo(cx+110,440);g.moveTo(cx+110,200);g.lineTo(cx-110,440);g.moveTo(cx,160);g.lineTo(cx,480);g.stroke();
    g.beginPath();g.arc(cx+38,210,48,-Math.PI/2,Math.PI/2);g.stroke();text(g,'Α',cx-120,330,64);text(g,'Ω',cx+122,330,64);}
  // mosaic tesserae
  g.strokeStyle='rgba(40,25,10,.16)';g.lineWidth=1.2;const T=8;
  for(let y=0;y<H;y+=T){g.beginPath();g.moveTo(0,y+rnd()*1.5);g.lineTo(W,y+rnd()*1.5);for(let x=(y/T%2)*T/2;x<W;x+=T+rnd()*2){g.moveTo(x,y);g.lineTo(x,y+T)}g.stroke()}
  // caption band
  const cap={christ:'CHRISTVS PANTOCRATOR',mary:'SANCTA DEI GENETRIX',peter:'SANCTVS PETRVS APOSTOLVS',keys:'TV ES PETRVS',chirho:'IN HOC SIGNO VINCES'}[kind];
  g.fillStyle='#16284e';g.fillRect(0,H-70,W,70);g.fillStyle=goldGrad(g,0,H-70,0,H);g.fillRect(0,H-70,W,5);text(g,cap,cx,H-34,cap.length>20?27:32,'#f0cf72');
  g.strokeStyle='#7a1a14';g.lineWidth=10;g.strokeRect(5,5,W-10,H-10);return c;
}

// ---------- geometry helpers ----------
function solomonic(h,r){const g=new THREE.CylinderGeometry(r,r*1.08,h,14,48);const P=g.attributes.position;
  for(let i=0;i<P.count;i++){const y=P.getY(i),t=(y/h+.5);const a=t*Math.PI*2*3,amp=r*.35*Math.sin(Math.min(1,t*6)*Math.PI/2);P.setX(i,P.getX(i)+Math.cos(a)*amp);P.setZ(i,P.getZ(i)+Math.sin(a)*amp)}
  g.computeVertexNormals();g.translate(0,h/2,0);return g}
function stripeTex(a,b,n=6){const [c,g]=cv(64,256);g.fillStyle=a;g.fillRect(0,0,64,256);g.fillStyle=b;
  for(let i=-2;i<n+2;i++){g.beginPath();const y=i*256/n;g.moveTo(0,y);g.lineTo(64,y-60);g.lineTo(64,y-60+14);g.lineTo(0,y+14);g.fill()}return c}

export function buildBasilica(scene,{env,mobile}){
  const root=new THREE.Group();root.name='basilica';scene.add(root);
  const add=(geo,mat,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.matrixAutoUpdate=false;m.updateMatrix();root.add(m);return m};
  const gold=new THREE.MeshStandardMaterial({color:0xd8aa48,metalness:1,roughness:.3,envMap:env,envMapIntensity:1.5});
  const bronze=new THREE.MeshStandardMaterial({map:canvasTex(stripeTex('#3a2a1a','#c8963c')),metalness:.85,roughness:.38,envMap:env,envMapIntensity:1.3});
  const marble=(base,vein,rep=1,em=.06)=>{const t=canvasTex(marbleCanvas(512,512,base,vein));t.repeat.set(rep,rep);return new THREE.MeshStandardMaterial({map:t,roughness:.35,emissive:0xffffff,emissiveMap:t,emissiveIntensity:em})};
  const cream=marble('#e6dac2','rgba(140,120,95,.22)',2);
  // floor
  const ft=canvasTex(cosmatiTex(),{aniso:8});ft.repeat.set(4,11);
  const floor=add(new THREE.PlaneGeometry(2*NW,Z1-Z0).rotateX(-Math.PI/2),new THREE.MeshStandardMaterial({map:ft,color:0xbfb29c,roughness:.24,metalness:0,envMap:env,envMapIntensity:.6}),0,FLOOR,(Z0+Z1)/2);
  // walls with arched bays
  const bt=canvasTex(bayTex());bt.repeat.set((Z1-Z0)/16,1);
  const wallM=new THREE.MeshStandardMaterial({map:bt,roughness:.6,emissive:0xffffff,emissiveMap:bt,emissiveIntensity:.07,color:0xd8cab0});
  const wh=WALL_TOP-FLOOR;
  for(const s of [-1,1]){const w=add(new THREE.PlaneGeometry(Z1-Z0,wh).rotateY(-s*Math.PI/2),wallM,s*NW,FLOOR+wh/2,(Z0+Z1)/2);
    const up=add(new THREE.PlaneGeometry(NAVE0-Z0,CROSS_TOP-WALL_TOP).rotateY(-s*Math.PI/2),cream,s*NW,(WALL_TOP+CROSS_TOP)/2,(Z0+NAVE0)/2)}
  const endW=add(new THREE.PlaneGeometry(2*NW,CROSS_TOP-FLOOR),cream,0,(CROSS_TOP+FLOOR)/2,Z0);
  add(new THREE.PlaneGeometry(2*NW,CROSS_TOP-FLOOR).rotateY(Math.PI),cream,0,(CROSS_TOP+FLOOR)/2,Z1);
  // pilasters (instanced): shaft, gilded capital, base
  const fl=(()=>{const [c,g]=cv(128,16);for(let i=0;i<128;i++){const v=Math.cos(i/128*Math.PI*2*5);const k=200+v*30|0;g.fillStyle=`rgb(${k+20},${k+8},${k-14})`;g.fillRect(i,0,1,16)}return canvasTex(c)})();
  const pil=[];for(let z=Z0+16;z<Z1;z+=16)for(const s of [-1,1])pil.push([s*(NW-0.6),z]);
  const inst=(geo,mat,y)=>{const im=new THREE.InstancedMesh(geo,mat,pil.length);const m4=new THREE.Matrix4();pil.forEach(([x,z],i)=>{m4.makeTranslation(x,y,z);im.setMatrixAt(i,m4)});root.add(im);return im};
  inst(new THREE.BoxGeometry(1.2,wh-4,3.2),new THREE.MeshStandardMaterial({map:fl,roughness:.45,emissive:0xffffff,emissiveMap:fl,emissiveIntensity:.05}),FLOOR+2+(wh-4)/2);
  inst(new THREE.BoxGeometry(1.8,2,4),marble('#9a948a','rgba(60,60,60,.3)'),FLOOR+1);
  inst(new THREE.BoxGeometry(1.8,2.2,4.2),gold,WALL_TOP-1.1);
  // entablature with gilded inscription
  const fz=canvasTex(friezeTex('TV ES PETRVS ET SVPER HANC PETRAM AEDIFICABO ECCLESIAM MEAM'));fz.repeat.set(3,1);
  const fzM=new THREE.MeshStandardMaterial({map:fz,emissive:0xffffff,emissiveMap:fz,emissiveIntensity:.2,roughness:.5});
  for(const s of [-1,1])add(new THREE.BoxGeometry(2,2.4,Z1-Z0),[fzM,fzM,gold,cream,fzM,fzM],s*(NW-1),WALL_TOP+1.2,(Z0+Z1)/2);
  // coffered barrel vault over the nave
  const ct=canvasTex(cofferTex());ct.repeat.set(9,10);
  const vault=new THREE.CylinderGeometry(NW,NW,Z1-NAVE0,36,1,true,-Math.PI/2,Math.PI);vault.rotateX(-Math.PI/2);
  add(vault,new THREE.MeshStandardMaterial({map:ct,emissive:0xffffff,emissiveMap:ct,emissiveIntensity:.16,roughness:.5,side:THREE.BackSide}),0,WALL_TOP+2.4,(NAVE0+Z1)/2);
  const arch=new THREE.InstancedMesh(new THREE.TorusGeometry(NW-.4,.7,6,32,Math.PI),gold,7);{let i=0;const m4=new THREE.Matrix4();for(let z=NAVE0;z<Z1&&i<7;z+=16)arch.setMatrixAt(i++,m4.makeTranslation(0,WALL_TOP+2.4,z));arch.count=i;root.add(arch)}
  // lunette between nave vault and crossing ceiling
  const sh=new THREE.Shape();sh.moveTo(-NW,WALL_TOP+2.4);sh.lineTo(-NW,CROSS_TOP);sh.lineTo(NW,CROSS_TOP);sh.lineTo(NW,WALL_TOP+2.4);sh.absarc(0,WALL_TOP+2.4,NW,0,Math.PI,false);
  const lun=new THREE.MeshStandardMaterial({color:0xe6dac2,roughness:.6,emissive:0xe6dac2,emissiveIntensity:.07,side:THREE.DoubleSide});
  add(new THREE.ShapeGeometry(sh,16),lun,0,0,NAVE0);
  // crossing: ceiling ring, drum with windows and inscription, dome, lantern
  const DR=27;
  add(new THREE.RingGeometry(DR,46,40,1).rotateX(Math.PI/2),new THREE.MeshStandardMaterial({map:ct,emissive:0xffffff,emissiveMap:ct,emissiveIntensity:.16,side:THREE.DoubleSide}),0,CROSS_TOP,DOME_Z);
  const dt=canvasTex(drumTex());dt.repeat.set(-1,1);
  add(new THREE.CylinderGeometry(DR,DR,12,40,1,true),new THREE.MeshBasicMaterial({color:0xd8ccb4,map:dt,side:THREE.BackSide,fog:false}),0,CROSS_TOP+6,DOME_Z);
  add(new THREE.SphereGeometry(DR,40,14,0,Math.PI*2,0,Math.PI/2),new THREE.MeshBasicMaterial({color:0xe0d4bc,map:canvasTex(domeTex()),side:THREE.BackSide,fog:false}),0,CROSS_TOP+12,DOME_Z);
  // golden light shafts from the drum windows
  const [ac,ag]=cv(4,128);const agr=ag.createLinearGradient(0,0,0,128);agr.addColorStop(0,'#000');agr.addColorStop(.25,'#777');agr.addColorStop(.7,'#444');agr.addColorStop(1,'#000');ag.fillStyle=agr;ag.fillRect(0,0,4,128);
  const shaftM=new THREE.MeshBasicMaterial({color:0xffd27a,alphaMap:canvasTex(ac,{srgb:false}),transparent:true,opacity:.07,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide,fog:false});
  for(const [a,len] of [[.5,62],[2.3,58],[4.2,60]]){const sx=Math.cos(a)*DR*.9,sz=Math.sin(a)*DR*.9;const from=new THREE.Vector3(sx,CROSS_TOP+6,DOME_Z+sz),to=new THREE.Vector3(-sx*.15,FLOOR,DOME_Z-sz*.15+6);
    const m=new THREE.Mesh(new THREE.CylinderGeometry(2.2,4.5,from.distanceTo(to),12,1,true),shaftM);m.position.copy(from).add(to).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),from.clone().sub(to).normalize());m.renderOrder=5;root.add(m)}
  // Cathedra glory with the dove on the apse wall
  add(new THREE.PlaneGeometry(22,22),new THREE.MeshBasicMaterial({map:canvasTex(gloryTex()),transparent:true,depthWrite:false}),0,30,Z0+.3);
  // Bernini's baldacchino: four twisted bronze columns, gilded capitals, canopy, orb and cross
  const BZ=DOME_Z,BH=21,BS=5.2;
  const colG=solomonic(BH,.75);
  for(const [x,z] of [[-BS,-BS],[BS,-BS],[-BS,BS],[BS,BS]]){add(new THREE.BoxGeometry(2.4,2.4,2.4),marble('#9a948a','rgba(60,60,60,.3)'),x,FLOOR+1.2,BZ+z);add(colG,bronze,x,FLOOR+2.4,BZ+z);add(new THREE.BoxGeometry(2,1.2,2),gold,x,FLOOR+2.4+BH+.6,BZ+z)}
  const ct2=FLOOR+2.4+BH+1.2;
  const valT=(()=>{const [c,g]=cv(512,64);g.fillStyle='#2e2016';g.fillRect(0,0,512,64);g.fillStyle=goldGrad(g,0,0,0,64);g.fillRect(0,0,512,10);for(let i=0;i<16;i++){g.beginPath();g.moveTo(i*32,18);g.quadraticCurveTo(i*32+16,70,i*32+32,18);g.fill()}return canvasTex(c)})();
  add(new THREE.BoxGeometry(2*BS+2.4,2.2,2*BS+2.4),[...Array(6)].map((_,i)=>i===2||i===3?gold:new THREE.MeshStandardMaterial({map:valT,metalness:.6,roughness:.45,envMap:env})),0,ct2+1.1,BZ);
  for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]]){const v=new THREE.Mesh(new THREE.TorusGeometry(4,.35,6,16,Math.PI/2),bronze);v.position.set(x*BS*.6,ct2+2.2,BZ+z*BS*.6);v.rotation.y=Math.atan2(-x,-z)+Math.PI/2;v.rotation.z=0;root.add(v)}
  add(new THREE.SphereGeometry(1.1,16,10),gold,0,ct2+6.4,BZ);add(new THREE.BoxGeometry(.35,3,.35),gold,0,ct2+8.6,BZ);add(new THREE.BoxGeometry(1.8,.35,.35),gold,0,ct2+9.2,BZ);
  // papal high altar (Altare della Confessione) with crucifix and six candlesticks
  const AY=FLOOR+1;add(new THREE.BoxGeometry(12,2,8),marble('#c8bba2','rgba(120,100,80,.25)'),0,FLOOR+1,BZ);
  const front=(()=>{const [c,g]=cv(512,128);g.fillStyle='#7c2226';g.fillRect(0,0,512,128);g.strokeStyle='#e9c76a';g.lineWidth=8;g.strokeRect(6,6,500,116);g.fillStyle='#e9c76a';g.fillRect(250,26,12,76);g.fillRect(226,50,60,12);return canvasTex(c)})();
  const am=marble('#efe4cc','rgba(140,120,95,.2)');
  add(new THREE.BoxGeometry(7,2.6,3),[am,am,am,am,new THREE.MeshStandardMaterial({map:front,roughness:.4}),new THREE.MeshStandardMaterial({map:front,roughness:.4})],0,AY+2+1.3,BZ);
  add(new THREE.BoxGeometry(7.3,.15,3.3),gold,0,AY+2+2.65,BZ);
  const top=AY+2+2.72;
  add(new THREE.BoxGeometry(.18,3.6,.18),gold,0,top+1.8,BZ);add(new THREE.BoxGeometry(1.9,.18,.18),gold,0,top+2.7,BZ);add(new THREE.CylinderGeometry(.35,.5,.3,12),gold,0,top+.15,BZ);
  const ivory=new THREE.MeshStandardMaterial({color:0xf2e6cc,roughness:.4});
  add(new THREE.CapsuleGeometry(.13,.8,4,8),ivory,0,top+2.15,BZ+.15);add(new THREE.SphereGeometry(.12,10,8),ivory,0,top+2.75,BZ+.17);
  for(const s of [-1,1]){const a=add(new THREE.CapsuleGeometry(.05,.75,3,6),ivory,s*.42,top+2.62,BZ+.15);a.rotation.z=s*1.35;a.updateMatrix()}
  const csG=new THREE.LatheGeometry([[.35,0],[.32,.1],[.12,.25],[.18,.5],[.08,.8],[.1,1.3],[.07,1.7],[.22,1.8],[.24,1.86]].map(p=>new THREE.Vector2(p[0],p[1])),12);
  const cs=new THREE.InstancedMesh(csG,gold,6),cnd=new THREE.InstancedMesh(new THREE.CylinderGeometry(.09,.09,.9,8),new THREE.MeshStandardMaterial({color:0xfaf4e4,roughness:.6,emissive:0x302010}),6),flm=new THREE.InstancedMesh(new THREE.ConeGeometry(.07,.25,8),new THREE.MeshBasicMaterial({color:0xffd070}),6);
  const m4=new THREE.Matrix4();[-3,-2.2,-1.4,1.4,2.2,3].forEach((x,i)=>{cs.setMatrixAt(i,m4.makeTranslation(x,top,BZ-.6));cnd.setMatrixAt(i,m4.makeTranslation(x,top+2.3,BZ-.6));flm.setMatrixAt(i,m4.makeTranslation(x,top+2.9,BZ-.6))});root.add(cs,cnd,flm);
  // devotional mosaic panels in the bays (gilded frames)
  const panels=[];
  for(const [kind,s,z] of [['christ',-1,-6],['peter',1,-6],['mary',-1,10],['keys',1,10],['chirho',-1,26]]){
    const t=canvasTex(panelCanvas(kind));const pm=new THREE.MeshStandardMaterial({map:t,roughness:.35,metalness:.15,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.22});
    add(new THREE.BoxGeometry(.35,13.4,10.2),gold,s*(NW-.5),FLOOR+3+6.5,z);
    const p=add(new THREE.PlaneGeometry(9,12.3).rotateY(-s*Math.PI/2),pm,s*(NW-.75),FLOOR+3+6.5,z);panels.push({kind,pos:p.position.clone(),normal:new THREE.Vector3(-s,0,0)})}
  // warm light from the dome over the altar
  const dl=new THREE.PointLight(0xffd59a,22,120,1.2);dl.position.set(0,40,DOME_Z+8);scene.add(dl);
  root.userData.panels=panels;
  return root;
}

// The stately table the board sits on (top surface at y=0): verde antico top, gilded edge, marble pedestal.
export function buildPlinth(scene,{env}){
  const g=new THREE.Group();scene.add(g);
  const vt=canvasTex(marbleCanvas(512,512,'#1f3a30','rgba(170,200,170,.22)'));vt.repeat.set(2,1.4);
  const top=new THREE.Mesh(new THREE.BoxGeometry(24,.5,16),new THREE.MeshPhysicalMaterial({map:vt,roughness:.25,clearcoat:.6,clearcoatRoughness:.2}));top.position.y=-.25;top.receiveShadow=true;g.add(top);
  const gold=new THREE.MeshStandardMaterial({color:0xd8aa48,metalness:1,roughness:.3,envMap:env,envMapIntensity:1.4});
  const rim=new THREE.Mesh(new THREE.BoxGeometry(24.3,.16,16.3),gold);rim.position.y=-.42;g.add(rim);
  const pt=canvasTex(marbleCanvas(512,512,'#e2d5bc','rgba(140,120,95,.25)'));
  const ped=new THREE.Mesh(new THREE.BoxGeometry(20,FLOOR*-1-.5-1,12),new THREE.MeshStandardMaterial({map:pt,roughness:.4,emissive:0xffffff,emissiveMap:pt,emissiveIntensity:.04}));ped.position.y=(FLOOR+1-.5)/2;g.add(ped);
  const step=new THREE.Mesh(new THREE.BoxGeometry(22,1,14),new THREE.MeshStandardMaterial({color:0x8c867c,roughness:.5}));step.position.y=FLOOR+.5;g.add(step);
  return g;
}
