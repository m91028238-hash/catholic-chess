// three.js scene: board, pieces, lights, camera, picking and animation.
import * as THREE from 'three';
import { OrbitControls, RoomEnvironment } from 'three';
import { BOARD, buildBoardTextures, woodCanvas, canvasTex, loadImage } from './textures.js?v=22';
import { pieceGeometries } from './pieces.js?v=22';
import { buildPlinth } from './basilica.js?v=22';
import { Sistine, ROOM, ceilingAt } from './sistine.js?v=25';
const CHAIR_Z=7.0; // chair centres, each side of the table (2.6 units per metre)

const TOP=0.32;
const FILES='abcdefgh';
export const sqPos=(sq)=>new THREE.Vector3(FILES.indexOf(sq[0])-3.5,TOP,4.5-(+sq[1]));
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const segBox=(a,b,x0,x1,z0,z1)=>{let t0=0,t1=1;const d=[b.x-a.x,b.z-a.z],o=[a.x,a.z],lo=[x0,z0],hi=[x1,z1];
  for(let i=0;i<2;i++){if(Math.abs(d[i])<1e-9){if(o[i]<lo[i]||o[i]>hi[i])return false;continue}
    let u=(lo[i]-o[i])/d[i],v=(hi[i]-o[i])/d[i];if(u>v)[u,v]=[v,u];t0=Math.max(t0,u);t1=Math.min(t1,v);if(t0>t1)return false}return true};

export class ChessScene{
  constructor(host,{onTap}){
    this.host=host;this.onTap=onTap;this.tweens=[];this.pieces=[];this.fast=false;
    const mobile=/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||Math.min(screen.width,screen.height)<700;
    this.mobile=mobile;
    const r=this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:true});
    r.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?2:2));
    r.shadowMap.enabled=true;r.shadowMap.type=THREE.PCFShadowMap;
    r.toneMapping=THREE.ACESFilmicToneMapping;r.toneMappingExposure=.92;r.outputColorSpace=THREE.SRGBColorSpace;
    host.appendChild(r.domElement);
    const sc=this.scene=new THREE.Scene();
    sc.background=new THREE.Color(0x3a2a1c);
    const pm=new THREE.PMREMGenerator(r);this.env=sc.environment=pm.fromScene(new RoomEnvironment(),0.04).texture;sc.environmentIntensity=0.45;
    this.camera=new THREE.PerspectiveCamera(36,1,0.2,420); // near 0.2: better depth precision on 16-bit-depth mobile GPUs
    const ctl=this.controls=new OrbitControls(this.camera,r.domElement);
    ctl.enableDamping=true;ctl.dampingFactor=.12;ctl.enablePan=false;ctl.minDistance=5;ctl.maxDistance=42;
    ctl.enableRotate=false;ctl.maxPolarAngle=1.4;ctl.minPolarAngle=0.02;this.camMode=({Free:'Walk'})[localStorage.getItem('camMode')]||localStorage.getItem('camMode')||'Player';ctl.target.set(0,0.3,0);ctl.rotateSpeed=.7;
    ctl.addEventListener('start',()=>{this.userOrbit=true;this.camTween=null});
    // lights
    sc.add(new THREE.HemisphereLight(0xfff0dc,0x6a5038,0.75));
    const d=this.sun=new THREE.DirectionalLight(0xffe4b8,1.5);d.position.set(5,14,7);d.castShadow=true;
    const S=d.shadow;S.mapSize.set(mobile?1024:2048,mobile?1024:2048);S.camera.left=-11;S.camera.right=11;S.camera.top=8;S.camera.bottom=-8;S.camera.near=4;S.camera.far=30;S.bias=-0.0004;S.normalBias=0.02;S.radius=6;
    sc.add(d);
    const fill=new THREE.PointLight(0xffb070,18,40,1.6);fill.position.set(-8,6,-6);sc.add(fill);
    this.markers=new THREE.Group();sc.add(this.markers);
    this.graveSlots={w:0,b:0};
    buildPlinth(sc,{env:this.env});
    this.room=new Sistine(sc,r);this.room.loadCeiling(); // ceiling early
    this._buildChairs();
    this._buildZoomUI();
    this.ray=new THREE.Raycaster();
    this._bindInput();
    window.addEventListener('resize',()=>this.resize());
    this.resize();
    this.view={side:'w'};
    this.setView('w',false);
    const loop=(t)=>{requestAnimationFrame(loop);this._tick(t)};requestAnimationFrame(loop);
  }
  async init(){
    const ben=null,chr=null; // panels are drawn procedurally (see textures.js panelArt)
    this._buildBoard({benedict:ben,christ:chr});
    this._buildMaterials();
    setTimeout(()=>this.room.loadArt(),300); // lazy: after the board is up
  }
  _buildZoomUI(){
    const w=this.zoomUI=document.createElement('div');w.className='zoomui';w.hidden=true;
    w.innerHTML='<button aria-label="Zoom in" data-z="0.7">+</button><button aria-label="Zoom out" data-z="1.43">−</button>';
    w.addEventListener('click',e=>{const b=e.target.closest('button');if(b)this.zoom(+b.dataset.z)});
    this.host.appendChild(w);
    // Walk: compact quick-jump strip along the top (scrolls sideways), collapsible
    const a=this.artUI=document.createElement('div');a.className='artui';a.hidden=true;
    if(localStorage.getItem('artOpen')==='0')a.classList.add('shut');
    a.innerHTML='<button data-k="back">Back to board</button><button class="tog" data-k="tog">Artworks</button>'+
      this.room.artworks().map(o=>`<button data-k="${o.id}">${o.name}</button>`).join('');
    a.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;
      if(k==='tog'){a.classList.toggle('shut');localStorage.setItem('artOpen',a.classList.contains('shut')?'0':'1')}
      else if(k==='back'){if(this.free)this.freeBack();else this.backToBoard()}else if(this.free)this.freeToArt(k);else this.walkToArt(k)});
    this.host.appendChild(a);
    // Walk: virtual joystick (bottom-left)
    const sh=this.seatUI=document.createElement('div');sh.className='seathint';sh.hidden=true;sh.innerHTML='<span>Walk to your chair to sit and play</span><button type="button">Skip, sit now</button>';
    sh.querySelector('button').addEventListener('click',e=>{e.stopPropagation();this.sitDown()});this.host.appendChild(sh);
    const j=this.joyUI=document.createElement('div');j.className='joy';j.hidden=true;j.innerHTML='<div class="knob"></div>';this.host.appendChild(j);
    const J=this.joy={x:0,y:0,id:null},R=44,knob=j.firstChild;
    const setK=(dx,dy)=>{const l=Math.hypot(dx,dy),s=l>R?R/l:1;dx*=s;dy*=s;knob.style.transform=`translate(${dx}px,${dy}px)`;
      let x=dx/R,y=dy/R;const m=Math.hypot(x,y);if(m<.15){x=y=0}else{const k=(m-.15)/.85/m;x*=k;y*=k}J.x=x;J.y=y};
    // geometry is re-read on every press (the stage resizes on fullscreen / rotation), and reset on resize so a stale press can't keep walking
    const centre=()=>{const r=j.getBoundingClientRect();J.cx=r.left+r.width/2;J.cy=r.top+r.height/2};
    const start=(id,x,y)=>{J.id=id;centre();setK(x-J.cx,y-J.cy);if(this.walk)this.walk.glide=null};
    j.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(J.id!=null&&J.id!==e.pointerId)return;try{j.setPointerCapture(e.pointerId)}catch(_){}start(e.pointerId,e.clientX,e.clientY)});
    j.addEventListener('pointermove',e=>{if(e.pointerId===J.id){e.preventDefault();setK(e.clientX-J.cx,e.clientY-J.cy)}});
    const end=e=>{if(e.pointerId!==J.id)return;J.id=null;setK(0,0)};
    j.addEventListener('pointerup',end);j.addEventListener('pointercancel',end);j.addEventListener('lostpointercapture',end);
    // touch fallback (browsers without pointer events) and to stop the page scrolling/zooming under the stick
    if(!window.PointerEvent){const tf=e=>{const t=[...e.changedTouches].find(t=>J.id==null||J.id==='t'+t.identifier);return t};
      j.addEventListener('touchstart',e=>{e.preventDefault();const t=tf(e);if(t)start('t'+t.identifier,t.clientX,t.clientY)},{passive:false});
      j.addEventListener('touchmove',e=>{e.preventDefault();const t=tf(e);if(t&&J.id!=null)setK(t.clientX-J.cx,t.clientY-J.cy)},{passive:false});
      const te=e=>{const t=tf(e);if(t&&J.id!=null){J.id=null;setK(0,0)}};j.addEventListener('touchend',te);j.addEventListener('touchcancel',te)}
    else j.addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
    this.resetJoy=()=>{J.id=null;setK(0,0)};
    const rj=()=>{if(J.id!=null)centre()};window.addEventListener('resize',rj);document.addEventListener('fullscreenchange',rj);
  }
  zoom(f){ // Walk: optical zoom (field of view); Free cam: dolly
    if(this.free)return this._freeDolly(f);if(!this.walk)return;this.walk.fovTo=THREE.MathUtils.clamp(this.walk.fovTo*f,15,75)}
  // ---------- chairs: one each side of the table; the game starts with a walk to yours ----------
  _buildChairs(){
    const S=2.6,F=ROOM.y0,wood=new THREE.MeshStandardMaterial({color:0x3a2114,roughness:.55,metalness:.05}),
      vel=new THREE.MeshStandardMaterial({color:0x8a1020,roughness:.9,emissive:0x1a0206,emissiveIntensity:1});
    this.chairs={};this.chairMeshes=[];
    const box=(g,w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;g.add(o);return o};
    for(const side of ['w','b']){const s=side==='w'?1:-1,g=new THREE.Group();g.position.set(0,F,CHAIR_Z*s);g.rotation.y=s>0?0:Math.PI;
      const W=.5*S,D=.46*S,H=.45*S,B=1.02*S,l=.045*S;
      for(const [x,z] of [[-1,-1],[1,-1],[-1,1],[1,1]])box(g,l,z>0?B:H,l,x*(W/2-l/2),(z>0?B:H)/2,z*(D/2-l/2),wood);
      box(g,W,.05*S,D,0,H,0,wood);box(g,W-.04*S,.06*S,D-.04*S,0,H+.055*S,0,vel);
      box(g,W,.07*S,l,0,B-.035*S,D/2-l/2,wood);box(g,W-2*l,.5*S,.03*S,0,H+.42*S,D/2-l/2,vel);
      const glow=new THREE.Mesh(new THREE.PlaneGeometry(2.4*S,2.4*S).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:this._glowTex(),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false,opacity:.8}));
      glow.position.y=.02;glow.renderOrder=2;glow.visible=false;g.add(glow);
      const halo=new THREE.Mesh(new THREE.TorusGeometry(.42*S,.018*S,8,48),new THREE.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.8,toneMapped:false,depthWrite:false}));
      halo.rotation.x=Math.PI/2;halo.position.y=B+.18*S;halo.visible=false;g.add(halo);
      g.traverse(o=>{if(o.isMesh&&o!==glow&&o!==halo){o.userData.chair=side;this.chairMeshes.push(o)}});
      this.scene.add(g);this.chairs[side]={g,glow,halo,z:CHAIR_Z*s}}
  }
  _glowTex(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),gr=x.createRadialGradient(64,64,4,64,64,64);
    gr.addColorStop(0,'rgba(255,214,120,.9)');gr.addColorStop(.45,'rgba(255,190,80,.35)');gr.addColorStop(1,'rgba(255,180,60,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);return new THREE.CanvasTexture(c)}
  // start of a game: stand a few metres down the aisle, facing the board; walk to (or tap) the glowing chair to sit
  walkToChair(side,onSeated){
    const s=side==='b'?-1:1;this.view.side=side;this.onSeated=onSeated;
    if(this.free)this._exitFree();this.camMode='Walk';this.onCamChange&&this.onCamChange('Walk');
    if(!this.walk)this._enterWalk();const w=this.walk;
    w.pos.set(0,0,13.9*s);w.vel.set(0,0,0);w.glide=null;w.yaw=w.yawT=s>0?0:Math.PI;w.pitch=w.pitchT=-.22;w.fov=w.fovTo=70;
    this.seat={side};for(const k in this.chairs){const c=this.chairs[k];c.glow.visible=c.halo.visible=k===side}
    this.seatUI.hidden=false;this._walkStep(performance.now());
  }
  sitDown(){if(!this.seat)return;this._endSeat();this.camMode='Player';localStorage.setItem('camMode','Player');this.onCamChange&&this.onCamChange('Player');this.setView(this.view.side)}
  _endSeat(){if(!this.seat)return;this.seat=null;for(const k in this.chairs){const c=this.chairs[k];c.glow.visible=c.halo.visible=false}
    this.seatUI.hidden=true;const f=this.onSeated;this.onSeated=null;f&&f()}
  _seatGlow(now){if(!this.seat)return;const c=this.chairs[this.seat.side],p=.5+.5*Math.sin(now*.004);c.glow.material.opacity=.45+.45*p;c.halo.material.opacity=.45+.5*p;c.halo.scale.setScalar(1+.06*p)}
  // ---------- Walk: first-person pilgrim on the chapel floor ----------
  _buildBody(){
    const M=2.6,g=new THREE.Group();g.visible=false;
    const wool=new THREE.MeshStandardMaterial({color:0x8a6446,roughness:.92,metalness:0,emissive:0x2a1a10,emissiveIntensity:1});
    const skin=new THREE.MeshStandardMaterial({color:0xdcae8c,roughness:.7,emissive:0x3a2418,emissiveIntensity:1});
    const leather=new THREE.MeshStandardMaterial({color:0x6e4a2c,roughness:.75,emissive:0x1e120a,emissiveIntensity:1});
    const cord=new THREE.MeshStandardMaterial({color:0xc9a85a,roughness:.55,metalness:.2});
    // tunic: lathe from the hem (mid-calf) to the shoulders, slightly flattened front-to-back
    const prof=[[.27,.42],[.255,.6],[.215,.98],[.2,1.05],[.215,1.3],[.2,1.42],[.12,1.47],[.07,1.5]].map(([r,y])=>new THREE.Vector2(r*M,y*M));
    const robe=new THREE.Mesh(new THREE.LatheGeometry(prof,28),wool);robe.scale.z=.72;robe.position.z=.23*M;g.add(robe);
    const belt=new THREE.Mesh(new THREE.TorusGeometry(.205*M,.014*M,6,28),cord);belt.rotation.x=Math.PI/2;belt.scale.y=.72;belt.position.set(0,1.0*M,.23*M);g.add(belt);
    const knot=new THREE.Mesh(new THREE.CylinderGeometry(.01*M,.01*M,.35*M,6),cord);knot.position.set(.06*M,.82*M,.08*M);g.add(knot);
    this.legs=[];
    for(const sx of [-1,1]){
      const hip=new THREE.Group();hip.position.set(sx*.1*M,.62*M,.12*M);g.add(hip);
      const leg=new THREE.Mesh(new THREE.CapsuleGeometry(.055*M,.42*M,4,10),skin);leg.position.y=-.27*M;hip.add(leg);
      const foot=new THREE.Mesh(new THREE.BoxGeometry(.1*M,.05*M,.25*M),leather);foot.position.set(0,-.575*M,-.09*M);hip.add(foot);
      this.legs.push(hip);
      const arm=new THREE.Mesh(new THREE.CapsuleGeometry(.05*M,.5*M,4,10),wool);arm.position.set(sx*.25*M,1.08*M,.22*M);arm.rotation.z=sx*.08;g.add(arm);
      const hand=new THREE.Mesh(new THREE.SphereGeometry(.045*M,10,8),skin);hand.position.set(sx*.27*M,.76*M,.2*M);g.add(hand);
    }
    g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    const [c,x]=(()=>{const c=document.createElement('canvas');c.width=c.height=128;return [c,c.getContext('2d')]})();
    const gr=x.createRadialGradient(64,64,6,64,64,64);gr.addColorStop(0,'rgba(0,0,0,.42)');gr.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=gr;x.fillRect(0,0,128,128);
    const blob=new THREE.Mesh(new THREE.PlaneGeometry(1.1*M,1.1*M).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthWrite:false,toneMapped:false}));
    blob.position.set(0,.01,.12*M);blob.renderOrder=1;g.add(blob);
    this.scene.add(g);return g}
  _seatPose(){const s=this.view.side==='b'?-1:1;return {x:0,z:5.85*s,yaw:s>0?0:Math.PI,pitch:-.5}}
  _enterWalk(){
    this.controls.enabled=false;this.camTween=null;const c=this.camera;c.rotation.order='YXZ';
    const P=this._seatPose();
    this.walk={pos:new THREE.Vector3(P.x,0,P.z),vel:new THREE.Vector3(),yaw:P.yaw,yawT:P.yaw,pitch:P.pitch,pitchT:P.pitch,fov:70,fovTo:70,phase:0,glide:null,hdT:0};
    if(!this.body)this.body=this._buildBody();this.body.visible=true;
    c.fov=70;this._offset();this.zoomUI.hidden=this.artUI.hidden=this.joyUI.hidden=false;this._walkStep(performance.now());
  }
  _exitWalk(){this.walk=null;this.keys.clear();this.look.id=this.look.pinch=null;this.controls.enabled=true;this.camera.rotation.order='XYZ';
    if(this.body)this.body.visible=false;this.zoomUI.hidden=this.artUI.hidden=this.joyUI.hidden=true;this.joy.x=this.joy.y=0}
  backToBoard(){this.setCamMode('Player');this.onCamChange&&this.onCamChange('Player')}
  // obstacles (x0,x1,z0,z1): the chess table, the altar steps, the two halves of the marble screen
  get _boxes(){if(!this._bx){const S=2.6,HW=ROOM.W/2,HL=ROOM.L/2,az=-HL+3.2*S-.4,tz=HL-14.5*S;
    this._bx=[[-6.9,6.9,-4.9,4.9],[-4*S,4*S,-HL,az+1.7*S],[1.6*S,HW,tz-.25*S,tz+.25*S],[-HW,-1.6*S,tz-.25*S,tz+.25*S],[-.7,.7,CHAIR_Z-.4,CHAIR_Z+.6],[-.7,.7,-CHAIR_Z-.6,-CHAIR_Z+.4]];if(this.room&&this.room.organ)this._bx.push(this.room.organ)}return this._bx}
  _collide(p){const S=2.6,r=.3*S,M=.35*S,X=ROOM.W/2-M,Z=ROOM.L/2-M,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
    for(const [x0,x1,z0,z1] of this._boxes){const cx=cl(p.x,x0,x1),cz=cl(p.z,z0,z1),dx=p.x-cx,dz=p.z-cz,d=Math.hypot(dx,dz);if(d>=r)continue;
      if(d>1e-6){p.x=cx+dx/d*r;p.z=cz+dz/d*r}
      else{const o=[p.x-x0,x1-p.x,p.z-z0,z1-p.z],i=o.indexOf(Math.min(...o));if(i===0)p.x=x0-r;else if(i===1)p.x=x1+r;else if(i===2)p.z=z0-r;else p.z=z1+r}}
    p.x=cl(p.x,-X,X);p.z=cl(p.z,-Z,Z);return p}
  _route(a,b){ // go around the table / altar steps instead of through them
    const pts=[a.clone()],r=.3*2.6+.4;
    for(const [x0,x1,z0,z1] of this._boxes.slice(0,2)){const A=pts[pts.length-1];
      if(!segBox(A,b,x0-r,x1+r,z0-r,z1+r))continue;
      const side=A.x>=x1?1:A.x<=x0?-1:b.x>=x1?1:b.x<=x0?-1:(A.x+b.x>=0?1:-1),lx=side>0?x1+r+.05:x0-r-.05;
      pts.push(new THREE.Vector3(lx,0,A.z),new THREE.Vector3(lx,0,b.z))}
    pts.push(b.clone());return pts}
  walkToArt(id){const w=this.walk;if(!w)return;const o=this.room.artworks().find(a=>a.id===id);if(!o)return;
    const S=2.6,EYE=ROOM.y0+1.68*S,up=o.pitch>1;let p;
    if(up)p=new THREE.Vector3(o.c.x,0,o.id==='ceiling'?-20:o.c.z);
    else if(o.n.z)p=new THREE.Vector3(o.c.x,0,o.c.z+o.n.z*(o.id==='christ'?5.6:13.5)*S);
    else p=new THREE.Vector3(o.c.x+o.n.x*11*S,0,o.c.z); // across the nave: the high panels are seen almost straight on
    this._collide(p);
    const dx=o.c.x-p.x,dz=o.c.z-p.z,hd=Math.hypot(dx,dz),dist=Math.hypot(hd,o.c.y-EYE);
    let yaw=up?o.yaw:Math.atan2(-dx,-dz),pitch=up?THREE.MathUtils.degToRad(89):Math.atan2(o.c.y-EYE,hd);
    let dy=yaw-w.yawT;dy=Math.atan2(Math.sin(dy),Math.cos(dy));yaw=w.yawT+dy; // shortest turn, yaw stays continuous
    const aH=2*Math.atan(o.h/2/dist),aW=2*Math.atan(o.w/2/dist),need=Math.min(Math.max(aH,2*Math.atan(Math.tan(aW/2)/this.camera.aspect))*1.12,aH*2.2); // frame the whole piece, or its height on narrow screens
    w.fovTo=THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(need),15,75);
    const path=this._route(w.pos,p),L=[0];for(let i=1;i<path.length;i++)L.push(L[i-1]+path[i].distanceTo(path[i-1]));
    const len=L[L.length-1];
    w.glide={path,L,len,t0:performance.now(),dur:THREE.MathUtils.clamp(400+len*18.7,470,2130),y0:w.yawT,y1:yaw,p0:w.pitchT,p1:pitch};
    this.room.wantHD(o.id==='christ'?'judgement':o.id)}
  _walkStep(now){const w=this.walk,c=this.camera,S=2.6,dt=Math.min(.05,(now-(this._lastT||now))/1000);
    if(w.glide){const g=w.glide,t=Math.min(1,Math.max(0,(now-g.t0)/g.dur)),e=easeIO(t),s=e*g.len;
      let i=1;while(i<g.L.length-1&&g.L[i]<s)i++;const seg=g.L[i]-g.L[i-1]||1;w.pos.lerpVectors(g.path[i-1],g.path[i],Math.min(1,(s-g.L[i-1])/seg));
      w.yawT=g.y0+(g.y1-g.y0)*e;w.pitchT=g.p0+(g.p1-g.p0)*e;w.vel.set(0,0,0);if(t>=1)w.glide=null}
    // input: joystick + keys (forward = -y on the stick)
    const K=this.keys,has=(...a)=>a.some(k=>K.has(k));
    let ix=this.joy.x+(has('KeyD','ArrowRight')?1:0)-(has('KeyA','ArrowLeft')?1:0),iz=this.joy.y+(has('KeyS','ArrowDown')?1:0)-(has('KeyW','ArrowUp')?1:0);
    const il=Math.hypot(ix,iz);if(il>1){ix/=il;iz/=il}
    if(il>.01)w.glide=null;
    if(!w.glide){const sp=2.4*S*(has('ShiftLeft','ShiftRight')?2.2:1),sy=Math.sin(w.yaw),cy=Math.cos(w.yaw);
      const tx=(cy*ix+sy*iz)*sp,tz=(-sy*ix+cy*iz)*sp,k=1-Math.exp(-dt*9);
      w.vel.x+=(tx-w.vel.x)*k;w.vel.z+=(tz-w.vel.z)*k;w.pos.addScaledVector(w.vel,dt);this._collide(w.pos)}
    // smoothed look
    const lk=1-Math.exp(-dt*20);w.yaw+=(w.yawT-w.yaw)*lk;w.pitch+=(w.pitchT-w.pitch)*lk;
    w.fov+=(w.fovTo-w.fov)*(1-Math.exp(-dt*12));if(Math.abs(w.fovTo-w.fov)<.01)w.fov=w.fovTo;
    // gait: subtle head-bob and leg swing
    const spd=Math.hypot(w.vel.x,w.vel.z),amt=Math.min(1,spd/(2.4*S));w.phase+=dt*spd*2.2;
    c.position.set(w.pos.x,ROOM.y0+1.68*S+Math.sin(w.phase*2)*.018*S*amt,w.pos.z);c.rotation.set(w.pitch,w.yaw,0,'YXZ');
    if(c.fov!==w.fov){c.fov=w.fov;c.updateProjectionMatrix()}
    const b=this.body;b.position.set(w.pos.x,ROOM.y0,w.pos.z);b.rotation.y=w.yaw;
    this.legs[0].rotation.x=Math.sin(w.phase)*.45*amt;this.legs[1].rotation.x=-Math.sin(w.phase)*.45*amt;
    // hi-res fresco for whatever the pilgrim is standing near
    if(this.seat){const c=this.chairs[this.seat.side];if(Math.hypot(w.pos.x,w.pos.z-c.z)<1.2*S+.6){this.sitDown();return}}
    if(now-w.hdT>500){w.hdT=now;this._hdLook(16*S)}}
  _hdLook(max){const c=this.camera,fw=new THREE.Vector3();c.getWorldDirection(fw);let best=null,bd=max; // hi-res for the fresco being looked at
    for(const o of this.room.artworks()){if(o.pitch>1)continue;const v=o.c.clone().sub(c.position),l=v.length();if(v.dot(fw)<.75*l)continue;
      const s=l-(o.id==='judgement'?6*2.6:0);if(s<bd){bd=s;best=o}}
    if(best)this.room.wantHD(best.id==='christ'?'judgement':best.id)}
  // ---------- Free cam: stable damped orbit around a target (board or an artwork); no roll, no inertia ----------
  _boardFocus(){const s=this.view.side==='b'?Math.PI:0,c=this.camera,hf=2*Math.atan(Math.tan(THREE.MathUtils.degToRad(c.fov)/2)*c.aspect);
    return {t:new THREE.Vector3(0,.3,0),yaw:s,pitch:THREE.MathUtils.degToRad(48),dist:THREE.MathUtils.clamp(5.6/Math.tan(hf/2),13,30),pmin:5,pmax:85,dmin:2.2,board:true}}
  _enterFree(){
    this.controls.enabled=false;this.camTween=null;const c=this.camera;c.rotation.order='XYZ';c.up.set(0,1,0);
    c.fov=45;this._offset();
    const B=this._boardFocus(),off=c.position.clone().sub(B.t),d=off.length()||B.dist;
    const yaw=Math.atan2(off.x,off.z),pitch=THREE.MathUtils.clamp(Math.asin(THREE.MathUtils.clamp(off.y/d,-1,1)),THREE.MathUtils.degToRad(5),THREE.MathUtils.degToRad(85));
    this.free={t:B.t.clone(),tT:B.t.clone(),yaw,yawT:yaw,pitch,pitchT:pitch,dist:d,distT:d,glide:null,hdT:0,two:null,drag:null};
    this._focus(B,false); // ease from wherever the camera was to the default board view
    this.zoomUI.hidden=this.artUI.hidden=false;this.joyUI.hidden=true;this._freeStep(performance.now());
  }
  _exitFree(){this.free=null;this.controls.enabled=true;this.zoomUI.hidden=this.artUI.hidden=true}
  _focus(o,glide=true){const F=this.free,R=THREE.MathUtils.degToRad;F.pmin=R(o.pmin);F.pmax=R(o.pmax);F.dmin=o.dmin;F.board=!!o.board;
    let y1=o.yaw,dy=y1-F.yawT;dy=Math.atan2(Math.sin(dy),Math.cos(dy));y1=F.yawT+dy;
    const to={t:o.t.clone(),yaw:y1,pitch:o.pitch,dist:o.dist};
    if(!glide||this.fast){F.tT.copy(to.t);F.yawT=to.yaw;F.pitchT=to.pitch;F.distT=to.dist;return}
    F.glide={t0:performance.now(),dur:1000,from:{t:F.t.clone(),yaw:F.yaw,pitch:F.pitch,dist:F.dist},to}}
  freeToArt(id){const F=this.free;if(!F)return;const o=this.room.artworks().find(a=>a.id===id);if(!o)return;
    const c=this.camera,vf=THREE.MathUtils.degToRad(c.fov),hf=2*Math.atan(Math.tan(vf/2)*c.aspect);
    const dH=o.h/2/Math.tan(vf/2)*1.15,dW=o.w/2/Math.tan(hf/2)*1.1,dist=Math.min(Math.max(dH,dW),dH*2.2); // whole piece, or its height on narrow screens
    const up=o.pitch>1;
    this._focus(up?{t:o.c.clone(),yaw:o.yaw,pitch:THREE.MathUtils.degToRad(-86),dist,pmin:-88,pmax:-30,dmin:3}
      :{t:o.c.clone(),yaw:Math.atan2(o.n.x,o.n.z),pitch:0,dist,pmin:-40,pmax:50,dmin:2.5}); // straight on, camera level with the fresco
    this.room.wantHD(o.id==='christ'?'judgement':o.id)}
  freeBack(){if(this.free)this._focus(this._boardFocus())}
  _dir(yaw,pitch){const cp=Math.cos(pitch);return new THREE.Vector3(cp*Math.sin(yaw),Math.sin(pitch),cp*Math.cos(yaw))}
  _arm(t,d){ // longest camera distance from target t along unit d that stays inside the chapel (walls, floor, vault)
    const M=1.2,HW=ROOM.W/2-M,HL=ROOM.L/2-M,y0=ROOM.y0+M,yc=ceilingAt(ROOM.W/2)-M;let m=200;
    if(d.x>1e-6)m=Math.min(m,(HW-t.x)/d.x);else if(d.x<-1e-6)m=Math.min(m,(-HW-t.x)/d.x);
    if(d.z>1e-6)m=Math.min(m,(HL-t.z)/d.z);else if(d.z<-1e-6)m=Math.min(m,(-HL-t.z)/d.z);
    if(d.y<-1e-6)m=Math.min(m,(y0-t.y)/d.y);else if(d.y>1e-6&&t.y<yc)m=Math.min(m,(yc-t.y)/d.y);
    return Math.max(.5,m)}
  _clampT(t){const M=2,cl=THREE.MathUtils.clamp;t.x=cl(t.x,-ROOM.W/2+M,ROOM.W/2-M);t.z=cl(t.z,-ROOM.L/2+M,ROOM.L/2-M);t.y=cl(t.y,ROOM.y0+.3,ceilingAt(t.x,t.z)-.3);return t}
  _freePan(dx,dy){const F=this.free;if(!F)return;F.glide=null;const h=this.renderer.domElement.clientHeight||600;
    const s=2*F.dist*Math.tan(THREE.MathUtils.degToRad(this.camera.fov)/2)/h;
    const right=new THREE.Vector3(Math.cos(F.yaw),0,-Math.sin(F.yaw));
    const flat=Math.abs(F.pitch)>THREE.MathUtils.degToRad(40),second=flat?new THREE.Vector3(Math.sin(F.yaw),0,Math.cos(F.yaw)).multiplyScalar(-Math.sign(F.pitch)):new THREE.Vector3(0,1,0); // content follows the fingers
    F.tT.addScaledVector(right,-dx*s).addScaledVector(second,dy*s);
    if(F.board)F.tT.y=.3;this._clampT(F.tT)}
  _freeOrbit(dx,dy){const F=this.free;F.glide=null;const k=.0055;F.yawT-=dx*k;F.pitchT=THREE.MathUtils.clamp(F.pitchT+dy*k,F.pmin,F.pmax)}
  _freeDolly(f){const F=this.free;if(!F)return;F.glide=null;F.distT=THREE.MathUtils.clamp(F.distT*f,F.dmin,150)}
  _freeStep(now){const F=this.free,c=this.camera,dt=Math.min(.05,(now-(this._lastT||now))/1000);
    if(F.glide){const g=F.glide,t=Math.min(1,Math.max(0,(now-g.t0)/g.dur)),e=easeIO(t);
      F.t.lerpVectors(g.from.t,g.to.t,e);F.yaw=g.from.yaw+(g.to.yaw-g.from.yaw)*e;F.pitch=g.from.pitch+(g.to.pitch-g.from.pitch)*e;
      F.dist=Math.exp(Math.log(g.from.dist)+(Math.log(g.to.dist)-Math.log(g.from.dist))*e);
      F.tT.copy(F.t);F.yawT=F.yaw;F.pitchT=F.pitch;F.distT=F.dist;if(t>=1){F.glide=null;F.tT.copy(g.to.t);F.yawT=g.to.yaw;F.pitchT=g.to.pitch;F.distT=g.to.dist}}
    else{const k=1-Math.exp(-dt*10);F.pitchT=THREE.MathUtils.clamp(F.pitchT,F.pmin,F.pmax);
      F.distT=Math.min(F.distT,Math.max(F.dmin,this._arm(F.tT,this._dir(F.yawT,F.pitchT))));
      F.t.lerp(F.tT,k);F.yaw+=(F.yawT-F.yaw)*k;F.pitch+=(F.pitchT-F.pitch)*k;F.dist+=(F.distT-F.dist)*k}
    const d=this._dir(F.yaw,F.pitch),r=Math.min(F.dist,this._arm(F.t,d));
    c.up.set(0,1,0);c.position.copy(F.t).addScaledVector(d,r);c.lookAt(F.t);
    // hi-res fresco for whatever the camera is looking at closely
    if(now-F.hdT>500){F.hdT=now;this._hdLook(16*2.6)}}
  _buildBoard(imgs){
    const {W,H}=BOARD;
    const ppu=this.mobile?128:160;
    const {color,hr}=buildBoardTextures(ppu,imgs);
    const map=canvasTex(color,{aniso:this.renderer.capabilities.getMaxAnisotropy()});map.wrapS=map.wrapT=THREE.ClampToEdgeWrapping;
    const hmap=canvasTex(hr,{srgb:false});hmap.wrapS=hmap.wrapT=THREE.ClampToEdgeWrapping;
    const topMat=new THREE.MeshStandardMaterial({map,bumpMap:hmap,bumpScale:2.2,roughnessMap:hmap,roughness:1,metalness:0,color:0xd6ba90});
    const edgeC=woodCanvas(512,128,{light:[226,198,150],dark:[200,160,108],seed:11,freq:5,warp:2,stretch:3,axis:'x'});
    const edgeMat=new THREE.MeshStandardMaterial({map:canvasTex(edgeC),roughness:.6});
    const box=new THREE.BoxGeometry(W,TOP,H);box.translate(0,TOP/2,0);
    // box face order: +x,-x,+y,-y,+z,-z
    const mats=[edgeMat,edgeMat,topMat,edgeMat,edgeMat,edgeMat];
    // gilded frame around the board
    this.gold=new THREE.MeshStandardMaterial({color:0xd8aa48,metalness:1,roughness:.28,envMap:this.env,envMapIntensity:1.5});
    for(const [w,d,x,z] of [[W+.36,.18,0,H/2+.09],[W+.36,.18,0,-H/2-.09],[.18,H,W/2+.09,0],[.18,H,-W/2-.09,0]]){const f=new THREE.Mesh(new THREE.BoxGeometry(w,TOP+.05,d),this.gold);f.position.set(x,(TOP+.05)/2,z);f.castShadow=true;this.scene.add(f)}
    const b=this.board=new THREE.Mesh(box,mats);b.receiveShadow=true;b.castShadow=true;this.scene.add(b);
    // BoxGeometry top-face UV: u along +x, v=1 at -z -> matches canvas (top row = rank 8 side)
    const pick=new THREE.Mesh(new THREE.PlaneGeometry(8,8).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({visible:false}));
    pick.position.y=TOP;this.pickPlane=pick;this.scene.add(pick);
  }
  _buildMaterials(){
    // white: warm polished ivory with a soft pearly rim; black: deep oxblood lacquer with a gold sheen
    const iv=woodCanvas(256,512,{light:[255,248,232],dark:[238,224,198],seed:21,freq:5,warp:2,stretch:6,axis:'y',contrast:.5});
    const ox=woodCanvas(256,512,{light:[120,18,26],dark:[70,8,14],seed:33,freq:9,warp:3,stretch:6,axis:'y',contrast:.8});
    this.mat={
      w:new THREE.MeshPhysicalMaterial({map:canvasTex(iv),color:0xfff6e6,roughness:.26,clearcoat:.9,clearcoatRoughness:.15,sheen:1,sheenColor:new THREE.Color(0xffe2b0),sheenRoughness:.3,emissive:0x3a2c1a,emissiveIntensity:.55}),
      b:new THREE.MeshPhysicalMaterial({map:canvasTex(ox),roughness:.24,clearcoat:1,clearcoatRoughness:.08,sheen:.8,sheenColor:new THREE.Color(0xc89040),sheenRoughness:.35})};
    if(!this.gold)this.gold=new THREE.MeshStandardMaterial({color:0xd8aa48,metalness:1,roughness:.28,envMap:this.env,envMapIntensity:1.5});
    this.geo=pieceGeometries();
    // gold rings: one on the widest part of the base, a collar at the narrowest neck (lathe pieces)
    this.trim={};
    for(const t in this.geo){const P=this.geo[t].attributes.position,h=this.geo[t].boundingBox.max.y;
      const radAt=(y0,y1)=>{let best=[0,0],min=[9,0];for(let i=0;i<P.count;i++){const y=P.getY(i);if(y<y0||y>y1)continue;const r=Math.hypot(P.getX(i),P.getZ(i));if(r>best[0])best=[r,y]}return best};
      const [rb,yb]=radAt(0.02,0.25*h);const rings=[[rb+.004,yb,.026]];
      if(t!=='n'){const buckets={};for(let i=0;i<P.count;i++){const y=P.getY(i);if(y<.4*h||y>.8*h)continue;const k=Math.round(y*50);const r=Math.hypot(P.getX(i),P.getZ(i));buckets[k]=Math.max(buckets[k]||0,r)}
        let mk=null;for(const k in buckets)if(mk===null||buckets[k]<buckets[mk])mk=k;if(mk!==null)rings.push([buckets[mk]+.012,mk/50,.024])}
      this.trim[t]=rings.map(([r,y,tb])=>{const g=new THREE.TorusGeometry(r,tb,8,40);g.rotateX(Math.PI/2);g.translate(0,y,0);return g})}
  }
  // ---------- pieces ----------
  makePiece(type,color){
    const m=new THREE.Mesh(this.geo[type],this.mat[color]);
    m.castShadow=true;m.receiveShadow=true;
    for(const g of this.trim[type]){const o=new THREE.Mesh(g,this.gold);o.castShadow=true;o.raycast=()=>{};m.add(o)}
    m.userData={type,color,square:null};
    if(type==='n')m.rotation.y=color==='w'?Math.PI/2:-Math.PI/2; // face the opponent
    if(type==='b')m.rotation.y=Math.PI/4;
    this.scene.add(m);this.pieces.push(m);return m;
  }
  pieceAt(sq){return this.pieces.find(p=>p.userData.square===sq)}
  clearPieces(){for(const p of this.pieces)this.scene.remove(p);this.pieces=[];this.graveSlots={w:0,b:0}}
  gravePos(color,idx){ // captured pieces rest on the table beside the board (keeps the table shallow so a walker can stand close)
    const side=color==='w'?-1:1; // white pieces captured -> left of white, black's -> right
    const row=Math.floor(idx/8),col=idx%8;
    return new THREE.Vector3(side*(5.0+row*0.62),0,(col-3.5)*0.62*-side);
  }
  // Rebuild pieces from a chess.js board array, animating existing meshes when possible.
  sync(board,animate=true){
    const want={};
    for(let r=0;r<8;r++)for(let f=0;f<8;f++){const c=board[r][f];if(c)want[c.square]=c}
    const used=new Set();
    for(const p of this.pieces){const sq=p.userData.square;const w=sq&&want[sq];if(w&&w.type===p.userData.type&&w.color===p.userData.color){used.add(p);w._ok=true}}
    const pool=this.pieces.filter(p=>!used.has(p));
    for(const sq in want){const w=want[sq];if(w._ok)continue;
      const target=sqPos(sq);
      let best=null,bd=1e9;for(const p of pool){if(p.userData.type!==w.type||p.userData.color!==w.color)continue;const dd=p.position.distanceTo(target);if(dd<bd){bd=dd;best=p}}
      if(best){pool.splice(pool.indexOf(best),1)}else{best=this.makePiece(w.type,w.color);best.position.copy(target);best.position.y=TOP}
      best.userData.square=sq;used.add(best);
      this.moveMesh(best,target,animate?0.35:0);
    }
    // leftovers go to the graveyard, or vanish if extra (undone promotions)
    const counts={};for(const sq in want){const k=want[sq].color+want[sq].type;counts[k]=(counts[k]||0)+1}
    const start={p:8,n:2,b:2,r:2,q:1,k:1};
    this.graveSlots={w:0,b:0};
    const order='qrbnp';
    pool.sort((a,b)=>order.indexOf(a.userData.type)-order.indexOf(b.userData.type));
    const capCount={};
    for(const p of pool){const k=p.userData.color+p.userData.type;const have=(counts[k]||0)+(capCount[k]||0);
      if(have>=start[p.userData.type]){this.scene.remove(p);this.pieces.splice(this.pieces.indexOf(p),1);continue}
      capCount[k]=(capCount[k]||0)+1;p.userData.square=null;
      this.moveMesh(p,this.gravePos(p.userData.color,this.graveSlots[p.userData.color]++),animate?0.35:0);
    }
  }
  moveMesh(m,to,dur=0.35,hop=0.25,done){
    this.tweens=this.tweens.filter(t=>t.obj!==m);
    if(this.fast)dur=Math.min(dur,0.05);
    if(!dur){m.position.copy(to);done&&done();return}
    this.tweens.push({obj:m,from:m.position.clone(),to:to.clone(),t0:performance.now(),dur:dur*1000,hop,done});
  }
  // Animate a chess.js verbose move. Returns a promise resolved when finished.
  animateMove(mv){
    return new Promise(res=>{
      const mover=this.pieceAt(mv.from);
      let capSq=null;
      if(mv.flags.includes('e'))capSq=mv.to[0]+mv.from[1];else if(mv.captured)capSq=mv.to;
      const victim=capSq?this.pieceAt(capSq):null;
      const dur=mv.piece==='n'?0.42:0.36;
      if(victim&&victim!==mover){victim.userData.square=null;const c=victim.userData.color;
        const gp=this.gravePos(c,this.graveSlots[c]++);
        setTimeout(()=>{this.moveMesh(victim,gp,0.5,0.9);this.onCapture&&this.onCapture()},this.fast?0:dur*700)}
      if(!mover){res();return}
      mover.userData.square=mv.to;
      this.moveMesh(mover,sqPos(mv.to),dur,mv.piece==='n'?0.6:0.25,()=>{
        if(mv.promotion){this.scene.remove(mover);this.pieces.splice(this.pieces.indexOf(mover),1);const np=this.makePiece(mv.promotion,mv.color);np.position.copy(sqPos(mv.to));np.userData.square=mv.to;np.scale.setScalar(.01);this.tweens.push({obj:np,scale:true,t0:performance.now(),dur:250})}
        res();
      });
      if(mv.flags.includes('k')||mv.flags.includes('q')){
        const rank=mv.from[1];const rf=mv.flags.includes('k')?'h':'a',rt=mv.flags.includes('k')?'f':'d';
        const rook=this.pieceAt(rf+rank);if(rook){rook.userData.square=rt+rank;setTimeout(()=>this.moveMesh(rook,sqPos(rt+rank),0.35,0.35),this.fast?0:150)}
      }
    });
  }
  // ---------- markers ----------
  clearMarkers(){while(this.markers.children.length)this.markers.remove(this.markers.children[0])}
  _quad(sq,color,op,size=.98){const g=new THREE.PlaneGeometry(size,size);g.rotateX(-Math.PI/2);
    const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color,transparent:true,opacity:op,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));
    m.position.copy(sqPos(sq));m.position.y+=.004;this.markers.add(m);return m}
  setMarkers({last,selected,targets=[],check}){
    this.clearMarkers();this.targets=targets.map(t=>t.sq);
    if(last){this._quad(last.from,0xe0a020,.28);this._quad(last.to,0xe0a020,.38)}
    if(selected)this._quad(selected,0x3d8a3a,.45);
    if(check){const g=new THREE.CircleGeometry(.5,32);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0xd01010,transparent:true,opacity:.55,depthWrite:false}));m.position.copy(sqPos(check));m.position.y+=.006;this.markers.add(m)}
    for(const t of targets){
      if(t.capture){const g=new THREE.RingGeometry(.36,.47,32);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x1d4d1a,transparent:true,opacity:.6,depthWrite:false}));m.position.copy(sqPos(t.sq));m.position.y+=.008;this.markers.add(m)}
      else{const g=new THREE.CircleGeometry(.15,24);g.rotateX(-Math.PI/2);const m=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:0x1d4d1a,transparent:true,opacity:.6,depthWrite:false}));m.position.copy(sqPos(t.sq));m.position.y+=.008;this.markers.add(m)}
    }
  }
  // ---------- camera ----------
  _fit(){
    const a=this.camera.aspect;const vf=THREE.MathUtils.degToRad(this.camera.fov);const hf=2*Math.atan(Math.tan(vf/2)*a);
    const portrait=a<1;const m=this.camMode;
    const polar=m==='Top'?0.001:m==='Side'?1.15:1.2;
    const wfit=m==='Top'?(portrait?8.6:12):m==='Side'?(portrait?11.5:19.2):(portrait?9.3:19.2);
    const dW=(wfit/2)/Math.tan(hf/2)+(m==='Top'?0:portrait?1.2:0.5);
    const hfit=m==='Top'?(portrait?0:11):11*Math.cos(polar)+1.6*Math.sin(polar);
    const dH=(hfit/2)/Math.tan(vf/2)+(m==='Top'?0:1.5);
    let r=Math.max(dW,dH);if(m==='Side')r=Math.min(r,(ROOM.W/2-2)/Math.sin(polar)); // stay inside the chapel
    return {r,polar};
  }
  setCamMode(m){this.camMode=m;localStorage.setItem('camMode',m);this.setView(this.view.side)}
  setView(side,animate=true){
    this.view.side=side;if(this.seat&&this.camMode!=='Walk')this._endSeat();const m0=this.camMode;const c=this.controls;
    if(this.camMode==='Walk'){if(this.free)this._exitFree();if(!this.walk)this._enterWalk();return} // the pilgrim stays exactly where they are left
    if(this.walk)this._exitWalk();
    if(this.camMode==='Free cam'){if(!this.free)this._enterFree();return} // Free cam stays where the user left it
    if(this.free)this._exitFree();
    c.enableRotate=false;c.enablePan=false;c.zoomToCursor=false;c.minDistance=5;c.maxDistance=42;c.maxPolarAngle=1.4;
    c.target.set(0,0.3,0);const fov=m0==='Player'?48:m0==='Side'?58:36;this.camera.fov=fov;this._offset();
    const {r,polar}=this._fit();
    const theta=(side==='w'?0:Math.PI)+(this.camMode==='Side'?Math.PI/2:0);
    const target={r,phi:polar,theta};
    this.userOrbit=false;
    if(!animate||this.fast){this._applySph(target);return}
    const cur=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dt=theta-cur.theta;while(dt>Math.PI)dt-=2*Math.PI;while(dt<-Math.PI)dt+=2*Math.PI;
    this.camTween={from:{r:cur.radius,phi:cur.phi,theta:cur.theta},to:{r,phi:polar,theta:cur.theta+dt},t0:performance.now(),dur:400};
  }
  _offset(){const c=this.camera,el=this.renderer.domElement,w=el.clientWidth||1,h=el.clientHeight||1;if(this.camMode==='Player'&&c.aspect<1)c.setViewOffset(w,h,0,-h*.27,w,h);else c.clearViewOffset();c.updateProjectionMatrix()}
  introSweep(){}
  _applySph(s){this._placed=true;const v=new THREE.Vector3().setFromSphericalCoords(s.r,s.phi,s.theta);this.camera.position.copy(this.controls.target).add(v);this.camera.lookAt(this.controls.target);this.controls.update()}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.renderer.domElement.style.width=w+'px';this.renderer.domElement.style.height=h+'px';this.camera.aspect=w/h;this._offset();if(!this.walk&&!this.free&&!this.userOrbit&&!this.camTween&&this.view)this.setView(this.view.side,false)}
  // ---------- input ----------
  _bindInput(){
    const el=this.renderer.domElement;let down=null;const pts=new Map();this.keys=new Set();this.look={};
    const L=this.look,pd=()=>{const a=pts.get(L.id),b=pts.get(L.pinch);return a&&b?Math.hypot(a.x-b.x,a.y-b.y):0};
    el.addEventListener('pointerdown',e=>{if(e.isPrimary)pts.clear();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      down=pts.size>1?null:{x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}; // no taps from multi-touch gestures
      const F=this.free;if(F){try{el.setPointerCapture(e.pointerId)}catch(_){}
        if(pts.size>=2){const [a,b]=[...pts.values()];F.drag=null;F.two={d0:Math.hypot(a.x-b.x,a.y-b.y),dist0:F.distT,cx:(a.x+b.x)/2,cy:(a.y+b.y)/2}}
        else F.drag={id:e.pointerId,sx:e.clientX,sy:e.clientY,on:false,pan:e.button===2||e.shiftKey};return}
      if(!this.walk)return;this.walk.glide=null;try{el.setPointerCapture(e.pointerId)}catch(_){}
      if(L.id==null||!pts.has(L.id)){L.id=e.pointerId;L.pinch=null}
      else if(L.pinch==null){L.pinch=e.pointerId;L.d0=pd();L.f0=this.walk.fovTo}});
    el.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;
      const dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;const F=this.free;
      if(F){if(F.two&&pts.size>=2){const [a,b]=[...pts.values()],d=Math.hypot(a.x-b.x,a.y-b.y),cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
          if(F.two.d0>20&&d>20){F.glide=null;F.distT=THREE.MathUtils.clamp(F.two.dist0*F.two.d0/d,F.dmin,150)} // pinch = dolly
          this._freePan(cx-F.two.cx,cy-F.two.cy);F.two.cx=cx;F.two.cy=cy;return} // two-finger drag = pan
        const D=F.drag;if(!D||D.id!==e.pointerId)return;
        if(!D.on){if(Math.hypot(e.clientX-D.sx,e.clientY-D.sy)<7)return;D.on=true} // small wobble = still a tap
        if(D.pan)this._freePan(dx,dy);else this._freeOrbit(dx,dy);return}
      const w=this.walk;if(!w)return;
      if(L.pinch!=null){if(L.d0>0){const d=pd();if(d>0)w.fovTo=THREE.MathUtils.clamp(L.f0*L.d0/d,15,75)}return} // pinch = optical zoom
      if(e.pointerId!==L.id)return;
      const k=.0052*(w.fov/70); // finer look when zoomed in
      w.yawT-=dx*k;w.pitchT=THREE.MathUtils.clamp(w.pitchT-dy*k,THREE.MathUtils.degToRad(-85),THREE.MathUtils.degToRad(89))});
    const up=e=>{pts.delete(e.pointerId);const F=this.free;
      if(F){if(pts.size<2)F.two=null;if(F.drag&&F.drag.id===e.pointerId)F.drag=null;if(pts.size===1&&!F.drag){const [id]=pts.keys();F.drag={id,sx:0,sy:0,on:true,pan:false}}}if(e.pointerId===L.pinch)L.pinch=null;else if(e.pointerId===L.id){L.id=L.pinch!=null?L.pinch:null;L.pinch=null}};
    el.addEventListener('pointerup',e=>{up(e);if(!down||down.id!==e.pointerId){down=null;return}const dx=e.clientX-down.x,dy=e.clientY-down.y;
      if(Math.hypot(dx,dy)<10&&performance.now()-down.t<600){if(this.seat&&this._hitChair(e.clientX,e.clientY)){this.sitDown();down=null;return}const sq=this.pick(e.clientX,e.clientY);if(sq)this.onTap(sq)}down=null});
    el.addEventListener('pointercancel',e=>{up(e);down=null});
    el.addEventListener('wheel',e=>{if(this.free){e.preventDefault();const dy=e.deltaMode===1?e.deltaY*33:e.deltaY;this._freeDolly(Math.exp(THREE.MathUtils.clamp(dy,-300,300)*.0015));return}
      if(!this.walk)return;e.preventDefault();const dy=e.deltaMode===1?e.deltaY*33:e.deltaY;
      this.walk.fovTo=THREE.MathUtils.clamp(this.walk.fovTo*Math.exp(THREE.MathUtils.clamp(dy,-300,300)*.0025),15,75)},{passive:false});
    el.addEventListener('contextmenu',e=>{if(this.walk||this.free)e.preventDefault()});
    const MOVE=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
    window.addEventListener('keydown',e=>{if(this.free&&!/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||'')){if(e.key==='+'||e.key==='=')this.zoom(.8);else if(e.key==='-')this.zoom(1.25);return}
      if(!this.walk||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))return;
      if(MOVE.includes(e.code)){this.keys.add(e.code);if(e.code.startsWith('Arrow'))e.preventDefault()}
      else if(e.key==='+'||e.key==='=')this.zoom(.8);else if(e.key==='-')this.zoom(1.25)});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.keys.clear());
  }
  _hitChair(cx,cy){const rc=this.renderer.domElement.getBoundingClientRect();this.ray.setFromCamera(new THREE.Vector2(((cx-rc.left)/rc.width)*2-1,-((cy-rc.top)/rc.height)*2+1),this.camera);
    const h=this.ray.intersectObjects(this.chairMeshes,false);return h.length&&h[0].object.userData.chair===this.seat.side}
  pick(cx,cy){
    const rc=this.renderer.domElement.getBoundingClientRect();
    const v=new THREE.Vector2(((cx-rc.left)/rc.width)*2-1,-((cy-rc.top)/rc.height)*2+1);
    this.ray.setFromCamera(v,this.camera);
    const onBoard=this.pieces.filter(p=>p.userData.square);
    const hp=this.ray.intersectObjects(onBoard,false);
    const h=this.ray.intersectObject(this.pickPlane,false);let sq=null;
    if(h.length){const p=h[0].point;const f=Math.floor(p.x+4),r=8-Math.floor(p.z+4);if(f>=0&&f<8&&r>=1&&r<=8)sq=FILES[f]+r}
    if(hp.length){const ps=hp[0].object.userData.square,isT=s=>s&&(this.targets||[]).includes(s);
      return isT(sq)&&!isT(ps)?sq:ps} // a move dot hidden behind a nearer piece still counts (low walk / free-cam angles)
    return sq;
  }
  squareToScreen(sq){const p=sqPos(sq).project(this.camera);const rc=this.renderer.domElement.getBoundingClientRect();return {x:rc.left+(p.x+1)/2*rc.width,y:rc.top+(1-p.y)/2*rc.height}}
  _tick(now){
    if(!this.walk&&!this.free&&this.camTween){const c=this.camTween;const t=Math.min(1,Math.max(0,(now-c.t0)/c.dur));const e=easeIO(t);
      this._applySph({r:c.from.r+(c.to.r-c.from.r)*e,phi:c.from.phi+(c.to.phi-c.from.phi)*e,theta:c.from.theta+(c.to.theta-c.from.theta)*e});if(t>=1)this.camTween=null}
    const list=this.tweens;this.tweens=[];const keep=[];
    for(const tw of list){const t=Math.min(1,(now-tw.t0)/tw.dur);
      if(tw.scale){tw.obj.scale.setScalar(Math.max(.01,easeIO(t)));}
      else{const e=easeIO(t);tw.obj.position.lerpVectors(tw.from,tw.to,e);tw.obj.position.y=tw.from.y+(tw.to.y-tw.from.y)*e+Math.sin(Math.PI*t)*tw.hop}
      if(t>=1){tw.done&&tw.done()}else keep.push(tw)}
    const fresh=this.tweens;this.tweens=keep.filter(k=>!fresh.some(f=>f.obj===k.obj)).concat(fresh);
    this._seatGlow(now);
    if(this.walk)this._walkStep(now);else if(this.free)this._freeStep(now);else this.controls.update();
    this._lastT=now;
    this.renderer.render(this.scene,this.camera);
  }
  get busy(){return this.tweens.length>0}
}
