// three.js scene: board, pieces, lights, camera, picking and animation.
import * as THREE from 'three';
import { OrbitControls, RoomEnvironment } from 'three';
import { BOARD, buildBoardTextures, woodCanvas, canvasTex, loadImage } from './textures.js?v=6';
import { pieceGeometries } from './pieces.js?v=6';
import { buildPlinth } from './basilica.js?v=6';
import { Scenery } from './scenery.js?v=6';

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
    ctl.enableRotate=(localStorage.getItem('camMode')==='Free');ctl.maxPolarAngle=1.4;ctl.minPolarAngle=0.02;this.camMode=localStorage.getItem('camMode')||'Player';ctl.target.set(0,0.3,0);ctl.rotateSpeed=.7;
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
    this.scenery=new Scenery(sc,r,{mobile});
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
    this.setSetting(this.settingId||'basilica');
    setTimeout(()=>this.scenery.buildArt(this.env),300); // lazy: after the board is up
  }
  setSetting(id){this.settingId=id;return this.scenery.set(id).catch(e=>console.warn('panorama',e))}
  _buildZoomUI(){
    const w=this.zoomUI=document.createElement('div');w.className='zoomui';w.hidden=true;
    w.innerHTML='<button aria-label="Zoom in" data-z="0.7">+</button><button aria-label="Zoom out" data-z="1.43">−</button>';
    w.addEventListener('click',e=>{const b=e.target.closest('button');if(b)this.zoom(+b.dataset.z)});
    this.host.appendChild(w);
  }
  zoom(f){const c=this.controls;const cur=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(c.target));
    const r=THREE.MathUtils.clamp(cur.radius*f,c.minDistance,c.maxDistance);this.userOrbit=true;
    this.camTween={from:{r:cur.radius,phi:cur.phi,theta:cur.theta},to:{r,phi:cur.phi,theta:cur.theta},t0:performance.now(),dur:260}}
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
    const polar=m==='Top'?0.001:m==='Side'?1.15:1.08;
    const wfit=m==='Top'?(portrait?8.6:12):m==='Side'?(portrait?11.5:19.2):(portrait?9.3:19.2);
    const dW=(wfit/2)/Math.tan(hf/2)+(m==='Top'?0:portrait?1.2:0.5);
    const hfit=m==='Top'?(portrait?0:11):11*Math.cos(polar)+1.6*Math.sin(polar);
    const dH=(hfit/2)/Math.tan(vf/2)+(m==='Top'?0:1.5);
    return {r:Math.max(dW,dH),polar};
  }
  setCamMode(m){this.camMode=m;localStorage.setItem('camMode',m);this.setView(this.view.side)}
  setView(side,animate=true){
    this.view.side=side;const m0=this.camMode;const free=this.camMode==='Free',c=this.controls;c.enableRotate=free;c.enablePan=free;c.zoomToCursor=free;
    c.minDistance=free?1.6:5;c.maxDistance=free?34:42;c.maxPolarAngle=free?Math.PI-0.02:1.4;c.panSpeed=1.2;
    if(!free||!this._wasFree)c.target.set(0,0.3,0);this._wasFree=free;if(this.zoomUI)this.zoomUI.hidden=!free;const fov=free?60:(m0==='Player'?44:36);this.camera.fov=fov;this._offset();
    const {r,polar}=this._fit();
    const theta=(side==='w'?0:Math.PI)+(this.camMode==='Side'?Math.PI/2:0);
    const target={r,phi:polar,theta};
    this.userOrbit=false;
    if(!animate||this.fast){this._applySph(target);return}
    const cur=new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    let dt=theta-cur.theta;while(dt>Math.PI)dt-=2*Math.PI;while(dt<-Math.PI)dt+=2*Math.PI;
    this.camTween={from:{r:cur.radius,phi:cur.phi,theta:cur.theta},to:{r,phi:polar,theta:cur.theta+dt},t0:performance.now(),dur:400};
  }
  _offset(){const c=this.camera,el=this.renderer.domElement,w=el.clientWidth||1,h=el.clientHeight||1;if(this.camMode==='Player'&&c.aspect<1)c.setViewOffset(w,h,0,-h*.2,w,h);else c.clearViewOffset();c.updateProjectionMatrix()}
  introSweep(){}
  _applySph(s){const v=new THREE.Vector3().setFromSphericalCoords(s.r,s.phi,s.theta);this.camera.position.copy(this.controls.target).add(v);this.camera.lookAt(this.controls.target);this.controls.update()}
  resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.renderer.domElement.style.width=w+'px';this.renderer.domElement.style.height=h+'px';this.camera.aspect=w/h;this._offset();if(!this.userOrbit&&!this.camTween&&this.view)this.setView(this.view.side,false)}
  // ---------- input ----------
  _bindInput(){
    const el=this.renderer.domElement;let down=null;
    el.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,t:performance.now(),id:e.pointerId}});
    el.addEventListener('pointerup',e=>{if(!down)return;const dx=e.clientX-down.x,dy=e.clientY-down.y;
      if(Math.hypot(dx,dy)<10&&performance.now()-down.t<600){const sq=this.pick(e.clientX,e.clientY);if(sq)this.onTap(sq)}down=null});
    el.addEventListener('pointercancel',()=>down=null);
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
    if(this.camTween){const c=this.camTween;const t=Math.min(1,Math.max(0,(now-c.t0)/c.dur));const e=easeIO(t);
      this._applySph({r:c.from.r+(c.to.r-c.from.r)*e,phi:c.from.phi+(c.to.phi-c.from.phi)*e,theta:c.from.theta+(c.to.theta-c.from.theta)*e});if(t>=1)this.camTween=null}
    const list=this.tweens;this.tweens=[];const keep=[];
    for(const tw of list){const t=Math.min(1,(now-tw.t0)/tw.dur);
      if(tw.scale){tw.obj.scale.setScalar(Math.max(.01,easeIO(t)));}
      else{const e=easeIO(t);tw.obj.position.lerpVectors(tw.from,tw.to,e);tw.obj.position.y=tw.from.y+(tw.to.y-tw.from.y)*e+Math.sin(Math.PI*t)*tw.hop}
      if(t>=1){tw.done&&tw.done()}else keep.push(tw)}
    const fresh=this.tweens;this.tweens=keep.filter(k=>!fresh.some(f=>f.obj===k.obj)).concat(fresh);
    this.controls.update();
    if(this.camMode==='Free'){const p=this.camera.position,t=this.controls.target;
      // keep the eye above the table: when looking up, lift the pivot with the camera so the view turns to the vault/dome
      const lift=1.4-p.y;if(lift>0){p.y+=lift;t.y+=lift}
      else if(t.y>0.3&&p.y>t.y){const d=Math.min(t.y-0.3,-lift);p.y-=d;t.y-=d}
      const R=Math.hypot(t.x,t.z);if(R>16){t.x*=16/R;t.z*=16/R}t.y=Math.min(t.y,30);
      const Rc=Math.hypot(p.x,p.z);if(Rc>30){p.x*=30/Rc;p.z*=30/Rc}p.y=Math.min(p.y,32)}
    this.scenery.aim(this.camera,{Player:.38,Side:.3,Top:0}[this.camMode]||0);
    this.renderer.render(this.scene,this.camera);
  }
  get busy(){return this.tweens.length>0}
}
