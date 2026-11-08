// The Sistine Chapel built as real geometry around the board (real proportions: 40.9 x 13.4 x 20.7 m),
// textured with public-domain fresco scans from Wikimedia Commons (see ASSETS.md / Image credits).
import * as THREE from 'three';
import { FLOOR } from './basilica.js?v=22';

const S=2.6;                        // scene units per metre
export const ROOM={W:13.4*S,L:40.9*S,H:20.7*S,y0:FLOOR};
const HW=ROOM.W/2,HL=ROOM.L/2,y0=FLOOR,m=h=>y0+h*S;
// shallow barrel vault: chord 13.4 m, rise 5.19 m -> radius 6.92 m
const VR=6.92*S,VYC=m(13.78),VA=Math.asin(HW/VR),SPRING=VYC+Math.sqrt(VR*VR-HW*HW);
// the vault curves down into both end walls (as in the chapel, where Jonah and Zechariah sit on those curves): cove lengths in plan
const COVE_A=5*S,COVE_E=6*S;
const coveT=z=>z<-HL+COVE_A?(z+HL)/COVE_A:z>HL-COVE_E?(HL-z)/COVE_E:1;
export const ceilingAt=(x,z=0)=>{const y=VYC+Math.sqrt(Math.max(0,VR*VR-x*x)),t=Math.max(0,Math.min(1,coveT(z)));return SPRING+(y-SPRING)*Math.sin(t*Math.PI/2)};
export const VAULT={R:VR,YC:VYC};
const BAY=ROOM.L/6;
// The 15th-century cycles, bay 1 = next to the altar (north wall = right when facing the altar)
const NORTH=[['baptism',1280/809],['temptations',1536/951],['calling',1536/914],['sermon',1280/745],['keys',1536/951],['supper',1280/720]];
const TITLES={baptism:'Baptism of Christ',temptations:'Temptations of Christ',calling:'Calling of the Apostles',sermon:'Sermon on the Mount',keys:'Delivery of the Keys',supper:'Last Supper',
  journey:'Moses’s Journey',trials:'Trials of Moses',redsea:'Crossing of the Red Sea',law:'Tables of the Law',korah:'Punishment of Korah',testament:'Testament of Moses',resurrection:'Resurrection of Christ',dispute:'Body of Moses'};
const SOUTH=[['journey',1280/782],['trials',1280/797],['redsea',1217/748],['law',1265/748],['korah',1515/948],['testament',1280/806]];

const HD=['judgement','baptism','temptations','calling','keys','journey','trials','testament','resurrection'];
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]};
let seed=11;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const basic=(o)=>new THREE.MeshBasicMaterial(Object.assign({toneMapped:false},o));

export class Sistine{
  constructor(scene,renderer){
    this.scene=scene;this.r=renderer;this.aniso=renderer.capabilities.getMaxAnisotropy();
    const mob=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700,mx=renderer.capabilities.maxTextureSize||2048;
    this.cap=mx>=4096?4096:Math.min(mx,2048); // every texture is clamped to this (mobile GPUs fail silently on oversized uploads)
    this.big=mx>=8192&&!mob;this.bigCeil=this.cap>=4096;
    this.loader=new THREE.TextureLoader();
    const g=this.g=new THREE.Group();scene.add(g);
    this._floor();this._walls();this._vault();this._altar();this._transenna();
  }
  tex(c,rx=1,ry=1){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=this.aniso;return t}
  photo(name,rx=1,ry=1,cb){ // real-photo wall texture (Commons crops, assets/sistine/): sRGB, mipmaps, max anisotropy, clamped to the GPU limit
    const t=this.loader.load(`assets/sistine/${name}.jpg?v=22`,tt=>{this.fit(tt);tt.needsUpdate=true;if(cb)cb(tt)},undefined,e=>console.warn('Sistine: could not load',name,e));
    t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;return t}
  imgs(names,fn){const out={};let n=names.length;for(const k of names)this._img(k,im=>{out[k]=im;if(--n===0)fn(out)},()=>{if(--n===0)fn(out)})}
  fit(t){const im=t.image,c=this.cap;if(!im||!im.width||(im.width<=c&&im.height<=c))return t; // downscale oversized images
    const k=c/Math.max(im.width,im.height),[cc,x]=cv(Math.round(im.width*k),Math.round(im.height*k));x.drawImage(im,0,0,cc.width,cc.height);t.image=cc;t.needsUpdate=true;return t}
  load(name,mat,retry=1){return new Promise(res=>this.loader.load(`assets/sistine/${name}.jpg?v=22`,t=>{
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
  // ---------- painted surfaces: real-photo crops (see ASSETS.md) ----------
  _pilaster(x,X,Y,w,h,im){if(im)x.drawImage(im,X,Y,w,h)} // gilded grotesque pilaster (photo, SZ Romtour 18)
  _niche(u,cx,top,w,h,im){if(im)u.drawImage(im,cx-w/2,top,w,h)} // a pope in his shell niche (photo of the entrance wall, SZ Romtour 25)
  _window(u,cx,top,w,h,im){ // leaded bullseye glass (photo crop) in a stone reveal
    const arch=(cx,t,w,h)=>{u.beginPath();u.moveTo(cx-w/2,t+h);u.lineTo(cx-w/2,t+w/2);u.arc(cx,t+w/2,w/2,Math.PI,0);u.lineTo(cx+w/2,t+h);u.closePath()};
    arch(cx,top-w*.07,w*1.14,h+w*.07);u.fillStyle='#9c8664';u.fill();
    arch(cx,top,w,h);u.fillStyle='#e9dfc6';u.fill();
    if(im){u.save();arch(cx,top,w,h);u.clip();const tw=w/3,th=tw*im.height/im.width;for(let y=top;y<top+h;y+=th)for(let k=0;k<3;k++)u.drawImage(im,cx-w/2+k*tw,y,tw,th);u.restore()}}
  _lunette(u,cx,base,w,h,img){ // lunette (half-ellipse) with Michelangelo's Ancestors of Christ
    const path=()=>{u.beginPath();u.ellipse(cx,base,w/2,h,0,Math.PI,0);u.closePath()};
    path();u.fillStyle='#bfa77c';u.fill();
    if(img){u.save();path();u.clip();u.drawImage(img,cx-w/2,base-h,w,h*1.02);u.restore()}
    u.lineWidth=w*.025;u.strokeStyle='#e0c886';path();u.stroke();u.lineWidth=w*.01;u.strokeStyle='#6a5030';u.beginPath();u.ellipse(cx,base,w/2+w*.02,h+w*.02,0,Math.PI,0);u.stroke()}
  _upper(u,X,bw,uh,img,k,P={}){ // one side-wall bay of the window tier: spandrel painting, lunette over a leaded window, popes in niches
    const g=u.createLinearGradient(0,0,0,uh);g.addColorStop(0,'#b79f74');g.addColorStop(1,'#d6c5a0');u.fillStyle=g;u.fillRect(X,0,bw,uh);
    for(const s of [0,1]){u.fillStyle='#a88d5f';u.beginPath();u.moveTo(X+s*bw,0);u.lineTo(X+(s?bw*.82:bw*.18),0);u.lineTo(X+s*bw,uh*.36);u.fill()} // spandrel shadows into the corners of the vault
    u.strokeStyle='#e2c77e';u.lineWidth=4;u.strokeRect(X+8,uh*.47,bw-16,uh*.5); // painted marble panel frame
    for(let i=0;i<6;i++){u.fillStyle=`rgba(${i%2?'170,150,120':'200,185,150'},.25)`;u.fillRect(X+14+i*(bw-28)/6,uh*.9,(bw-28)/6,uh*.06)}
    const lw=bw*.86,lh=uh*.4;this._lunette(u,X+bw/2,lh+uh*.02,lw,lh,img);
    this._window(u,X+bw/2,uh*.3,bw*.3,uh*.62,P.window);
    const pw=bw*.15,ph=pw*740/430,pp=[P.pope1,P.pope2,P.pope3];this._niche(u,X+bw*.165,uh*.45,pw,ph,pp[(2*k)%3]);this._niche(u,X+bw*.835,uh*.45,pw,ph,pp[(2*k+1)%3]);
    u.fillStyle='#8c7550';u.fillRect(X,uh-8,bw,8)}
  _middle(f,X,bw,fh,im,ky=1){ // fresco tier ground: warm plaster; real gilded pilasters between the frescoes (ky = px per m vertically / horizontally)
    f.fillStyle='#b59c72';f.fillRect(X,0,bw,fh);
    if(im){const pw=bw*.7/6.8,y0=(8.9-8.05)*bw/6.8*ky,h=4.1*bw/6.8*ky;f.save();f.beginPath();f.rect(X,0,bw,fh);f.clip();this._pilaster(f,X-pw/2,y0,pw,h,im);this._pilaster(f,X+bw-pw/2,y0,pw,h,im);f.restore()}}
  _marble(N=256){const [c,x]=cv(N,N);x.fillStyle='#ece5d6';x.fillRect(0,0,N,N);seed=5;x.strokeStyle='rgba(120,110,95,.35)';
    for(let i=0;i<26;i++){x.lineWidth=.5+rnd()*1.5;x.beginPath();let a=rnd()*N,b=rnd()*N;x.moveTo(a,b);for(let k=0;k<6;k++){a+=(rnd()-.5)*N*.3;b+=(rnd()-.3)*N*.2;x.lineTo(a,b)}x.stroke()}return c}
  _img(name,fn,err){const im=new Image();im.onload=()=>fn(im);im.onerror=()=>{console.warn('Sistine: could not load',name);if(err)err()};im.src=`assets/sistine/${name}.jpg?v=22`}
  // ---------- side walls: drapery, fresco tier, popes & windows tier ----------
  _walls(){
    const px=150,bw=Math.round(6.8*px);
    const dt=this.photo('drape',6,1); // one real drapery bay (photo) per fresco bay
    const fh=Math.round(4.4*px),[fc,f]=cv(bw,fh),ky=4.4/5.3;this._middle(f,0,bw,fh,null,ky);const ft=this.tex(fc,6,1);
    const uh=Math.round((SPRING-m(8.9))/S*px),[uc,u]=cv(bw*2,uh);
    const drawU=(P)=>{this._upper(u,0,bw,uh,P.lunette1,0,P);this._upper(u,bw,bw,uh,P.lunette2,1,P)};drawU({});
    const ut=this.tex(uc,3,1);
    this.imgs(['lunette1','lunette2','window','pope1','pope2','pope3','pilaster','entrance-tier','dado','arch-entrance','arch-altar'],P=>{drawU(P);ut.needsUpdate=true;this._middle(f,0,bw,fh,P.pilaster,ky);ft.needsUpdate=true;if(this.entU)this.entU(P);if(this.altU)this.altU(P)});
    this.frescoMats=[];this.arts=[];
    const wall=new THREE.MeshStandardMaterial({color:0xcdb88e,roughness:.85});
    this.friezeMat=basic({map:this.photo('frieze',ROOM.L/(5.5*S),1)}); // real gilt/green palmette frieze under the frescoes
    const rail=this._railTex();
    for(const side of [-1,1]){
      const rot=side<0?Math.PI/2:-Math.PI/2,x=side*HW;
      const plane=(h0,h1,map)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.L,h1-h0),basic({map}));p.rotation.y=rot;p.position.set(x,(h0+h1)/2,0);this.g.add(p)};
      plane(m(0),m(3.6),dt);plane(m(3.6),m(8.9),ft);plane(m(8.9),SPRING,ut); // continuous behind the cornices: no gaps
      const glow=new THREE.Mesh(new THREE.BoxGeometry(.08,.05*S,ROOM.L),basic({color:0xfff0c8}));glow.position.set(x-side*.42,m(3.55),0);this.g.add(glow); // warm strip light under the cornice
      for(const [h0,h1,dep] of [[3.6,4.0,.5],[8.4,8.9,1.1]]){const mt=h0<4?(()=>{const a=[wall,wall,wall,wall,wall,wall];a[side>0?1:0]=this.friezeMat;return a})():wall;const b=new THREE.Mesh(new THREE.BoxGeometry(dep,(h1-h0)*S,ROOM.L),mt);b.position.set(x-side*dep/2,m((h0+h1)/2),0);this.g.add(b)}
      const rl=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.L-2.2,.9*S),basic({map:rail(ROOM.L/(.9*S)),transparent:true,alphaTest:.4,side:THREE.DoubleSide}));rl.rotation.y=rot;rl.position.set(x-side*1.0,m(8.9)+.45*S,0);this.g.add(rl); // balcony railing
      (side>0?NORTH:SOUTH).forEach(([name,ar],i)=>{const z=-HL+(i+.5)*BAY;this._fresco(name,ar,x-side*.16,z,rot,5.5*S,side>0?-Math.PI/2:Math.PI/2,new THREE.Vector3(-side,0,0))});
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
  _entrance(dt,wall,rail){ // entrance wall: real drapery, carved door in a marble surround, two frescoes, and the real photographed window tier (popes, painted windows, lunettes)
    const px=this.cap>=4096?150:96,EW=Math.round(13.4*px),EH=Math.round(20.7*px),[c,x]=cv(EW,EH),Y=h=>EH-h*px,X=w=>EW/2+w*px;
    const drawAll=(P={})=>{x.fillStyle='#b9a07a';x.fillRect(0,0,EW,EH);
      x.save();x.translate(0,Y(8.9));this._middle(x,0,EW,5.3*px);x.restore();
      if(P.pilaster){const pw=.6*px,ph=2.95*px;for(const w of [-6.6,-1.55,1.55,6.6])this._pilaster(x,X(w)-pw/2,Y(7.5),pw,ph,P.pilaster)}
      const im=P['entrance-tier'];if(im){const h=EW*im.height/im.width,top=Y(8.9)-h; // photo spans 8.9 m up to ~16.7 m, wall to wall
        const [sc,sx]=cv(1,1);sx.drawImage(im,0,0,im.width,8,0,0,1,1);const d=sx.getImageData(0,0,1,1).data,col=`rgb(${d[0]},${d[1]},${d[2]})`;
        x.fillStyle=col;x.fillRect(0,0,EW,top+2);x.drawImage(im,0,top,EW,h);
        const za=P['arch-entrance'];if(za){const f=EW/2048,aw=EW,ah=1274*f,ay=top-980*f,[ac,ax]=cv(EW,Math.ceil(top+60*f)); // ceiling-composite entrance end (Zechariah, David & Goliath, Judith & Holofernes), registered to the tier photo (tier row 0 = crop row 980, col +64)
          ax.drawImage(za,-64*f,ay,aw,ah);ax.globalCompositeOperation='destination-in';const fg=ax.createLinearGradient(0,top+10*f,0,top+60*f);fg.addColorStop(0,'#000');fg.addColorStop(1,'rgba(0,0,0,0)');ax.fillStyle=fg;ax.fillRect(0,0,EW,ac.height);x.drawImage(ac,0,0)}
        const g=x.createLinearGradient(0,top,0,top+.5*px);g.addColorStop(0,col);g.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=g;x.fillRect(0,top,EW,.5*px)}};
    drawAll();
    const t=this.tex(c,1,1);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    this.entU=P=>{drawAll(P);t.needsUpdate=true};
    const ent=new THREE.Mesh(this._endGeo(),basic({map:t}));ent.rotation.y=Math.PI;ent.position.z=HL;this.g.add(ent);
    const ed=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W,3.6*S),basic({map:this.photo('drape',2,1)}));ed.rotation.y=Math.PI;ed.position.set(0,m(1.8),HL-.05);this.g.add(ed);
    // carved walnut double door in a marble surround with a pediment
    const [dc,d]=cv(1024,1536),DW=512,DH=768;d.scale(2,2);const mg=d.createLinearGradient(0,0,DW,0);mg.addColorStop(0,'#cfc6b4');mg.addColorStop(.5,'#f0e9da');mg.addColorStop(1,'#cfc6b4');d.fillStyle=mg;d.fillRect(0,0,DW,DH);
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
  _altarWall(){ // around the Last Judgement: the ceiling's Jonah end in the vault arch, ochre margins, damask dado with the two side doors
    const px=this.cap>=4096?150:96,EW=Math.round(13.4*px),EH=Math.round(20.7*px),[c,x]=cv(EW,EH),Y=h=>EH-h*px;
    x.fillStyle='#b99d6a';x.fillRect(0,0,EW,EH);
    x.fillRect(0,Y(16),.62*px,Y(0)-Y(16));x.fillRect(EW-.62*px,Y(16),.62*px,Y(0)-Y(16));
    const arch=im=>{const h=EW*im.height/im.width;x.drawImage(im,0,Y(15.38)-h,EW,h)}; // ceiling-composite altar end (Jonah, Brazen Serpent, Punishment of Haman) above the Last Judgement's lunettes, at the composite's own scale
    const t=this.tex(c,1,1);t.wrapS=t.wrapT=THREE.ClampToEdgeWrapping;
    this.altU=P=>{if(P['arch-altar'])arch(P['arch-altar']);if(P.dado)x.drawImage(P.dado,0,Y(2.05),EW,2.05*px);t.needsUpdate=true}; // real dado: painted marble panels, roundels and the two side doors
    const alt=new THREE.Mesh(this._endGeo(),basic({map:t}));alt.position.z=-HL;this.g.add(alt)}
  _beams(){ // soft shafts of warm daylight slanting from the south windows
    const [c,x]=cv(64,256);const g=x.createLinearGradient(0,0,0,256);g.addColorStop(0,'rgba(255,240,205,0)');g.addColorStop(.15,'rgba(255,240,205,1)');g.addColorStop(1,'rgba(255,240,205,0)');x.fillStyle=g;x.fillRect(0,0,64,256);
    x.globalCompositeOperation='destination-in';const h=x.createLinearGradient(0,0,64,0);h.addColorStop(0,'rgba(0,0,0,0)');h.addColorStop(.5,'rgba(0,0,0,1)');h.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=h;x.fillRect(0,0,64,256);
    const mat=basic({map:new THREE.CanvasTexture(c),transparent:true,opacity:.10,depthWrite:false,blending:THREE.AdditiveBlending,side:THREE.DoubleSide});
    const Yv=new THREE.Vector3(0,1,0);
    for(let i=0;i<6;i++){const z=-HL+(i+.5)*BAY,a=new THREE.Vector3(-HW+.3,m(12.3),z),b=new THREE.Vector3(HW*.25,y0,z+2.5*S),d=b.clone().sub(a),L=d.length();d.normalize();
      for(const r of [0,Math.PI/2]){const geo=new THREE.PlaneGeometry(2.2*S,L).rotateY(r);const ms=new THREE.Mesh(geo,mat);ms.quaternion.setFromUnitVectors(Yv,d.clone().negate());ms.position.copy(a).addScaledVector(d,L/2);ms.renderOrder=5;this.g.add(ms)}}}
  _vault(){ // barrel vault with curved ends; the whole ceiling composite maps once in plan, and inside each cove u follows the curve's length so the end figures are not stretched
    const n=64,k=24,pos=[],uv=[],idx=[],zs=[];
    for(let j=0;j<=k;j++)zs.push(-HL+COVE_A*j/k);for(let j=0;j<=k;j++)zs.push(HL-COVE_E+COVE_E*j/k);
    const cols=zs.length,uz=z=>.5-z/ROOM.L;
    for(let i=0;i<=n;i++){const a=-VA+2*VA*i/n,x=VR*Math.sin(a),ys=zs.map(z=>ceilingAt(x,z));
      const arc=(j0,j1)=>{const d=[0];for(let j=j0+1;j<=j1;j++)d.push(d[d.length-1]+Math.hypot(zs[j]-zs[j-1],ys[j]-ys[j-1]));return d};
      const dA=arc(0,k),dE=arc(k+1,2*k+1);
      for(let j=0;j<cols;j++){let u;
        if(j<=k){const f=dA[j]/dA[k];u=uz(-HL)+(uz(-HL+COVE_A)-uz(-HL))*f}
        else{const f=dE[j-k-1]/dE[k];u=uz(HL-COVE_E)+(uz(HL)-uz(HL-COVE_E))*f}
        pos.push(x,ys[j],zs[j]);uv.push(u,.5+x/ROOM.W)}}
    for(let i=0;i<n;i++)for(let j=0;j<cols-1;j++){const a=i*cols+j,b=a+cols;idx.push(a,b,a+1,a+1,b,b+1)}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);
    this.ceilMat=basic({color:0xb8ab92,side:THREE.DoubleSide});
    this.g.add(new THREE.Mesh(g,this.ceilMat));
  }
  _altar(){ // the altar against the Last Judgement wall with its bronze crucifix and six candlesticks (as photographed in the chapel)
    const z=-HL,marble=new THREE.MeshStandardMaterial({color:0xe6dccb,roughness:.5});
    const gold=new THREE.MeshStandardMaterial({color:0xd4a64a,metalness:1,roughness:.3,envMap:this.scene.environment});
    const ebony=new THREE.MeshStandardMaterial({color:0x14110f,roughness:.35,metalness:.2,envMap:this.scene.environment});
    const bronze=new THREE.MeshStandardMaterial({color:0x5a4228,metalness:.85,roughness:.38,envMap:this.scene.environment});
    const add=(geo,mat,x,y,zz)=>{const o=new THREE.Mesh(geo,mat);o.position.set(x,y,zz);this.g.add(o);return o};
    add(new THREE.BoxGeometry(8*S,.5*S,4.9*S-.4),new THREE.MeshStandardMaterial({color:0xb7ab98,roughness:.6}),0,m(.25),z+(4.9*S-.4)/2); // predella, back to the wall
    const az=z+.75*S;add(new THREE.BoxGeometry(4.6*S,1*S,1.2*S),marble,0,m(1),az);
    add(new THREE.PlaneGeometry(4.2*S,.7*S),basic({color:0x7a2b24}),0,m(1),az+.6*S+.02);
    add(new THREE.BoxGeometry(4.7*S,.06*S,1.28*S),marble,0,m(1.53),az);
    const top=m(1.56),cz=z+.32*S;
    // the cross: ebony with gilded edging, crossbar centre 3.61 m above the floor
    add(new THREE.BoxGeometry(.7*S,.16*S,.5*S),ebony,0,top+.08*S,cz);add(new THREE.BoxGeometry(.5*S,.14*S,.36*S),ebony,0,top+.23*S,cz);
    add(new THREE.BoxGeometry(.72*S,.02*S,.52*S),gold,0,top+.165*S,cz);
    const post=4.05-1.56,bar=1.59,ty=m(3.61),T=.2*S,D=.12*S;
    add(new THREE.BoxGeometry(T,post*S,D),ebony,0,top+post*S/2,cz);add(new THREE.BoxGeometry(bar*S,T,D),ebony,0,ty,cz);
    const fz=cz+D/2+.004,e=.022*S;
    for(const sx of [-1,1]){add(new THREE.BoxGeometry(e,post*S,.01),gold,sx*(T/2-e/2),top+post*S/2,fz);add(new THREE.BoxGeometry(bar*S,e,.01),gold,0,ty+sx*(T/2-e/2),fz+.002)}
    add(new THREE.BoxGeometry(T*1.1,.05*S,D*1.1),gold,0,top+post*S,cz);for(const sx of [-1,1])add(new THREE.BoxGeometry(.05*S,T*1.1,D*1.1),gold,sx*bar*S/2,ty,cz);
    add(new THREE.BoxGeometry(.3*S,.04*S,.16*S),gold,0,m(1.93),cz+D/2+.04*S); // suppedaneum under the feet
    add(new THREE.BoxGeometry(.32*S,.12*S,.02*S),gold,0,ty+.42*S,fz+.01); // titulus INRI
    // the corpus (bronze, full length, cut out on transparent background)
    const ct=this.loader.load('assets/sistine/corpus.png?v=23');ct.colorSpace=THREE.SRGBColorSpace;ct.anisotropy=this.aniso;
    const cw=1.5*S,ch=cw*984/819;
    const corpus=add(new THREE.PlaneGeometry(cw,ch),new THREE.MeshBasicMaterial({map:ct,transparent:true,alphaTest:.4,toneMapped:false,color:0xd8d0c4,side:THREE.DoubleSide}),0,m(3.72)-ch/2,fz+.05*S);
    corpus.renderOrder=2;
    // six tall bronze candlesticks with white candles (tops ~3.1 m)
    const flame=basic({color:0xffd9a0}),wax=basic({color:0xf3eadb});
    const base=new THREE.CylinderGeometry(.06*S,.17*S,.14*S,16),shaft=new THREE.CylinderGeometry(.035*S,.05*S,.8*S,12),knop=new THREE.SphereGeometry(.075*S,14,10),pan=new THREE.CylinderGeometry(.1*S,.05*S,.06*S,16);
    const cg=new THREE.CylinderGeometry(.04*S,.04*S,.42*S,10),fg=new THREE.SphereGeometry(.032*S,8,6);
    for(const xm of [-2.0,-1.45,-.9,.9,1.45,2.0]){const x=xm*S,zz=az+.1*S;
      add(base,bronze,x,top+.07*S,zz);add(shaft,bronze,x,top+.54*S,zz);const k=add(knop,bronze,x,top+.5*S,zz);k.scale.y=.8;
      add(pan,bronze,x,top+.97*S,zz);add(cg,wax,x,top+1.21*S,zz);const f=add(fg,flame,x,top+1.47*S,zz);f.scale.y=1.8}
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
    this.loader.load(`assets/sistine/hd/${name}.jpg?v=22`,t=>{const mat=this.mats&&this.mats[name];if(!L.includes(name)||!mat){t.dispose();return}
      this.fit(t);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
      T[name]=t;mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true},undefined,e=>{console.warn('Sistine: hi-res failed, keeping low-res',name,e);const k=L.indexOf(name);if(k>=0)L.splice(k,1)})} // low-res stays on until hi-res succeeds
  _dropHD(name){const t=this.hdTex[name];if(!t)return;const mat=this.mats[name];if(mat&&mat.userData.base){mat.map=mat.userData.base;mat.needsUpdate=true}t.dispose();delete this.hdTex[name]}
  loadCeiling(){return this.load(this.bigCeil?'ceiling-3129':'ceiling-2048',this.ceilMat)}
  loadArt(){return Promise.all([this.load('judgement',this.ljMat),...this.frescoMats.map(([n,mt])=>this.load(n,mt))])}
}
