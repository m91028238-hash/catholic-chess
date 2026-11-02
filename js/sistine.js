// The Sistine Chapel built as real geometry around the board (real proportions: 40.9 x 13.4 x 20.7 m),
// textured with public-domain fresco scans from Wikimedia Commons (see ASSETS.md / Image credits).
import * as THREE from 'three';
import { FLOOR } from './basilica.js?v=12';

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
    this.big=renderer.capabilities.maxTextureSize>=8192&&!/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);this.bigCeil=renderer.capabilities.maxTextureSize>=4096;
    this.loader=new THREE.TextureLoader();
    const g=this.g=new THREE.Group();scene.add(g);
    this._floor();this._walls();this._vault();this._altar();this._transenna();
  }
  tex(c,rx=1,ry=1){const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.anisotropy=this.aniso;return t}
  load(name,mat){return new Promise(res=>this.loader.load(`assets/sistine/${name}.jpg?v=12`,t=>{
    t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
    mat.userData.base=t;(this.mats||(this.mats={}))[name]=mat;if(!(this.hdTex&&this.hdTex[name]))mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true;res(t)},undefined,()=>{console.warn('art',name);res(null)}))}
  // ---------- floor: the chapel's Cosmatesque opus alexandrinum pavement (one panel = the chapel's width) ----------
  // procedural: white marble bands interlacing porphyry and serpentine rotae (a quincunx), guilloche chains of
  // small roundels, and fields of tiny tesserae; drawn twice: colour, then a matching roughness map
  _floorCanvas(N,rough){
    const [c,x]=cv(N,N),u=N/13.4,R=()=>rnd();seed=11;
    const G=rough?{white:'#5c5c5c',red:'#4a4a4a',green:'#4e4e4e',gold:'#6a6a6a',cream:'#626262',grout:'#c8c8c8',dark:'#555'}
      :{white:'#ebe4d6',red:'#9b4d43',green:'#557a66',gold:'#c4a468',cream:'#ddd2bd',grout:'#a59985',dark:'#5a2320'};
    x.fillStyle=G.grout;x.fillRect(0,0,N,N);
    const tess=(path,s,pat)=>{x.save();path();x.clip();const g=Math.max(1,s*.09);
      for(let j=-1;j*s<N;j++)for(let i=-1;i*s<N;i++){const X=i*s,Y=j*s,k=pat(i,j);
        if(k[0]==='tri'){x.fillStyle=k[1];x.beginPath();x.moveTo(X+g,Y+s-g);x.lineTo(X+s/2,Y+g);x.lineTo(X+s-g,Y+s-g);x.fill();x.fillStyle=k[2];x.beginPath();x.moveTo(X+s/2+g,Y+g);x.lineTo(X+s+s/2-g,Y+g);x.lineTo(X+s-g*.2,Y+s-g);x.fill()}
        else{x.fillStyle=k[1];x.fillRect(X+g/2,Y+g/2,s-g,s-g)}}x.restore()};
    const marble=(path,col,veinA)=>{x.save();path();x.clip();x.fillStyle=col;x.fillRect(0,0,N,N);if(!rough){x.globalAlpha=veinA;x.strokeStyle='#8a7d6a';
      for(let i=0;i<90;i++){x.lineWidth=.4+R()*1.2*N/2048;x.beginPath();let a=R()*N,b=R()*N;x.moveTo(a,b);for(let k=0;k<5;k++){a+=(R()-.5)*N*.08;b+=(R()-.5)*N*.08;x.lineTo(a,b)}x.stroke()}x.globalAlpha=1}x.restore()};
    const stone=(cx,cy,r,col,spot)=>{x.fillStyle=col;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();if(rough)return; // porphyry/serpentine: mottled
      x.save();x.beginPath();x.arc(cx,cy,r,0,7);x.clip();for(let i=0;i<r*r/30;i++){x.fillStyle=spot;x.globalAlpha=.12+R()*.25;x.beginPath();x.arc(cx+(R()-.5)*2*r,cy+(R()-.5)*2*r,.6+R()*2*N/2048,0,7);x.fill()}
      const gr=x.createRadialGradient(cx-r*.3,cy-r*.3,r*.1,cx,cy,r);gr.addColorStop(0,'rgba(255,255,255,.10)');gr.addColorStop(1,'rgba(0,0,0,.12)');x.globalAlpha=1;x.fillStyle=gr;x.fillRect(cx-r,cy-r,2*r,2*r);x.restore()};
    const band=(draw,w)=>{x.lineWidth=w+3*N/2048;x.strokeStyle=G.grout;draw();x.stroke();x.lineWidth=w;x.strokeStyle=G.white;draw();x.stroke()};
    const ts=.045*u,triP=(a,b)=>(i,j)=>['tri',(i+j)%2?a:b,G.white],chk=(a,b)=>(i,j)=>['sq',(i+j)%2?a:b];
    const bw=.2*u; // white band width
    // background field of tiny red/green squares
    marble(()=>{x.beginPath();x.rect(0,0,N,N)},G.cream,.14); // field: cream marble slabs
    x.strokeStyle=G.grout;x.lineWidth=Math.max(1,N/1400);for(let k=1;k<6;k++){x.beginPath();x.moveTo(k*N/6,0);x.lineTo(k*N/6,N);x.moveTo(0,k*N/6);x.lineTo(N,k*N/6);x.stroke()}
    // outer frame: white band, triangle mosaic strip, white band
    const B=.75*u;
    marble(()=>{x.beginPath();x.rect(0,0,N,N);x.rect(B,N-B,N-2*B,-(N-2*B))},G.white,.18);
    tess(()=>{x.beginPath();x.rect(bw,bw,N-2*bw,B-2*bw);x.rect(bw,N-B+bw,N-2*bw,B-2*bw);x.rect(bw,B-bw,B-2*bw,N-2*B+2*bw);x.rect(N-B+bw,B-bw,B-2*bw,N-2*B+2*bw)},ts*1.1,triP(G.red,G.green));
    // central quincunx
    const C=N/2,RQ=3.1*u,Rc=1.55*u,rs=.85*u,off=2.45*u;
    x.save();x.beginPath();x.rect(C-RQ,C-RQ,2*RQ,2*RQ);x.clip();tess(()=>{x.beginPath();x.rect(C-RQ,C-RQ,2*RQ,2*RQ)},ts*1.25,triP(G.gold,G.red));x.restore();
    const sats=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,b])=>[C+a*off,C+b*off]);
    // guilloche ring linking the satellites around the central rota
    band(()=>{x.beginPath();x.arc(C,C,off*Math.SQRT2*.5+Rc*.55,0,7)},bw*.8);
    for(const [sx,sy] of sats){tess(()=>{x.beginPath();x.arc(sx,sy,rs+bw*1.6,0,7)},ts*.9,chk(G.green,G.white));band(()=>{x.beginPath();x.arc(sx,sy,rs+bw*1.6,0,7)},bw*.7);
      x.fillStyle=G.white;x.beginPath();x.arc(sx,sy,rs+bw*.5,0,7);x.fill();stone(sx,sy,rs,G.green,'#9fc4a8')}
    tess(()=>{x.beginPath();x.arc(C,C,Rc+bw*2.6,0,7)},ts,triP(G.red,G.green));band(()=>{x.beginPath();x.arc(C,C,Rc+bw*2.6,0,7)},bw);
    x.fillStyle=G.white;x.beginPath();x.arc(C,C,Rc+bw*.7,0,7);x.fill();stone(C,C,Rc,G.red,'#e0a090');
    band(()=>{x.beginPath();x.rect(C-RQ,C-RQ,2*RQ,2*RQ)},bw);
    // guilloche chains of small rotae on each side of the quincunx (two white bands weaving between the circles)
    const chain=(vert,pos)=>{const n=6,len=N-2*B-1.0*u,r=.42*u,st=len/n;
      const P=k=>{const t=B+.5*u+st*(k+.5);return vert?[pos,t]:[t,pos]};
      tess(()=>{x.beginPath();for(let k=0;k<n;k++){const [a,b]=P(k);x.moveTo(a+r+bw*1.4,b);x.arc(a,b,r+bw*1.4,0,7)}},ts*.9,triP(G.green,G.gold));
      for(const sg of [1,-1])band(()=>{x.beginPath();for(let s=0;s<=60*n;s++){const t=s/(60*n)*n-.5,w=Math.cos(t*Math.PI)*(r+bw*1.4)*sg,L=B+.5*u+st*(t+.5);
        const [a,b]=vert?[pos+w,L]:[L,pos+w];s?x.lineTo(a,b):x.moveTo(a,b)}},bw*.7);
      for(let k=0;k<n;k++){const [a,b]=P(k);x.fillStyle=G.white;x.beginPath();x.arc(a,b,r+bw*.4,0,7);x.fill();stone(a,b,r,k%2?G.red:G.green,k%2?'#e0a090':'#9fc4a8')}};
    const side=(B+C-RQ)/2;chain(true,side);chain(true,N-side);chain(false,side);chain(false,N-side);
    // corner rotae
    for(const [a,b] of [[side,side],[N-side,side],[side,N-side],[N-side,N-side]]){x.fillStyle=G.white;x.beginPath();x.arc(a,b,.62*u,0,7);x.fill();stone(a,b,.5*u,G.red,'#e0a090')}
    if(!rough){x.globalAlpha=.06;x.fillStyle='#fff8e8';x.fillRect(0,0,N,N);x.globalAlpha=1} // soft contrast
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
    // lower tier: painted silver-and-gold drapery (one bay per repeat)
    const dh=Math.round(4.6*px),[dc,d]=cv(1024,dh);
    for(let i=0;i<1024;i++){const s=.80+.13*Math.sin(i/1024*2*Math.PI*14)+.04*Math.sin(i*.37);const gold=(Math.floor(i/1024*14+.5)%2)===0;
      const r=gold?[226,204,150]:[214,212,204];d.fillStyle=`rgb(${r.map(v=>Math.round(v*s)).join()})`;d.fillRect(i,0,1,dh)}
    d.fillStyle='rgba(170,130,60,.35)';for(let yy=90;yy<dh-60;yy+=46)for(let xx=(yy/46%2)*23;xx<1024;xx+=46){d.beginPath();d.moveTo(xx,yy-9);d.lineTo(xx+6,yy);d.lineTo(xx,yy+9);d.lineTo(xx-6,yy);d.fill()}
    d.fillStyle='#a8803c';d.fillRect(0,0,1024,26);for(let i=0;i<1024;i+=64){d.beginPath();d.arc(i+32,26,32,0,Math.PI);d.fill()}
    d.fillStyle='#c09a4a';for(let i=0;i<1024;i+=6)d.fillRect(i,dh-34,3,30);d.fillStyle='#5a4a36';d.fillRect(0,dh-6,1024,6);
    const dt=this.tex(dc,6,1);
    // middle tier: plaster with painted pilasters at the bay edges
    const fh=Math.round(5.4*px),[fc,f]=cv(bw,fh);f.fillStyle='#cbbd9f';f.fillRect(0,0,bw,fh);
    for(const x0 of [0,bw-46]){f.fillStyle='#b9a37a';f.fillRect(x0,0,46,fh);f.fillStyle='rgba(90,70,40,.35)';for(let k=8;k<46;k+=10)f.fillRect(x0+k,30,3,fh-60);f.fillStyle='#a88a52';f.fillRect(x0,0,46,26);f.fillRect(x0,fh-26,46,26)}
    const ft=this.tex(fc,6,1);
    // upper tier: arched window per bay flanked by painted niches (the popes' niches)
    const uh=Math.round((SPRING-m(10.9))/S*px),[uc,u]=cv(bw,uh);u.fillStyle='#d2c4a6';u.fillRect(0,0,bw,uh);
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
      plane(m(0),m(4.6),dt);plane(m(5.0),m(10.4),ft);plane(m(10.9),SPRING,ut);
      for(const [h0,h1,dep] of [[4.6,5.0,.5],[10.4,10.9,1.1]]){const b=new THREE.Mesh(new THREE.BoxGeometry(dep,(h1-h0)*S,ROOM.L),new THREE.MeshStandardMaterial({color:0xcdb88e,roughness:.85}));b.position.set(x-side*dep/2,m((h0+h1)/2),0);this.g.add(b)}
      // the frescoes, in painted gilt frames
      (side>0?NORTH:SOUTH).forEach(([name,ar],i)=>{
        const z=-HL+(i+.5)*BAY,h=2.1*S,w=h*ar,cy=m(2.0); // hung at eye level (centre ~2 m, bottom ~1 m)
        for(const [pad,col,off] of [[.7,0x7a5e2c,.03],[.32,0xc9a85a,.05]]){const fr=new THREE.Mesh(new THREE.PlaneGeometry(w+pad*2,h+pad*2),basic({color:col}));fr.rotation.y=rot;fr.position.set(x-side*off,cy,z);this.g.add(fr)}
        const mat=basic({color:0x8a7a62});const fm=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);fm.rotation.y=rot;fm.position.set(x-side*.08,cy,z);this.g.add(fm);
        this.frescoMats.push([name,mat]);
        this.arts.push({id:name,name:TITLES[name],c:new THREE.Vector3(x-side*.08,cy,z),n:new THREE.Vector3(-side,0,0),w,h,yaw:side>0?-Math.PI/2:Math.PI/2,pitch:0});
      });
    }
    // end walls (rectangle + vault arc)
    const shp=new THREE.Shape();shp.moveTo(-HW,y0);shp.lineTo(HW,y0);shp.lineTo(HW,SPRING);shp.absarc(0,VYC,VR,Math.PI/2-VA,Math.PI/2+VA,false);shp.lineTo(-HW,y0);
    const eg=new THREE.ShapeGeometry(shp,24);
    const alt=new THREE.Mesh(eg,basic({color:0xc9bb9e}));alt.position.z=-HL;this.g.add(alt);
    const ent=new THREE.Mesh(eg,basic({color:0xc9bb9e}));ent.rotation.y=Math.PI;ent.position.z=HL;this.g.add(ent);
    const ed=new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W,4.6*S),basic({map:(()=>{const t=dt.clone();t.repeat.set(2,1);t.needsUpdate=true;return t})()}));ed.rotation.y=Math.PI;ed.position.set(0,m(2.3),HL-.05);this.g.add(ed);
    const door=new THREE.Mesh(new THREE.PlaneGeometry(3*S,5*S),basic({color:0x4a3322}));door.rotation.y=Math.PI;door.position.set(0,m(2.5),HL-.1);this.g.add(door);
    // The Last Judgement (13.7 x 12 m) on the altar wall
    const lh=3.3*S,lw=lh*3840/4229; // scaled to hang at eye level (centre ~2.2 m) behind the free-standing altar
    this.ljMat=basic({color:0x8a7a62});
    const lj=new THREE.Mesh(new THREE.PlaneGeometry(lw,lh),this.ljMat);lj.position.set(0,m(.55)+lh/2,-HL+.06);this.g.add(lj);
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
    const z=-HL+10*S,marble=new THREE.MeshStandardMaterial({color:0xe6dccb,roughness:.5});
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
    const loft=new THREE.Mesh(new THREE.BoxGeometry(1.2*S,1.3*S,3.4*S),marble);loft.position.set(HW-.6*S,m(4.5),z+4*S);this.g.add(loft);
    const lf=new THREE.Mesh(new THREE.PlaneGeometry(3.2*S,.9*S),basic({color:0xc9a85a}));lf.rotation.y=-Math.PI/2;lf.position.set(HW-1.21*S,m(4.5),z+4*S);this.g.add(lf);
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
    this.loader.load(`assets/sistine/hd/${name}.jpg?v=12`,t=>{const mat=this.mats&&this.mats[name];if(!L.includes(name)||!mat){t.dispose();return}
      t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=this.aniso;t.generateMipmaps=true;t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
      T[name]=t;mat.map=t;mat.color.set(0xf2ede4);mat.needsUpdate=true},undefined,()=>{const k=L.indexOf(name);if(k>=0)L.splice(k,1)})}
  _dropHD(name){const t=this.hdTex[name];if(!t)return;const mat=this.mats[name];if(mat&&mat.userData.base){mat.map=mat.userData.base;mat.needsUpdate=true}t.dispose();delete this.hdTex[name]}
  loadCeiling(){return this.load(this.bigCeil?'ceiling-3129':'ceiling-2048',this.ceilMat)}
  loadArt(){return Promise.all([this.load('judgement',this.ljMat),...this.frescoMats.map(([n,mt])=>this.load(n,mt))])}
}
