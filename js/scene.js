// three.js scene: board, pieces, lights, camera, picking and animation.
import * as THREE from 'three';
import { OrbitControls, RoomEnvironment } from 'three';
import { BOARD, buildBoardTextures, woodCanvas, canvasTex, loadImage } from './textures.js?v=8';
import { pieceGeometries } from './pieces.js?v=8';
import { buildPlinth } from './basilica.js?v=8';
import { Sistine, ROOM, ceilingAt, VAULT } from './sistine.js?v=8';

const TOP=0.32;
const FILES='abcdefgh';
export const sqPos=(sq)=>new THREE.Vector3(FILES.indexOf(sq[0])-3.5,TOP,4.5-(+sq[1]));
const easeIO=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

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
    this.camera=new THREE.PerspectiveCamera(36,1,0.1,420);
    const ctl=this.controls=new OrbitControls(this.camera,r.domElement);
    ctl.enableDamping=true;ctl.dampingFactor=.12;ctl.enablePan=false;ctl.minDistance=5;ctl.maxDistance=42;
    ctl.enableRotate=false;ctl.maxPolarAngle=1.4;ctl.minPolarAngle=0.02;this.camMode=localStorage.getItem('camMode')||'Player';ctl.target.set(0,0.3,0);ctl.rotateSpeed=.7;
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
    // Free cam: compact quick-jump strip (scrolls sideways), collapsible
    const a=this.artUI=document.createElement('div');a.className='artui';a.hidden=true;
    if(localStorage.getItem('artOpen')==='0')a.classList.add('shut');
    a.innerHTML='<button class="tog" data-k="tog">Artworks</button><button data-k="reset">Reset view</button>'+
      this.room.artworks().map(o=>`<button data-k="${o.id}">${o.name}</button>`).join('');
    a.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.k;
      if(k==='tog'){a.classList.toggle('shut');localStorage.setItem('artOpen',a.classList.contains('shut')?'0':'1')}
      else if(k==='reset')this.resetFree();else this.flyToArt(k)});
    this.host.appendChild(a);
  }
  zoom(f){ // Free cam: optical zoom (field of view), down to 10° for fine detail
    if(!this.fly)return;this.fly.fovTo=THREE.MathUtils.clamp(this.fly.fovTo*f,10,75)}
  // ---------- free (fly/look) camera ----------
  _enterFree(){
    this.controls.enabled=false;this.camTween=null;const c=this.camera;
    if(!this._placed){c.position.set(0,9,this.view.side==='b'?-17:17);c.lookAt(0,.3,0)}
    const e=new THREE.Euler().setFromQuaternion(c.quaternion,'YXZ');
    this.fly={yaw:e.y,pitch:e.x,fov:60,fovTo:60,tw:null};c.rotation.order='YXZ';c.fov=60;this._offset();
    this.zoomUI.hidden=this.artUI.hidden=false;this._applyFly();
  }
  _exitFree(){this.fly=null;this.keys.clear();this.controls.enabled=true;this.camera.rotation.order='XYZ';this.zoomUI.hidden=this.artUI.hidden=true}
  _homePose(){const s=this.view.side==='b'?-1:1;const p=new THREE.Vector3(0,9,17*s);const d=new THREE.Vector3(0,.3,0).sub(p);
    return {p,yaw:Math.atan2(-d.x,-d.z),pitch:Math.atan2(d.y,Math.hypot(d.x,d.z)),fov:60}}
  resetFree(){if(this.fly)this._flyTo(this._homePose())}
  flyToArt(id){if(!this.fly)return;const o=this.room.artworks().find(a=>a.id===id);if(!o)return;
    const vf=THREE.MathUtils.degToRad(60)/2,hf=Math.atan(Math.tan(vf)*this.camera.aspect);
    const whole=Math.max(o.h/2/Math.tan(vf),o.w/2/Math.tan(hf))*1.06,d=Math.min(whole,o.h/2/Math.tan(vf)*1.6);
    this._flyTo({p:o.c.clone().addScaledVector(o.n,d),yaw:o.yaw,pitch:o.pitch,fov:60})}
  _flyTo(to){const f=this.fly;to.p=this._clampPos(to.p.clone());
    let dy=to.yaw-f.yaw;while(dy>Math.PI)dy-=2*Math.PI;while(dy<-Math.PI)dy+=2*Math.PI;
    const dist=this.camera.position.distanceTo(to.p);
    f.tw={from:{p:this.camera.position.clone(),yaw:f.yaw,pitch:f.pitch,fov:f.fov},to:{p:to.p,yaw:f.yaw+dy,pitch:to.pitch,fov:to.fov},t0:performance.now(),dur:THREE.MathUtils.clamp(500+dist*14,600,1500)}}
  _clampPos(p){ // anywhere inside the chapel, ~0.3 m from walls, floor and vault
    const M=.3*2.6,X=ROOM.W/2-M,Z=ROOM.L/2-M,cl=(v,a,b)=>Math.max(a,Math.min(b,v));
    p.x=cl(p.x,-X,X);p.z=cl(p.z,-Z,Z);p.y=Math.max(p.y,ROOM.y0+M);
    const dy=p.y-VAULT.YC,r=Math.hypot(p.x,dy),R=VAULT.R-M;if(dy>0&&r>R){p.x*=R/r;p.y=VAULT.YC+dy*R/r}
    return p}
  _applyFly(){const f=this.fly,c=this.camera;f.pitch=THREE.MathUtils.clamp(f.pitch,-Math.PI/2+1e-3,Math.PI/2-1e-3);
    this._clampPos(c.position);c.rotation.set(f.pitch,f.yaw,0,'YXZ');if(c.fov!==f.fov){c.fov=f.fov;c.updateProjectionMatrix()}}
  _focusDist(){ // distance to whatever is in the middle of the view (for natural pan / dolly speeds)
    this.ray.setFromCamera(new THREE.Vector2(0,0),this.camera);const h=this.ray.intersectObject(this.room.g,true);return h.length?h[0].distance:20}
  _flyLook(dx,dy){const f=this.fly,k=THREE.MathUtils.degToRad(f.fov)/(this.renderer.domElement.clientHeight||1);f.tw=null;f.yaw+=dx*k;f.pitch+=dy*k}
  _flyPan(dx,dy){const f=this.fly,c=this.camera;f.tw=null;const d=Math.max(this._focusDist(),1.5);
    const wpp=2*d*Math.tan(THREE.MathUtils.degToRad(f.fov)/2)/(this.renderer.domElement.clientHeight||1);
    const R=new THREE.Vector3(1,0,0).applyQuaternion(c.quaternion),U=new THREE.Vector3(0,1,0).applyQuaternion(c.quaternion);
    c.position.addScaledVector(R,-dx*wpp).addScaledVector(U,dy*wpp)}
  _flyDolly(amt){this.fly.tw=null;const F=new THREE.Vector3();this.camera.getWorldDirection(F);this.camera.position.addScaledVector(F,amt)}
  _flyStep(now){const f=this.fly,c=this.camera,dt=Math.min(.1,(now-(this._lastT||now))/1000);
    if(f.tw){const w=f.tw,t=Math.min(1,Math.max(0,(now-w.t0)/w.dur)),e=easeIO(t);
      c.position.lerpVectors(w.from.p,w.to.p,e);f.yaw=w.from.yaw+(w.to.yaw-w.from.yaw)*e;f.pitch=w.from.pitch+(w.to.pitch-w.from.pitch)*e;
      f.fov=f.fovTo=w.from.fov+(w.to.fov-w.from.fov)*e;if(t>=1)f.tw=null}
    else if(Math.abs(f.fovTo-f.fov)>.01)f.fov+=(f.fovTo-f.fov)*Math.min(1,dt*12);else f.fov=f.fovTo;
    const K=this.keys;if(K.size){f.tw=null;const has=(...a)=>a.some(k=>K.has(k));
      const v=new THREE.Vector3((has('KeyD','ArrowRight')?1:0)-(has('KeyA','ArrowLeft')?1:0),(has('KeyE','PageUp')?1:0)-(has('KeyQ','PageDown')?1:0),(has('KeyS','ArrowDown')?1:0)-(has('KeyW','ArrowUp')?1:0));
      if(v.lengthSq()){const sp=(K.has('ShiftLeft')||K.has('ShiftRight')?24:8)*dt;const up=v.y;v.y=0;v.applyQuaternion(c.quaternion);v.y+=up;c.position.addScaledVector(v.normalize(),sp)}}
    this._applyFly()}
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
  gravePos(color,idx){ // captured pieces rest on the table in front of the capturer
    const side=color==='w'?-1:1; // white pieces captured -> black's side
    const row=Math.floor(idx/8),col=idx%8;
    return new THREE.Vector3((col-3.5)*0.62*side,0,side*-1*(5.15+row*0.62));
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
    this.clearMarkers();
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
    this.view.side=side;const m0=this.camMode;const free=this.camMode==='Free',c=this.controls;
    if(free){if(!this.fly)this._enterFree();return} // free cam stays exactly where the player leaves it
    if(this.fly)this._exitFree();
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
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.renderer.domElement.style.width=w+'px';this.renderer.domElement.style.height=h+'px';this.camera.aspect=w/h;this._offset();if(!this.fly&&!this.userOrbit&&!this.camTween&&this.view)this.setView(this.view.side,false)}
  // ---------- input ----------
  _bindInput(){
    const el=this.renderer.domElement;let down=null;const pts=new Map();this.keys=new Set();
    const geo=()=>{const a=[...pts.values()];if(a.length<2)return null;return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,d:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}};
    el.addEventListener('pointerdown',e=>{if(e.isPrimary)pts.clear();pts.set(e.pointerId,{x:e.clientX,y:e.clientY});
      down=pts.size>1?null:{x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}; // no taps from multi-touch gestures
      if(this.fly){this.fly.tw=null;try{el.setPointerCapture(e.pointerId)}catch(_){}}});
    el.addEventListener('pointermove',e=>{const p=pts.get(e.pointerId);if(!p)return;
      const g0=geo(),dx=e.clientX-p.x,dy=e.clientY-p.y;p.x=e.clientX;p.y=e.clientY;if(!this.fly)return;
      if(pts.size===1){if(e.pointerType==='mouse'&&(e.buttons&6))this._flyPan(dx,dy);else this._flyLook(dx,dy)}
      else{const g1=geo();if(!g0||!g0.d)return;this._flyPan((g1.x-g0.x),(g1.y-g0.y));
        const r=THREE.MathUtils.clamp(g1.d/g0.d,.5,2);this._flyDolly(Math.max(this._focusDist(),2)*(1-1/r))}});
    const up=e=>{pts.delete(e.pointerId)};
    el.addEventListener('pointerup',e=>{up(e);if(!down||down.id!==e.pointerId){down=null;return}const dx=e.clientX-down.x,dy=e.clientY-down.y;
      if(Math.hypot(dx,dy)<10&&performance.now()-down.t<600){const sq=this.pick(e.clientX,e.clientY);if(sq)this.onTap(sq)}down=null});
    el.addEventListener('pointercancel',e=>{up(e);down=null});
    el.addEventListener('wheel',e=>{if(!this.fly)return;e.preventDefault();const f=this.fly,dy=e.deltaMode===1?e.deltaY*33:e.deltaY;
      if(e.ctrlKey||e.shiftKey||e.altKey)f.fovTo=THREE.MathUtils.clamp(f.fovTo*Math.exp(dy*.0025),10,75); // trackpad pinch / modifier + wheel = optical zoom
      else this._flyDolly(-THREE.MathUtils.clamp(dy,-300,300)*.0015*Math.max(this._focusDist(),2))},{passive:false});
    el.addEventListener('contextmenu',e=>{if(this.fly)e.preventDefault()});
    const MOVE=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','PageUp','PageDown','ShiftLeft','ShiftRight'];
    window.addEventListener('keydown',e=>{if(!this.fly||e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA|SELECT/.test((e.target&&e.target.tagName)||''))return;
      if(MOVE.includes(e.code)){this.keys.add(e.code);if(e.code.startsWith('Arrow')||e.code.startsWith('Page'))e.preventDefault()}
      else if(e.key==='+'||e.key==='=')this.zoom(.8);else if(e.key==='-')this.zoom(1.25)});
    window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('blur',()=>this.keys.clear());
  }
  pick(cx,cy){
    const rc=this.renderer.domElement.getBoundingClientRect();
    const v=new THREE.Vector2(((cx-rc.left)/rc.width)*2-1,-((cy-rc.top)/rc.height)*2+1);
    this.ray.setFromCamera(v,this.camera);
    const onBoard=this.pieces.filter(p=>p.userData.square);
    const hp=this.ray.intersectObjects(onBoard,false);
    if(hp.length)return hp[0].object.userData.square;
    const h=this.ray.intersectObject(this.pickPlane,false);
    if(h.length){const p=h[0].point;const f=Math.floor(p.x+4),r=8-Math.floor(p.z+4);if(f>=0&&f<8&&r>=1&&r<=8)return FILES[f]+r}
    return null;
  }
  squareToScreen(sq){const p=sqPos(sq).project(this.camera);const rc=this.renderer.domElement.getBoundingClientRect();return {x:rc.left+(p.x+1)/2*rc.width,y:rc.top+(1-p.y)/2*rc.height}}
  _tick(now){
    if(!this.fly&&this.camTween){const c=this.camTween;const t=Math.min(1,Math.max(0,(now-c.t0)/c.dur));const e=easeIO(t);
      this._applySph({r:c.from.r+(c.to.r-c.from.r)*e,phi:c.from.phi+(c.to.phi-c.from.phi)*e,theta:c.from.theta+(c.to.theta-c.from.theta)*e});if(t>=1)this.camTween=null}
    const list=this.tweens;this.tweens=[];const keep=[];
    for(const tw of list){const t=Math.min(1,(now-tw.t0)/tw.dur);
      if(tw.scale){tw.obj.scale.setScalar(Math.max(.01,easeIO(t)));}
      else{const e=easeIO(t);tw.obj.position.lerpVectors(tw.from,tw.to,e);tw.obj.position.y=tw.from.y+(tw.to.y-tw.from.y)*e+Math.sin(Math.PI*t)*tw.hop}
      if(t>=1){tw.done&&tw.done()}else keep.push(tw)}
    const fresh=this.tweens;this.tweens=keep.filter(k=>!fresh.some(f=>f.obj===k.obj)).concat(fresh);
    if(this.fly)this._flyStep(now);else this.controls.update();
    this._lastT=now;
    this.renderer.render(this.scene,this.camera);
  }
  get busy(){return this.tweens.length>0}
}
