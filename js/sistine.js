// The Sistine Chapel built as real geometry around the board (real proportions: 40.9 x 13.4 x 20.7 m),
// textured with public-domain fresco scans from Wikimedia Commons (see ASSETS.md / Image credits).
import * as THREE from 'three';
import { FLOOR } from './basilica.js?v=14';

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
  load(name,mat,retry=1){return new Promise(res=>this.loader.load(`assets/sistine/${name}.jpg?v=14`,t=>{
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
    if(!rough){x.globalAlpha=.07;x.fillStyle='#fff6e6';x.fillRect(0,0,N,N);x.globalAlpha=1} // soft contrast
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
  // ---------- side walls: drapery, fresco tier, popes & windows tier ----------
  _walls(){
    const px=150,bw=Math.round(6.8*px);
    // lower tier: painted gold-and-cream drapery curtains, trompe-l'oeil folds (one bay per repeat)
    const dh=Math.round(3.6*px),[dc,d]=cv(1024,dh);
    for(let i=0;i<1024;i++){const ph=i/1024*2*Math.PI*22,s=.80+.12*Math.sin(ph)+.05*Math.sin(ph*2.3+1)+.02*Math.sin(i*.37);
      const r=[232,208,156];d.fillStyle=`rgb(${r.map(v=>Math.round(v*s)).join()})`;d.fillRect(i,0,1,dh)}
    {const gl=d.createLinearGradient(0,0,0,dh);gl.addColorStop(0,'rgba(255,236,190,.35)');gl.addColorStop(.45,'rgba(255,236,190,0)');gl.addColorStop(1,'rgba(60,40,20,.18)');d.fillStyle=gl;d.fillRect(0,0,1024,dh)} // warm light from the cornice
    d.fillStyle='#a8803c';d.fillRect(0,0,1024,26);for(let i=0;i<1024;i+=64){d.beginPath();d.arc(i+32,26,32,0,Math.PI);d.fill()}
    d.fillStyle='#c09a4a';for(let i=0;i<1024;i+=6)d.fillRect(i,dh-34,3,30);d.fillStyle='#5a4a36';d.fillRect(0,dh-6,1024,6);
    const dt=this.tex(dc,6,1);
    // middle tier: plaster with painted pilasters at the bay edges
    const fh=Math.round(4.4*px),[fc,f]=cv(bw,fh);f.fillStyle='#cbbd9f';f.fillRect(0,0,bw,fh);
    for(const x0 of [0,bw-48]){f.fillStyle='#d9cdb4';f.fillRect(x0,0,48,fh);f.fillStyle='rgba(120,95,55,.35)';for(let k=8;k<48;k+=10)f.fillRect(x0+k,30,3,fh-60);f.fillStyle='#b08f55';f.fillRect(x0,0,48,26);f.fillRect(x0,fh-26,48,26)} // painted pilasters between the panels
    const ft=this.tex(fc,6,1);
    // upper tier: arched window per bay flanked by painted niches (the popes' niches)
    const uh=Math.round((SPRING-m(8.9))/S*px),[uc,u]=cv(bw,uh);u.fillStyle='#d2c4a6';u.fillRect(0,0,bw,uh);
    const arch=(cx,top,w,h)=>{u.beginPath();u.moveTo(cx-w/2,top+h);u.lineTo(cx-w/2,top+w/2);u.arc(cx,top+w/2,w/2,Math.PI,0);u.lineTo(cx+w/2,top+h);u.closePath()};
    for(const nx of [bw*.17,bw*.83]){arch(nx,uh*.24,120,uh*.6);const gg=u.createLinearGradient(nx-60,0,nx+60,0);gg.addColorStop(0,'#6f5a3e');gg.addColorStop(.5,'#9b8158');gg.addColorStop(1,'#6f5a3e');u.fillStyle=gg;u.fill();u.strokeStyle='#b89a5c';u.lineWidth=6;u.stroke()}
    const ww=2.5*px,wt=Math.round(.25*px),wh=Math.round(4.0*px);
    arch(bw/2,wt-14,ww+28,wh+14);u.fillStyle='#a89272';u.fill();
    arch(bw/2,wt,ww,wh);const wg=u.createLinearGradient(0,wt,0,wt+wh);wg.addColorStop(0,'#f6efe0');wg.addColorStop(1,'#e6dcc6');u.fillStyle=wg;u.fill();
    u.save();u.clip();u.strokeStyle='rgba(120,105,80,.22)';u.lineWidth=2;for(let k=-20;k<20;k++){u.beginPath();u.moveTo(bw/2+k*26,wt);u.lineTo(bw/2+k*26+wh,wt+wh);u.stroke();u.beginPath();u.moveTo(bw/2+k*26,wt);u.lineTo(bw/2+k*26-wh,wt+wh);u.stroke()}u.restore();
    u.fillStyle='#b8a27a';u.fillRect(0,uh-10,bw,10);
    const ut=this.tex(uc,6,1);
    this.frescoMats=[];this.arts=[];
    for(const side of [-1,1]){
      const rot=side<0?Math.PI/2:-Math.PI/2,x=side*HW;
      const plane=(h0,h1,map)=>{const p=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.L,h1-h0),basic({map}));p.rotation.y=rot;p.position.set(x,(h0+h1)/2,0);this.g.add(p)};
      plane(m(0),m(3.6),dt);plane(m(4.0),m(8.4),ft);plane(m(8.9),SPRING,ut);
      const glow=new THREE.Mesh(new THREE.BoxGeometry(.08,.05*S,ROOM.L),basic({color:0xfff0c8}));glow.position.set(x-side*.42,m(3.55),0);this.g.add(glow); // warm strip light under the cornice
      for(const [h0,h1,dep] of [[3.6,4.0,.5],[8.4,8.9,1.1]]){const b=new THREE.Mesh(new THREE.BoxGeometry(dep,(h1-h0)*S,ROOM.L),new THREE.MeshStandardMaterial({color:0xcdb88e,roughness:.85}));b.position.set(x-side*dep/2,m((h0+h1)/2),0);this.g.add(b)}
      // the frescoes, in painted gilt frames
      (side>0?NORTH:SOUTH).forEach(([name,ar],i)=>{
        const z=-HL+(i+.5)*BAY,w=5.7*S,h=w/ar,cy=m(6.0); // large panels in a continuous row above the drapery, as in the chapel
        // frame as non-overlapping strips (gold inner, bronze outer) in the fresco's own plane: nothing to z-fight with on low-precision mobile depth buffers
        for(const [a,b2,col] of [[0,.32,0xc9a85a],[.32,.7,0x7a5e2c]]){const mt=basic({color:col,side:THREE.DoubleSide}),t=b2-a;
          for(const [W,H,dz,dy] of [[w+2*b2,t,0,h/2+a+t/2],[w+2*b2,t,0,-h/2-a-t/2],[t,h+2*a,w/2+a+t/2,0],[t,h+2*a,-w/2-a-t/2,0]]){
            const fr=new THREE.Mesh(new THREE.PlaneGeometry(W,H),mt);fr.rotation.y=rot;fr.position.set(x-side*.16,cy+dy,z+dz);this.g.add(fr)}}
        const mat=basic({color:0x8a7a62,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});const fm=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);fm.rotation.y=rot;fm.position.set(x-side*.16,cy,z);fm.renderOrder=2;this.g.add(fm);
        this.frescoMats.push([name,mat]);
        this.arts.push({id:name,name:TITLES[name],c:new THREE.Vector3(x-side*.16,cy,z),n:new THREE.Vector3(-side,0,0),w,h,yaw:side>0?-Math.PI/2:Math.PI/2,pitch:0});
      });
    }
    // end walls (rectangle + vault arc)
    const shp=new THREE.Shape();shp.moveTo(-HW,y0);shp.lineTo(HW,y0);shp.lineTo(HW,SPRING);shp.absarc(0,VYC,VR,Math.PI/2-VA,Math.PI/2+VA,false);shp.lineTo(-HW,y0);
    const eg=new THREE.ShapeGeometry(shp,24);
    const alt=new THREE.Mesh(eg,basic({color:0xc9bb9e}));alt.position.z=-HL;this.g.add(alt);
    const ent=new THREE.Mesh(eg,basic({color:0xc9bb9e}));ent.rotation.y=Math.PI;ent.position.z=HL;this.g.add(ent);
    const ed=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W,3.6*S),basic({map:(()=>{const t=dt.clone();t.repeat.set(2,1);t.needsUpdate=true;return t})()}));ed.rotation.y=Math.PI;ed.position.set(0,m(1.8),HL-.05);this.g.add(ed);
    const door=new THREE.Mesh(new THREE.PlaneGeometry(3*S,5*S),basic({color:0x4a3322}));door.rotation.y=Math.PI;door.position.set(0,m(2.5),HL-.1);this.g.add(door);
    // The Last Judgement (13.7 x 12 m) on the altar wall
    const lw=12.2*S,lh=lw*3072/2789; // the whole altar wall (12.2 x 13.4 m), bottom ~2 m above the floor behind the altar
    this.ljMat=basic({color:0x8a7a62});
    const lj=new THREE.Mesh(new THREE.PlaneGeometry(lw,lh),this.ljMat);lj.position.set(0,m(2.0)+lh/2,-HL+.06);this.g.add(lj);
    this.lj={c:lj.position.clone(),w:lw,h:lh};
  }
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
  _transenna(){ // marble screen with gilded grille, and the cantoria (choir loft) on the right wall
    const z=HL-14.5*S,marble=new THREE.MeshStandardMaterial({color:0xe9e0cf,roughness:.55});
    for(const sx of [-1,1]){const w=HW-1.6*S;const b=new THREE.Mesh(new THREE.BoxGeometry(w,1.4*S,.45*S),marble);b.position.set(sx*(1.6*S+w/2),m(.7),z);this.g.add(b);
      const [c,x]=cv(512,128);x.clearRect(0,0,512,128);x.strokeStyle='#c8a050';x.lineWidth=5;for(let i=8;i<512;i+=22){x.beginPath();x.moveTo(i,0);x.lineTo(i,128);x.stroke()}x.lineWidth=8;x.strokeRect(4,4,504,120);for(let i=0;i<512;i+=64){x.beginPath();x.arc(i+32,64,22,0,7);x.stroke()}
      const t=this.tex(c,1,1);const gr=new THREE.Mesh(new THREE.PlaneGeometry(w,2.2*S),basic({map:t,transparent:true,alphaTest:.3,side:THREE.DoubleSide}));gr.position.set(sx*(1.6*S+w/2),m(2.5),z);this.g.add(gr);
      const cap=new THREE.Mesh(new THREE.BoxGeometry(w,.12*S,.3*S),marble);cap.position.set(sx*(1.6*S+w/2),m(3.65),z);this.g.add(cap);
      for(let k=0;k<3;k++){const cd=new THREE.Mesh(new THREE.CylinderGeometry(.06*S,.12*S,.6*S,8),marble);cd.position.set(sx*(2.2*S+k*(w-1.2*S)/2),m(4.0),z);this.g.add(cd)}}
    const loft=new THREE.Mesh(new THREE.BoxGeometry(1.2*S,1.3*S,3.4*S),marble);loft.position.set(HW-.6*S,m(3.0),z+4*S);this.g.add(loft);
    const lf=new THREE.Mesh(new THREE.PlaneGeometry(3.2*S,.9*S),basic({color:0xc9a85a}));lf.rotation.y=-Math.PI/2;lf.position.set(HW-1.21*S,m(3.0),z+4*S);this.g.add(lf);
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
    this.loader.load(`assets/sistine/hd/${name}.jpg?v=14`,t=>{const mat=this.mats&&this.mats[name];if(!L.includes(name)||!mat){t.dispose();return}
      this.fit(t);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
      T[name]=t;mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true},undefined,e=>{console.warn('Sistine: hi-res failed, keeping low-res',name,e);const k=L.indexOf(name);if(k>=0)L.splice(k,1)})} // low-res stays on until hi-res succeeds
  _dropHD(name){const t=this.hdTex[name];if(!t)return;const mat=this.mats[name];if(mat&&mat.userData.base){mat.map=mat.userData.base;mat.needsUpdate=true}t.dispose();delete this.hdTex[name]}
  loadCeiling(){return this.load(this.bigCeil?'ceiling-3129':'ceiling-2048',this.ceilMat)}
  loadArt(){return Promise.all([this.load('judgement',this.ljMat),...this.frescoMats.map(([n,mt])=>this.load(n,mt))])}
}
