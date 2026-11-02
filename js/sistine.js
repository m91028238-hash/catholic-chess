// The Sistine Chapel built as real geometry around the board (real proportions: 40.9 x 13.4 x 20.7 m),
// textured with public-domain fresco scans from Wikimedia Commons (see ASSETS.md / Image credits).
import * as THREE from 'three';
import { FLOOR } from './basilica.js?v=15';

const S=2.6;                        // scene units per metre
export const ROOM={W:13.4*S,L:40.9*S,H:20.7*S,y0:FLOOR};
const HW=ROOM.W/2,HL=ROOM.L/2,y0=FLOOR,m=h=>y0+h*S;
// shallow barrel vault: chord 13.4 m, rise 5.19 m -> radius 6.92 m
const VR=6.92*S,VYC=m(13.78),VA=Math.asin(HW/VR),SPRING=VYC+Math.sqrt(VR*VR-HW*HW);
export const ceilingAt=x=>VYC+Math.sqrt(Math.max(0,VR*VR-x*x));
export const VAULT={R:VR,YC:VYC};
const BAY=ROOM.L/6;
// The 15th-century cycles, bay 1 = next to the altar (north wall = right when facing the altar)
const NORTH=[['baptism',1280/809],['temptations',1536/951],['calling',1536/914],['sermon',1280/745],['keys',1536/951],['supper',1280/720]];
const TITLES={baptism:'Baptism of Christ',temptations:'Temptations of Christ',calling:'Calling of the Apostles',sermon:'Sermon on the Mount',keys:'Delivery of the Keys',supper:'Last Supper',
  journey:'Moses’s Journey',trials:'Trials of Moses',redsea:'Crossing of the Red Sea',law:'Tables of the Law',korah:'Punishment of Korah',testament:'Testament of Moses'};
const SOUTH=[['journey',1280/782],['trials',1280/797],['redsea',1217/748],['law',1265/748],['korah',1515/948],['testament',1280/806]];

const HD=['judgement','baptism','temptations','keys','journey','trials','testament'];
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]};
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const basic=(o)=>new THREE.MeshBasicMaterial(Object.assign({toneMapped:false},o));

export class Sistine{
  constructor(scene,renderer){
    this.scene=scene;this.r=renderer;this.aniso=renderer.capabilities.getMaxAnisotropy();
    const mob=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700,mx=renderer.capabilities.maxTextureSize||2048;
    this.cap=Math.min(mx,mob?2048:4096); // every texture is clamped to this (mobile GPUs fail silently on oversized uploads)
    this.big=mx>=8192&&!mob;this.bigCeil=this.cap>=4096;
    this.loader=new THREE.TextureLoader();
    const g=this.g=new THREE.Group();scene.add(g);
    this._floor();this._walls();this._vault();this._altar();this._transenna();
  }
  tex(c,rx=1,ry=1){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=this.aniso;return t}
  fit(t){const im=t.image,c=this.cap;if(!im||!im.width||(im.width<=c&&im.height<=c))return t; // downscale oversized images
    const k=c/Math.max(im.width,im.height),[cc,x]=cv(Math.round(im.width*k),Math.round(im.height*k));x.drawImage(im,0,0,cc.width,cc.height);t.image=cc;t.needsUpdate=true;return t}
  load(name,mat,retry=1){return new Promise(res=>this.loader.load(`assets/sistine/${name}.jpg?v=15`,t=>{
    this.fit(t);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
    mat.userData.base=t;(this.mats||(this.mats={}))[name]=mat;if(!(this.hdTex&&this.hdTex[name]))mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true;res(t)},undefined,e=>{console.warn('Sistine: could not load',name,e);if(retry)setTimeout(()=>this.load(name,mat,0).then(res),1500);else res(null)}))}
  // ---------- floor: the chapel's Cosmatesque pavement (one panel = the chapel's width, repeated along the nave) ----------
  // after the real floor: a centre aisle of large guilloche rotae (concentric marble bands), flanked by panels of grey/white
  // lozenges in dark frames; drawn twice: colour, then a matching roughness map
  _floorCanvas(N,rough){
    const [c,x]=cv(N,N),u=N/13.4,R=()=>rnd();seed=11;
    const G=rough?{white:'#5a5a5a',grey:'#6a6a6a',dark:'#727272',red:'#4c4c4c',green:'#505050',grout:'#c0c0c0'}
      :{white:'#e9e4d9',grey:'#a09b92',dark:'#55504a',red:'#93564b',green:'#5f766a',grout:'#8a8379'};
    const ln=Math.max(1,N/1600);
    const marble=(col,veinA)=>{x.fillStyle=col;x.fillRect(0,0,N,N);if(rough)return;x.globalAlpha=veinA;x.strokeStyle='#8a8070';
      for(let i=0;i<120;i++){x.lineWidth=.4+R()*1.1*N/2048;x.beginPath();let a=R()*N,b=R()*N;x.moveTo(a,b);for(let k=0;k<5;k++){a+=(R()-.5)*N*.07;b+=(R()-.5)*N*.07;x.lineTo(a,b)}x.stroke()}x.globalAlpha=1};
    const clipDo=(path,fn)=>{x.save();path();x.clip();fn();x.restore()};
    const grid=(s,pat,rot=0)=>{x.save();if(rot){x.translate(N/2,N/2);x.rotate(rot);x.translate(-N/2,-N/2)}const g=Math.max(.8,s*.08),M=rot?N*.5:0;
      for(let j=Math.floor(-M/s)-1;j*s<N+M;j++)for(let i=Math.floor(-M/s)-1;i*s<N+M;i++){x.fillStyle=pat(i,j);x.fillRect(i*s+g/2,j*s+g/2,s-g,s-g)}x.restore()};
    const rect=(X,Y,W,H)=>()=>{x.beginPath();x.rect(X,Y,W,H)};
    const disc=(cx,cy,r)=>()=>{x.beginPath();x.arc(cx,cy,r,0,7)};
    const ring=(cx,cy,r0,r1,col)=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r1,0,7);x.arc(cx,cy,r0,0,7,true);x.fill()};
    marble(G.white,.16);
    // side panels of lozenges (grey/white diamonds) in dark frames, two per tile along the nave
    const sx0=.55*u,sw=3.85*u,frame=.12*u;
    for(const X of [sx0,N-sx0-sw])for(const Y of [.25*u,N/2+.25*u]){const H=N/2-.5*u;
      x.fillStyle=G.dark;x.fillRect(X,Y,sw,H);x.fillStyle=G.white;x.fillRect(X+frame,Y+frame,sw-2*frame,H-2*frame);
      const ix=X+frame*2.2,iy=Y+frame*2.2,iw=sw-frame*4.4,ih=H-frame*4.4;x.fillStyle=G.grout;x.fillRect(ix,iy,iw,ih);
      clipDo(rect(ix,iy,iw,ih),()=>grid(.3*u,(i,j)=>(i+j)%2?G.grey:G.white,Math.PI/4));
      // a small porphyry/serpentine roundel in the middle of each panel
      const cx=X+sw/2,cy=Y+H/2;ring(cx,cy,0,.62*u,G.dark);ring(cx,cy,0,.54*u,G.white);clipDo(disc(cx,cy,.5*u),()=>grid(.09*u,(i,j)=>(i+j)%2?G.dark:G.white));ring(cx,cy,0,.32*u,G.white);ring(cx,cy,0,.27*u,X<N/2?G.red:G.green)}
    // centre aisle: big guilloche rotae linked by interlacing white bands, small rotae between them
    const C=N/2,aw=4.3*u;x.fillStyle=G.dark;x.fillRect(C-aw/2,0,aw,N);x.fillStyle=G.white;x.fillRect(C-aw/2+frame,0,aw-2*frame,N);
    clipDo(rect(C-aw/2+frame*2,0,aw-frame*4,N),()=>{x.fillStyle=G.grout;x.fillRect(0,0,N,N);grid(.11*u,(i,j)=>((i>>1)+(j>>1))%2?G.dark:G.grey)});
    const RB=1.85*u,rs=.55*u,big=[N/4,3*N/4],small=[0,N/2,N];
    // interlacing bands (two sine curves crossing between the rotae)
    for(const sg of [1,-1]){x.lineWidth=.2*u+2*ln;x.strokeStyle=G.dark;const path=()=>{x.beginPath();for(let s=0;s<=400;s++){const t=s/400,yy=t*N,w=Math.sin(t*Math.PI*2)*(RB+.18*u)*sg;s?x.lineTo(C+w,yy):x.moveTo(C+w,yy)}};path();x.stroke();x.lineWidth=.2*u-2*ln;x.strokeStyle=G.white;path();x.stroke()}
    for(const cy of big){ // concentric bands, like the photo's great roundels
      const bands=[[1.0,G.dark],[.95,G.white],[.88,G.dark],[.84,G.white]];for(const [k,col] of bands)ring(C,cy,0,RB*k,col);
      clipDo(()=>{x.beginPath();x.arc(C,cy,RB*.80,0,7);x.arc(C,cy,RB*.62,0,7,true)},()=>{x.fillStyle=G.grout;x.fillRect(0,0,N,N);grid(.085*u,(i,j)=>(i+j)%2?G.dark:G.white)});
      for(const [k,col] of [[.62,G.white],[.58,G.dark],[.54,G.white],[.47,G.grey],[.43,G.white],[.36,G.dark],[.32,G.white]])ring(C,cy,0,RB*k,col);
      clipDo(disc(C,cy,RB*.3),()=>{x.fillStyle=G.grout;x.fillRect(0,0,N,N);grid(.07*u,(i,j)=>(i+j)%2?G.grey:G.white,Math.PI/4)});
      ring(C,cy,0,RB*.14,G.dark);ring(C,cy,0,RB*.11,G.red)}
    for(const cy of small){ring(C,cy,0,rs+.1*u,G.dark);ring(C,cy,0,rs,G.white);ring(C,cy,0,rs*.8,G.dark);ring(C,cy,0,rs*.72,G.green)}
    // wall-side borders
    for(const X of [.12*u,N-.12*u-.18*u]){x.fillStyle=G.dark;x.fillRect(X,0,.18*u,N)}
    if(!rough){x.globalAlpha=.035;x.fillStyle='#fff6e6';x.fillRect(0,0,N,N);x.globalAlpha=1} // soft contrast
    return c}
  _floor(){
    const big=this.big,N=big?4096:2048,col=this._floorCanvas(N,false),rgh=this._floorCanvas(N/2,true);
    const t=this.tex(col,1,ROOM.L/ROOM.W);t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;
    const rt=new THREE.CanvasTexture(rgh);rt.wrapS=rt.wrapT=THREE.RepeatWrapping;rt.repeat.copy(t.repeat);rt.anisotropy=this.aniso;
    const mat=new THREE.MeshStandardMaterial({map:t,roughnessMap:rt,roughness:1,metalness:0,color:0xb8b0a2,emissive:0xffffff,emissiveMap:t,emissiveIntensity:.62,envMapIntensity:.9});
    const f=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W,ROOM.L).rotateX(-Math.PI/2),mat);f.position.y=y0;f.receiveShadow=true;this.g.add(f);
    // soft contact shadow under the table
    const [sc,sx]=cv(256,256);const gr=sx.createRadialGradient(128,128,30,128,128,128);gr.addColorStop(0,'rgba(0,0,0,.45)');gr.addColorStop(1,'rgba(0,0,0,0)');sx.fillStyle=gr;sx.fillRect(0,0,256,256);
    const sh=new THREE.Mesh(new THREE.PlaneGeometry(20,20).rotateX(-Math.PI/2),basic({map:new THREE.CanvasTexture(sc),transparent:true,depthWrite:false}));sh.position.y=y0+.02;this.g.add(sh);
  }
  // ---------- painted surfaces (procedural canvases, after the Vatican tour photos) ----------
  _drape(W,H){ // gold/ochre swagged curtain with a studded top band and fringe (one bay = W px)
    const [c,d]=cv(W,H),P=W/30;
    for(let i=0;i<W;i++){const p=(i%P)/P,s=.66+.34*Math.pow(Math.sin(p*Math.PI),.6)+.03*Math.sin(i*1.7);
      d.fillStyle=`rgb(${Math.round(222*s)},${Math.round(176*s)},${Math.round(96*s)})`;d.fillRect(i,0,1,H)}
    const top=H*.07,sw=W/5; // festoons (swags) hanging between hooks
    for(let k=0;k<W;k+=sw)for(let j=7;j>=0;j--){const dep=top+H*.05+j*H*.028;
      d.beginPath();d.moveTo(k,top);d.quadraticCurveTo(k+sw/2,dep+H*.07,k+sw,top);d.lineTo(k+sw,top);d.quadraticCurveTo(k+sw/2,dep+H*.04,k,top);
      const g=d.createLinearGradient(0,dep-H*.04,0,dep+H*.07);g.addColorStop(0,j%2?'#e9c983':'#c99c50');g.addColorStop(1,j%2?'#a77a35':'#7d5824');d.fillStyle=g;d.fill()}
    for(let k=0;k<=W;k+=sw){d.fillStyle='#6b4a1e';d.beginPath();d.ellipse(k,top+6,10,16,0,0,7);d.fill();d.fillStyle='#e8c878';d.beginPath();d.arc(k,top,5,0,7);d.fill()} // knots
    d.fillStyle='#7b5a2a';d.fillRect(0,0,W,top);d.fillStyle='#b98f45';d.fillRect(0,top-6,W,6);d.fillRect(0,0,W,5);
    for(let i=12;i<W;i+=24){d.fillStyle='#2a1c10';d.beginPath();d.arc(i,top/2,5,0,7);d.fill();d.fillStyle='rgba(255,220,150,.6)';d.beginPath();d.arc(i-1.5,top/2-1.5,1.6,0,7);d.fill()} // dark studs
    const gl=d.createLinearGradient(0,0,0,H);gl.addColorStop(0,'rgba(255,236,190,.25)');gl.addColorStop(.5,'rgba(255,236,190,0)');gl.addColorStop(1,'rgba(50,30,10,.3)');d.fillStyle=gl;d.fillRect(0,0,W,H);
    for(let i=0;i<W;i+=5){d.fillStyle=i%10?'#c79a48':'#8a6428';d.fillRect(i,H-H*.075,3,H*.05)} // fringe
    d.fillStyle='#d8d0c0';d.fillRect(0,H-H*.025,W,H*.025);d.fillStyle='#8f8676';d.fillRect(0,H-3,W,3); // marble bench edge
    return c}
  _pilaster(x,X,Y,w,h){ // gilded grotesque pilaster: candelabrum of vases, scrolls and rosettes
    const g=x.createLinearGradient(X,0,X+w,0);g.addColorStop(0,'#7a5524');g.addColorStop(.5,'#e3c27a');g.addColorStop(1,'#7a5524');x.fillStyle=g;x.fillRect(X,Y,w,h);
    const i=w*.16;x.fillStyle='#4a2a22';x.fillRect(X+i,Y+i,w-2*i,h-2*i);
    const cx=X+w/2,iw=(w-2*i)/2-3;x.strokeStyle='#e8c46e';x.fillStyle='#d9b060';x.lineWidth=Math.max(1.5,w*.035);
    x.beginPath();x.moveTo(cx,Y+i);x.lineTo(cx,Y+h-i);x.stroke();
    for(let y=Y+i+iw;y<Y+h-i-iw;y+=iw*2.6){const k=Math.round((y-Y)/(iw*2.6))%3;
      if(k===0){x.beginPath();x.ellipse(cx,y,iw*.55,iw*.75,0,0,7);x.fill();x.fillRect(cx-iw*.7,y-iw*.85,iw*1.4,iw*.18)}
      else if(k===1){for(const s of [-1,1]){x.beginPath();x.arc(cx+s*iw*.45,y,iw*.45,s>0?Math.PI:0,s>0?Math.PI*2.6:Math.PI*1.6,s<0);x.stroke()}}
      else{x.fillStyle='#b8473a';x.beginPath();x.arc(cx,y,iw*.42,0,7);x.fill();x.fillStyle='#d9b060';x.beginPath();x.arc(cx,y,iw*.2,0,7);x.fill()}}
    x.fillStyle='#b08f55';x.fillRect(X-2,Y,w+4,w*.18);x.fillRect(X-2,Y+h-w*.18,w+4,w*.18)}
  _niche(u,cx,top,w,h,robe){ // painted niche with a pope (robe, cape, tiara)
    const arc=()=>{u.beginPath();u.moveTo(cx-w/2,top+h);u.lineTo(cx-w/2,top+w/2);u.arc(cx,top+w/2,w/2,Math.PI,0);u.lineTo(cx+w/2,top+h);u.closePath()};
    arc();const g=u.createRadialGradient(cx,top+h*.4,w*.1,cx,top+h*.5,h*.6);g.addColorStop(0,'#8a8270');g.addColorStop(1,'#3e3a32');u.fillStyle=g;u.fill();
    u.save();arc();u.clip();for(let a=0;a<9;a++){u.strokeStyle='rgba(230,210,160,.35)';u.lineWidth=2;u.beginPath();u.moveTo(cx,top+w/2);u.lineTo(cx+Math.cos(Math.PI+a*Math.PI/8)*w/2,top+w/2+Math.sin(Math.PI+a*Math.PI/8)*w/2);u.stroke()} // shell
    const fy=top+h*.3,fw=w*.62;u.fillStyle='#efe7d6';u.beginPath();u.moveTo(cx-fw*.35,fy+h*.08);u.lineTo(cx-fw*.5,top+h);u.lineTo(cx+fw*.5,top+h);u.lineTo(cx+fw*.35,fy+h*.08);u.fill();
    u.fillStyle=robe;u.beginPath();u.moveTo(cx-fw*.42,fy+h*.07);u.quadraticCurveTo(cx-fw*.6,fy+h*.4,cx-fw*.4,fy+h*.55);u.lineTo(cx+fw*.4,fy+h*.55);u.quadraticCurveTo(cx+fw*.6,fy+h*.4,cx+fw*.42,fy+h*.07);u.fill();
    u.fillStyle='#d8b060';u.fillRect(cx-fw*.06,fy+h*.07,fw*.12,h*.48);
    u.fillStyle='#d9a98a';u.beginPath();u.arc(cx,fy,fw*.17,0,7);u.fill();u.fillStyle='#ddd6c4';u.beginPath();u.ellipse(cx,fy-fw*.2,fw*.15,fw*.22,0,0,7);u.fill();u.fillStyle='#d8b060';for(const k of [-.25,-.15,-.05])u.fillRect(cx-fw*.15,fy+fw*k,fw*.3,fw*.03);
    u.restore();arc();u.strokeStyle='#c9a24e';u.lineWidth=Math.max(3,w*.06);u.stroke()}
  _window(u,cx,top,w,h){ // leaded glass: bullseye roundels behind lead cames, splayed stone reveal
    const arch=(cx,t,w,h)=>{u.beginPath();u.moveTo(cx-w/2,t+h);u.lineTo(cx-w/2,t+w/2);u.arc(cx,t+w/2,w/2,Math.PI,0);u.lineTo(cx+w/2,t+h);u.closePath()};
    arch(cx,top-w*.08,w*1.16,h+w*.08);u.fillStyle='#a48c68';u.fill();u.strokeStyle='#c9a24e';u.lineWidth=5;u.stroke();
    arch(cx,top,w,h);const g=u.createLinearGradient(0,top,0,top+h);g.addColorStop(0,'#fffaf0');g.addColorStop(1,'#e9dfc6');u.fillStyle=g;u.fill();
    u.save();u.clip();const r=w/14;
    for(let y=top+r;y<top+h;y+=r*1.75)for(let x0=cx-w/2+((Math.round((y-top)/(r*1.75))%2)?r:0);x0<cx+w/2+r;x0+=r*2){
      const rg=u.createRadialGradient(x0,y,1,x0,y,r);rg.addColorStop(0,'#fffdf6');rg.addColorStop(.7,'#d9e1d6');rg.addColorStop(1,'#b7ab8c');u.fillStyle=rg;u.beginPath();u.arc(x0,y,r*.92,0,7);u.fill();u.strokeStyle='#5d564c';u.lineWidth=2;u.stroke()}
    u.strokeStyle='#3e382f';u.lineWidth=4;for(const f of [.33,.66]){u.beginPath();u.moveTo(cx-w/2,top+h*f);u.lineTo(cx+w/2,top+h*f);u.stroke()}u.beginPath();u.moveTo(cx,top);u.lineTo(cx,top+h);u.stroke();
    // coloured border panes
    u.lineWidth=w*.06;u.strokeStyle='rgba(150,40,40,.75)';arch(cx,top,w*.94,h*1.0);u.stroke();u.lineWidth=w*.02;u.strokeStyle='rgba(40,70,140,.8)';arch(cx,top,w*.86,h);u.stroke();
    u.restore()}
  _lunette(u,cx,base,w,h,img){ // lunette (half-ellipse) with Michelangelo's Ancestors of Christ
    const path=()=>{u.beginPath();u.ellipse(cx,base,w/2,h,0,Math.PI,0);u.closePath()};
    path();u.fillStyle='#bfa77c';u.fill();
    if(img){u.save();path();u.clip();u.drawImage(img,cx-w/2,base-h,w,h*1.02);u.restore()}
    u.lineWidth=w*.025;u.strokeStyle='#e0c886';path();u.stroke();u.lineWidth=w*.01;u.strokeStyle='#6a5030';u.beginPath();u.ellipse(cx,base,w/2+w*.02,h+w*.02,0,Math.PI,0);u.stroke()}
  _upper(u,X,bw,uh,img,k){ // one side-wall bay of the window tier: spandrel painting, lunette over a leaded window, popes in niches
    const g=u.createLinearGradient(0,0,0,uh);g.addColorStop(0,'#b79f74');g.addColorStop(1,'#d6c5a0');u.fillStyle=g;u.fillRect(X,0,bw,uh);
    for(const s of [0,1]){u.fillStyle='#a88d5f';u.beginPath();u.moveTo(X+s*bw,0);u.lineTo(X+(s?bw*.82:bw*.18),0);u.lineTo(X+s*bw,uh*.36);u.fill()} // spandrel shadows into the corners of the vault
    u.strokeStyle='#e2c77e';u.lineWidth=4;u.strokeRect(X+8,uh*.47,bw-16,uh*.5); // painted marble panel frame
    for(let i=0;i<6;i++){u.fillStyle=`rgba(${i%2?'170,150,120':'200,185,150'},.25)`;u.fillRect(X+14+i*(bw-28)/6,uh*.9,(bw-28)/6,uh*.06)}
    const lw=bw*.86,lh=uh*.4;this._lunette(u,X+bw/2,lh+uh*.02,lw,lh,img);
    this._window(u,X+bw/2,uh*.3,bw*.3,uh*.62);
    this._niche(u,X+bw*.17,uh*.47,bw*.14,uh*.4,k%2?'#8b2a22':'#d9cfba');this._niche(u,X+bw*.83,uh*.47,bw*.14,uh*.4,k%2?'#d9cfba':'#8b2a22');
    u.fillStyle='#8c7550';u.fillRect(X,uh-8,bw,8)}
  _middle(f,X,bw,fh){ // fresco tier ground: warm plaster with gilded grotesque pilasters at the bay edges
    f.fillStyle='#bfa77f';f.fillRect(X,0,bw,fh);f.fillStyle='#a88f64';f.fillRect(X,0,bw,fh*.06);f.fillRect(X,fh*.94,bw,fh*.06);
    const pw=bw*.06;this._pilaster(f,X,0,pw,fh);this._pilaster(f,X+bw-pw,0,pw,fh)}
  _marble(N=256){const [c,x]=cv(N,N);x.fillStyle='#ece5d6';x.fillRect(0,0,N,N);seed=5;x.strokeStyle='rgba(120,110,95,.35)';
    for(let i=0;i<26;i++){x.lineWidth=.5+rnd()*1.5;x.beginPath();let a=rnd()*N,b=rnd()*N;x.moveTo(a,b);for(let k=0;k<6;k++){a+=(rnd()-.5)*N*.3;b+=(rnd()-.3)*N*.2;x.lineTo(a,b)}x.stroke()}return c}
  _img(name,fn){const im=new Image();im.onload=()=>fn(im);im.onerror=()=>console.warn('Sistine: could not load',name);im.src=`assets/sistine/${name}.jpg?v=15`}
  // ---------- side walls: drapery, fresco tier, popes & windows tier ----------
  _walls(){
    const px=150,bw=Math.round(6.8*px);
    const dc=this._drape(1024,Math.round(3.6*px)),dt=this.tex(dc,6,1);this.drapeCanvas=dc;
    const fh=Math.round(4.4*px),[fc,f]=cv(bw,fh);this._middle(f,0,bw,fh);const ft=this.tex(fc,6,1);
    const uh=Math.round((SPRING-m(8.9))/S*px),[uc,u]=cv(bw*2,uh);
    const drawU=(i1,i2)=>{this._upper(u,0,bw,uh,i1,0);this._upper(u,bw,bw,uh,i2,1)};drawU(null,null);
    const ut=this.tex(uc,3,1);
    this._img('lunette1',a=>this._img('lunette2',b=>{drawU(a,b);ut.needsUpdate=true;if(this.entU)this.entU(a,b)}));
    this.frescoMats=[];this.arts=[];
    const wall=new THREE.MeshStandardMaterial({color:0xcdb88e,roughness:.85});
    const rail=this._railTex();
    for(const side of [-1,1]){
      const rot=side<0?Math.PI/2:-Math.PI/2,x=side*HW;
      const plane=(h0,h1,map)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.L,h1-h0),basic({map}));p.rotation.y=rot;p.position.set(x,(h0+h1)/2,0);this.g.add(p)};
      plane(m(0),m(3.6),dt);plane(m(3.6),m(8.9),ft);plane(m(8.9),SPRING,ut); // continuous behind the cornices: no gaps
      const glow=new THREE.Mesh(new THREE.BoxGeometry(.08,.05*S,ROOM.L),basic({color:0xfff0c8}));glow.position.set(x-side*.42,m(3.55),0);this.g.add(glow); // warm strip light under the cornice
      for(const [h0,h1,dep] of [[3.6,4.0,.5],[8.4,8.9,1.1]]){const b=new THREE.Mesh(new THREE.BoxGeometry(dep,(h1-h0)*S,ROOM.L),wall);b.position.set(x-side*dep/2,m((h0+h1)/2),0);this.g.add(b)}
      const rl=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.L-2.2,.9*S),basic({map:rail(ROOM.L/(.9*S)),transparent:true,alphaTest:.4,side:THREE.DoubleSide}));rl.rotation.y=rot;rl.position.set(x-side*1.0,m(8.9)+.45*S,0);this.g.add(rl); // balcony railing
      (side>0?NORTH:SOUTH).forEach(([name,ar],i)=>{const z=-HL+(i+.5)*BAY;this._fresco(name,ar,x-side*.16,z,rot,5.7*S,side>0?-Math.PI/2:Math.PI/2,new THREE.Vector3(-side,0,0))});
    }
    this._entrance(dt,wall,rail);this._altarWall();
    // The Last Judgement (13.7 x 12 m) on the altar wall
    const lw=12.2*S,lh=lw*3072/2789;
    this.ljMat=basic({color:0x8a7a62});
    const lj=new THREE.Mesh(new THREE.PlaneGeometry(lw,lh),this.ljMat);lj.position.set(0,m(2.0)+lh/2,-HL+.06);this.g.add(lj);
    this.lj={c:lj.position.clone(),w:lw,h:lh};
    this._beams();
  }
  _fresco(name,ar,px,z,rot,w,yaw,n,ent){ // fresco in a gilt frame of non-overlapping strips (no z-fighting on mobile)
    const h=w/ar,cy=m(6.0),hor=!!ent,P=(dx,dy)=>hor?new THREE.Vector3(px+dx,cy+dy,z):new THREE.Vector3(px,cy+dy,z+dx);
    for(const [a,b2,col] of [[0,.32,0xd4b060],[.32,.7,0x7a5e2c]]){const mt=basic({color:col,side:THREE.DoubleSide}),t=b2-a;
      for(const [W,H,dz,dy] of [[w+2*b2,t,0,h/2+a+t/2],[w+2*b2,t,0,-h/2-a-t/2],[t,h+2*a,w/2+a+t/2,0],[t,h+2*a,-w/2-a-t/2,0]]){
        const fr=new THREE.Mesh(new THREE.PlaneGeometry(W,H),mt);fr.rotation.y=rot;fr.position.copy(P(hor?-dz:dz,dy));this.g.add(fr)}}
    const mat=basic({color:0x8a7a62,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const fm=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);fm.rotation.y=rot;fm.position.copy(P(0,0));fm.renderOrder=2;this.g.add(fm);
    this.frescoMats.push([name,mat]);
    this.arts.push({id:name,name:TITLES[name],c:fm.position.clone(),n,w,h,yaw,pitch:0})}
  _railTex(){const [c,x]=cv(256,96);x.fillStyle='#3a2c1c';x.fillRect(0,0,256,10);x.fillRect(0,86,256,10);x.fillStyle='#c9a24e';x.fillRect(0,3,256,3);
    for(let i=8;i<256;i+=16){x.fillStyle='#3a2c1c';x.fillRect(i-2,10,4,76);x.fillStyle='#b8913f';x.beginPath();x.ellipse(i,48,4,8,0,0,7);x.fill()}
    return k=>{const t=this.tex(c,k,1);t.wrapT=THREE.ClampToEdgeWrapping;return t}}
  _endGeo(){const shp=new THREE.Shape();shp.moveTo(-HW,y0);shp.lineTo(HW,y0);shp.lineTo(HW,SPRING);shp.absarc(0,VYC,VR,Math.PI/2-VA,Math.PI/2+VA,false);shp.lineTo(-HW,y0);
    const g=new THREE.ShapeGeometry(shp,32),p=g.attributes.position,uv=g.attributes.uv,top=VYC+VR;
    for(let i=0;i<p.count;i++)uv.setXY(i,(p.getX(i)+HW)/ROOM.W,(p.getY(i)-y0)/(top-y0));return g}
  _entrance(dt,wall,rail){ // entrance wall: drapery, carved door in a marble surround, two frescoes, windows, popes, lunettes
    const px=96,EW=Math.round(13.4*px),EH=Math.round(20.7*px),[c,x]=cv(EW,EH),Y=h=>EH-h*px,X=w=>EW/2+w*px;
    x.fillStyle='#c4ad84';x.fillRect(0,0,EW,EH);
    // fresco tier with pilasters at the corners, beside the door and between the frescoes
    x.save();x.translate(0,Y(8.9));this._middle(x,0,EW,5.3*px);x.restore();
    const pw=Math.round(.45*px);for(const w of [-6.7,-2.15,6.25,1.7])this._pilaster(x,X(w),Y(8.9),pw,5.3*px);
    // window tier and the vault end: spandrels, lunettes, windows, popes
    const ut0=Y(15.51),uh=Y(8.9)-ut0;
    const drawTop=(a,b)=>{x.save();x.beginPath();x.rect(0,0,EW,Y(8.9));x.clip();
      const g=x.createLinearGradient(0,0,0,Y(8.9));g.addColorStop(0,'#a89068');g.addColorStop(1,'#d2c19b');x.fillStyle=g;x.fillRect(0,0,EW,Y(8.9));
      // painted architecture in the arch of the vault: ribs and a gilt medallion (the Zechariah pendentive above the door)
      x.strokeStyle='#e0c37a';x.lineWidth=8;for(let i=-4;i<=4;i++){x.beginPath();x.moveTo(EW/2,Y(20.7)+40);x.lineTo(EW/2+i*EW*.14,ut0);x.stroke()}
      x.fillStyle='#7a5a34';x.fillRect(EW*.38,Y(20.4),EW*.24,Y(16.2)-Y(20.4));x.fillStyle='#d8bf86';x.fillRect(EW*.39,Y(20.3),EW*.22,Y(16.3)-Y(20.3));
      this._niche(x,EW/2,Y(20.0),EW*.16,Y(16.6)-Y(20.0),'#3c5a8a');
      x.translate(0,ut0);this._upper(x,0,EW/2,uh,a,0);this._upper(x,EW/2,EW/2,uh,b,1);x.restore()};
    drawTop(null,null);
    const t=this.tex(c,1,1);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    this.entU=(a,b)=>{drawTop(a,b);t.needsUpdate=true};
    const ent=new THREE.Mesh(this._endGeo(),basic({map:t}));ent.rotation.y=Math.PI;ent.position.z=HL;this.g.add(ent);
    const ed=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W,3.6*S),basic({map:(()=>{const q=dt.clone();q.repeat.set(2,1);q.needsUpdate=true;return q})()}));ed.rotation.y=Math.PI;ed.position.set(0,m(1.8),HL-.05);this.g.add(ed);
    // carved walnut double door in a marble surround with a pediment
    const [dc,d]=cv(512,768),DW=512,DH=768;const mg=d.createLinearGradient(0,0,DW,0);mg.addColorStop(0,'#cfc6b4');mg.addColorStop(.5,'#f0e9da');mg.addColorStop(1,'#cfc6b4');d.fillStyle=mg;d.fillRect(0,0,DW,DH);
    d.fillStyle='#b9ad96';d.fillRect(0,0,DW,70);d.fillStyle='#e8dfcc';d.beginPath();d.moveTo(20,70);d.lineTo(DW/2,8);d.lineTo(DW-20,70);d.fill();d.strokeStyle='#9c8f78';d.lineWidth=4;d.stroke();
    d.fillStyle='#d4b060';d.font='bold 22px Georgia';d.textAlign='center';d.fillText('SIXTVS IIII PONT MAX',DW/2,108);
    const dx0=60,dy0=124,dw=DW-120,dh=DH-dy0;
    for(let i=0;i<dw;i++){const s=.75+.15*Math.sin(i*.31)+.1*Math.sin(i*.07+1);d.fillStyle=`rgb(${Math.round(92*s)},${Math.round(58*s)},${Math.round(34*s)})`;d.fillRect(dx0+i,dy0,1,dh)}
    for(const L of [0,1]){const lx=dx0+L*dw/2;for(let r=0;r<3;r++){const py=dy0+20+r*(dh-30)/3,ph=(dh-30)/3-20,pxx=lx+18,pww=dw/2-36;
      d.fillStyle='rgba(0,0,0,.35)';d.fillRect(pxx,py,pww,ph);d.fillStyle='#6e4526';d.fillRect(pxx+8,py+8,pww-16,ph-16);d.strokeStyle='rgba(255,210,150,.35)';d.lineWidth=3;d.strokeRect(pxx+4,py+4,pww-8,ph-8);
      d.fillStyle='#4a2c16';d.beginPath();d.ellipse(pxx+pww/2,py+ph/2,pww*.25,ph*.3,0,0,7);d.fill();d.strokeStyle='#c9a24e';d.lineWidth=2;d.stroke()}}
    d.fillStyle='#2a1a0e';d.fillRect(DW/2-3,dy0,6,dh);d.fillStyle='#d4b060';for(const s of [-1,1]){d.beginPath();d.arc(DW/2+s*16,dy0+dh*.55,7,0,7);d.fill()}
    const door=new THREE.Mesh(new THREE.PlaneGeometry(3.6*S,5.4*S),basic({map:this.tex(dc,1,1)}));door.rotation.y=Math.PI;door.position.set(0,m(2.7),HL-.12);this.g.add(door);
    // cornices, strip light and railing across the entrance wall (butting the side-wall cornices at the corners)
    for(const [x0,x1] of [[-HW+.5,-1.85*S],[1.85*S,HW-.5]]){const b=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,.4*S,.5),wall);b.position.set((x0+x1)/2,m(3.8),HL-.25);this.g.add(b);
      const gl=new THREE.Mesh(new THREE.BoxGeometry(x1-x0,.05*S,.08),basic({color:0xfff0c8}));gl.position.set((x0+x1)/2,m(3.55),HL-.42);this.g.add(gl)}
    const b2=new THREE.Mesh(new THREE.BoxGeometry(ROOM.W-2.2,.5*S,1.1),wall);b2.position.set(0,m(8.65),HL-.55);this.g.add(b2);
    const rl=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W-2.2,.9*S),basic({map:rail((ROOM.W-2.2)/(.9*S)),transparent:true,alphaTest:.4,side:THREE.DoubleSide}));rl.position.set(0,m(8.9)+.45*S,HL-1.0);this.g.add(rl);
    // the two 16th-century frescoes either side of the door
    this._fresco('resurrection',1280/776,4.25*S,HL-.16,Math.PI,4.2*S,Math.PI,new THREE.Vector3(0,0,-1),1);
    this._fresco('dispute',1213/723,-4.25*S,HL-.16,Math.PI,4.2*S,Math.PI,new THREE.Vector3(0,0,-1),1)}
  _altarWall(){ // around the Last Judgement: sky continuing into the vault arch, ochre margins, damask dado with the two side doors
    const px=64,EW=Math.round(13.4*px),EH=Math.round(20.7*px),[c,x]=cv(EW,EH),Y=h=>EH-h*px;
    const g=x.createLinearGradient(0,0,0,Y(14));g.addColorStop(0,'#5b78a8');g.addColorStop(1,'#4a679c');x.fillStyle=g;x.fillRect(0,0,EW,EH);
    seed=3;for(let i=0;i<40;i++){x.fillStyle=`rgba(240,235,220,${.1+rnd()*.2})`;x.beginPath();x.ellipse(rnd()*EW,rnd()*Y(14),40+rnd()*90,14+rnd()*30,0,0,7);x.fill()}
    x.fillStyle='#b99d6a';x.fillRect(0,Y(16),.62*px,Y(0)-Y(16));x.fillRect(EW-.62*px,Y(16),.62*px,Y(0)-Y(16));
    x.fillStyle='#6e2620';x.fillRect(0,Y(2.05),EW,2.05*px);x.fillStyle='rgba(212,170,90,.35)';for(let i=0;i<EW;i+=28)for(let j=Y(2.05)+10;j<EH;j+=28){x.beginPath();x.arc(i+((j/28|0)%2)*14,j,5,0,7);x.fill()}
    for(const s of [-1,1]){const cx=EW/2+s*5.3*px;x.fillStyle='#e8e0cf';x.fillRect(cx-.8*px,Y(2.0),1.6*px,2*px);x.fillStyle='#4a2c18';x.fillRect(cx-.6*px,Y(1.9),1.2*px,1.9*px)}
    x.strokeStyle='#d8b868';x.lineWidth=10;x.beginPath();x.arc(EW/2,Y(13.78),6.92*px,Math.PI*1.25,Math.PI*1.75);x.stroke();
    const t=this.tex(c,1,1);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    const alt=new THREE.Mesh(this._endGeo(),basic({map:t}));alt.position.z=-HL;this.g.add(alt)}
  _beams(){ // soft shafts of warm daylight slanting from the south windows
    const [c,x]=cv(64,256);const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(255,240,205,0)');g.addColorStop(.15,'rgba(255,240,205,1)');g.addColorStop(1,'rgba(255,240,205,0)');x.fillStyle=g;x.fillRect(0,0,64,256);
    x.globalCompositeOperation='destination-in';const h=x.createLinearGradient(0,0,64,0);h.addColorStop(0,'rgba(0,0,0,0)');h.addColorStop(.5,'rgba(0,0,0,1)');h.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=h;x.fillRect(0,0,64,256);
    const mat=basic({map:new THREE.CanvasTexture(c),transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const Yv=new THREE.Vector3(0,1,0);
    for(let i=0;i<6;i++){const z=-HL+(i+.5)*BAY,a=new THREE.Vector3(-HW+.3,m(12.3),z),b=new THREE.Vector3(HW*.25,y0,z+2.5*S),d=b.clone().sub(a),L=d.length();d.normalize();
      for(const r of [0,Math.PI/2]){const geo=new THREE.PlaneGeometry(2.2*S,L).rotateY(r);const ms=new THREE.Mesh(geo,mat);ms.quaternion.setFromUnitVectors(Yv,d.clone().negate());ms.position.copy(a).addScaledVector(d,L/2);ms.renderOrder=5;this.g.add(ms)}}}
  _vault(){
    const n=64,pos=[],uv=[],idx=[];
    for(let i=0;i<=n;i++){const a=-VA+2*VA*i/n,x=VR*Math.sin(a),y=VYC+VR*Math.cos(a);
      for(const z of [-HL,HL]){pos.push(x,y,z);uv.push(.5-z/ROOM.L,.5+x/ROOM.W)}} // orthographic (as photographed from below)
    for(let i=0;i<n;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
    this.ceilMat=basic({color:0xb8ab92,side:THREE.DoubleSide});
    this.g.add(new THREE.Mesh(g,this.ceilMat));
  }
  _altar(){
    const z=-HL+3.2*S,marble=new THREE.MeshStandardMaterial({color:0xe6dccb,roughness:.5});
    const gold=new THREE.MeshStandardMaterial({color:0xd4a64a,metalness:1,roughness:.3,envMap:this.scene.environment});
    const step=new THREE.Mesh(new THREE.BoxGeometry(8*S,.5*S,3.4*S),new THREE.MeshStandardMaterial({color:0xb7ab98,roughness:.6}));step.position.set(0,m(.25),z-.4);this.g.add(step);
    const alt=new THREE.Mesh(new THREE.BoxGeometry(3.6*S,1*S,1.2*S),marble);alt.position.set(0,m(1),z-1.2);this.g.add(alt);
    const front=new THREE.Mesh(new THREE.PlaneGeometry(3.2*S,.7*S),basic({color:0x7a2b24}));front.position.set(0,m(1),z-1.2+.6*S+.02);this.g.add(front);
    const top=m(1.5);
    const v=new THREE.Mesh(new THREE.BoxGeometry(.12*S,1.6*S,.12*S),gold);v.position.set(0,top+.8*S,z-1.6);this.g.add(v);
    const h=new THREE.Mesh(new THREE.BoxGeometry(.8*S,.1*S,.1*S),gold);h.position.set(0,top+1.15*S,z-1.6);this.g.add(h);
    const flame=basic({color:0xffd9a0});
    const sg=new THREE.CylinderGeometry(.05*S,.14*S,.9*S,10),cg=new THREE.CylinderGeometry(.035*S,.035*S,.3*S,8),fg=new THREE.SphereGeometry(.04*S,8,6);
    for(let i=0;i<6;i++){const xx=(i<3?-1:1)*(.45+((i%3))*.45)*S;
      const s=new THREE.Mesh(sg,gold);s.position.set(xx,top+.45*S,z-1.6);this.g.add(s);
      const c=new THREE.Mesh(cg,basic({color:0xf3eadb}));c.position.set(xx,top+1.05*S,z-1.6);this.g.add(c);
      const f=new THREE.Mesh(fg,flame);f.scale.y=1.8;f.position.set(xx,top+1.26*S,z-1.6);this.g.add(f)}
  }
  _transenna(){ // veined marble screen with a gilded wrought-iron grille, the cantoria (choir loft) and the organ cabinet
    const z=HL-14.5*S,mt=this.tex(this._marble(),2,1),marble=new THREE.MeshStandardMaterial({map:mt,color:0xffffff,roughness:.35});
    const [gc,x]=cv(512,256);x.clearRect(0,0,512,256);
    x.fillStyle='#2b241c';x.fillRect(0,0,512,14);x.fillRect(0,242,512,14);for(let i=10;i<512;i+=20)x.fillRect(i-2,14,5,228);
    for(let i=0;i<512;i+=64){x.strokeStyle='#2b241c';x.lineWidth=6;x.beginPath();x.arc(i+32,128,26,0,7);x.stroke();x.strokeStyle='#e0b85a';x.lineWidth=3;x.beginPath();x.arc(i+32,128,26,0,7);x.stroke();
      x.fillStyle='#e8c46a';x.beginPath();x.arc(i+32,128,8,0,7);x.fill();for(const yy of [40,216]){x.beginPath();x.ellipse(i+32,yy,6,12,0,0,7);x.fill()}}
    x.fillStyle='#e0b85a';x.fillRect(0,5,512,4);x.fillRect(0,247,512,4);
    for(const sx of [-1,1]){const w=HW-1.6*S,cx=sx*(1.6*S+w/2);
      const b=new THREE.Mesh(new THREE.BoxGeometry(w,1.4*S,.45*S),marble);b.position.set(cx,m(.7),z);this.g.add(b);
      const t=this.tex(gc,Math.max(1,Math.round(w/(2.2*S)*2)),1);const gr=new THREE.Mesh(new THREE.PlaneGeometry(w,2.2*S),basic({map:t,transparent:true,alphaTest:.3,side:THREE.DoubleSide}));gr.position.set(cx,m(2.5),z);this.g.add(gr);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(w,.12*S,.3*S),marble);cap.position.set(cx,m(3.65),z);this.g.add(cap);
      for(let k=0;k<3;k++){const xx=sx*(2.2*S+k*(w-1.2*S)/2);const p=new THREE.Mesh(new THREE.BoxGeometry(.25*S,2.3*S,.3*S),marble);p.position.set(xx,m(2.5),z);this.g.add(p);
        const cd=new THREE.Mesh(new THREE.CylinderGeometry(.06*S,.12*S,.6*S,8),marble);cd.position.set(xx,m(4.0),z);this.g.add(cd);
        const fl=new THREE.Mesh(new THREE.SphereGeometry(.09*S,8,6),basic({color:0xe0b85a}));fl.position.set(xx,m(4.35),z);this.g.add(fl)}}
    const loft=new THREE.Mesh(new THREE.BoxGeometry(1.2*S,1.3*S,3.4*S),marble);loft.position.set(HW-.6*S,m(3.0),z+4*S);this.g.add(loft);
    const lf=new THREE.Mesh(new THREE.PlaneGeometry(3.2*S,.9*S),basic({map:this.tex(gc,2,1),transparent:true,alphaTest:.3}));lf.rotation.y=-Math.PI/2;lf.position.set(HW-1.25*S,m(3.0),z+4*S);this.g.add(lf);
    // organ cabinet (walnut, with pipes) against the left wall, entrance side of the screen
    const [oc,o]=cv(256,384);for(let i=0;i<256;i++){const s=.8+.12*Math.sin(i*.4)+.08*Math.sin(i*.05);o.fillStyle=`rgb(${Math.round(120*s)},${Math.round(78*s)},${Math.round(44*s)})`;o.fillRect(i,0,1,384)}
    o.fillStyle='#3a2414';o.fillRect(0,0,256,24);o.fillRect(0,170,256,10);
    for(let i=0;i<9;i++){const pxp=24+i*24,ph=60+40*Math.sin(i/8*Math.PI);const g=o.createLinearGradient(pxp,0,pxp+16,0);g.addColorStop(0,'#8a8478');g.addColorStop(.5,'#eee8d8');g.addColorStop(1,'#8a8478');o.fillStyle=g;o.fillRect(pxp,165-ph,16,ph)}
    for(const r of [[20,195,100,160],[136,195,100,160]]){o.strokeStyle='#4a2c16';o.lineWidth=6;o.strokeRect(...r);o.strokeStyle='rgba(255,210,150,.3)';o.lineWidth=2;o.strokeRect(r[0]+6,r[1]+6,r[2]-12,r[3]-12)}
    const om=new THREE.MeshStandardMaterial({color:0x5a3a20,roughness:.6}),oz=z+2.2*S;
    const ob=new THREE.Mesh(new THREE.BoxGeometry(.8*S,3.4*S,1.8*S),om);ob.position.set(-HW+.4*S,m(1.7),oz);this.g.add(ob);
    const of=new THREE.Mesh(new THREE.PlaneGeometry(1.8*S,3.4*S),basic({map:this.tex(oc,1,1)}));of.rotation.y=Math.PI/2;of.position.set(-HW+.8*S+.05,m(1.7),oz);this.g.add(of);
    this.organ=[-HW,-HW+.8*S,oz-.9*S,oz+.9*S];
  }
  // camera targets for the Free-cam quick-jump list: centre, facing normal (into the room), size, view yaw/pitch
  artworks(){
    const L=this.lj,up=new THREE.Vector3(0,-1,0),zx=u=>(.5-u)*ROOM.L;
    const top=[
      {id:'ceiling',name:'Ceiling',c:new THREE.Vector3(0,ceilingAt(0),0),n:up,w:ROOM.W,h:ROOM.L*.55,yaw:Math.PI,pitch:Math.PI/2},
      {id:'adam',name:'Creation of Adam',c:new THREE.Vector3(0,ceilingAt(0),zx(.567)),n:up,w:5.7*S,h:2.8*S,yaw:0,pitch:Math.PI/2},
      {id:'judgement',name:'Last Judgement',c:L.c.clone(),n:new THREE.Vector3(0,0,1),w:L.w,h:L.h,yaw:0,pitch:0},
      {id:'christ',name:'Christ the Judge',c:new THREE.Vector3(L.c.x-.02*L.w,L.c.y+L.h*(.5-.31),L.c.z),n:new THREE.Vector3(0,0,1),w:L.w*.3,h:L.h*.2,yaw:0,pitch:0}];
    return top.concat(this.arts);
  }
  // Hi-res originals, only for the one or two frescoes the pilgrim is looking at (keeps phone GPU memory low)
  wantHD(name){if(!HD.includes(name)||this.r.capabilities.maxTextureSize<3072)return;
    const L=this.hdList||(this.hdList=[]),T=this.hdTex||(this.hdTex={}),i=L.indexOf(name);
    if(i>=0){L.splice(i,1);L.push(name);return}
    L.push(name);while(L.length>2)this._dropHD(L.shift());
    this.loader.load(`assets/sistine/hd/${name}.jpg?v=15`,t=>{const mat=this.mats&&this.mats[name];if(!L.includes(name)||!mat){t.dispose();return}
      this.fit(t);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
      T[name]=t;mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true},undefined,e=>{console.warn('Sistine: hi-res failed, keeping low-res',name,e);const k=L.indexOf(name);if(k>=0)L.splice(k,1)})} // low-res stays on until hi-res succeeds
  _dropHD(name){const t=this.hdTex[name];if(!t)return;const mat=this.mats[name];if(mat&&mat.userData.base){mat.map=mat.userData.base;mat.needsUpdate=true}t.dispose();delete this.hdTex[name]}
  loadCeiling(){return this.load(this.bigCeil?'ceiling-3129':'ceiling-2048',this.ceilMat)}
  loadArt(){return Promise.all([this.load('judgement',this.ljMat),...this.frescoMats.map(([n,mt])=>this.load(n,mt))])}
}
