// Real 360° panoramas (Wikimedia Commons) as the surroundings, plus real paintings on easels.
import * as THREE from 'three';
import { canvasTex } from './textures.js?v=6';

export const FLOOR=-3.5;
// yaw: rotates the panorama so its main view sits behind the board from White's seat.
export const SETTINGS=[
  {id:'basilica',name:'St Peter’s Basilica',file:'basilica',big:true,yaw:1.7,art:true,floor:'#b9a98c'},
  {id:'portico',name:'St Peter’s portico',file:'portico',big:true,yaw:0.6,art:true,floor:'#a9a092'},
  {id:'square',name:'St Peter’s Square',file:'square',big:true,yaw:0,art:false,floor:'#9c968c'},
  {id:'gethsemane',name:'Gethsemane, Church of All Nations',file:'gethsemane',big:false,yaw:1.57,art:true,floor:'#6f7690'},
];
export const ART=[
  {f:'transfiguration',t:'The Transfiguration',a:'Raphael',w:679,h:1024,x:-15,z:-5},
  {f:'keys',t:'Delivery of the Keys',a:'Pietro Perugino',w:1024,h:634,x:-15,z:5},
  {f:'crucifixion',t:'Crucifixion of St Peter',a:'Caravaggio',w:795,h:1024,x:15,z:-7},
  {f:'sistine',t:'The Sistine Madonna',a:'Raphael',w:747,h:1024,x:15,z:1},
  {f:'adam',t:'The Creation of Adam',a:'Michelangelo',w:1024,h:465,x:15,z:9},
];

export class Scenery{
  constructor(scene,renderer,{mobile}){
    this.scene=scene;this.r=renderer;this.mobile=mobile;this.cache={};this.pm=new THREE.PMREMGenerator(renderer);
    this.small=mobile||renderer.capabilities.maxTextureSize<4096;
    // soft marble floor disc that fades into the photo's own floor
    const [c,g]=(()=>{const c=document.createElement('canvas');c.width=c.height=256;return [c,c.getContext('2d')]})();
    const gr=g.createRadialGradient(128,128,20,128,128,128);gr.addColorStop(0,'#fff');gr.addColorStop(.55,'#bbb');gr.addColorStop(1,'#000');g.fillStyle=gr;g.fillRect(0,0,256,256);
    this.floorMat=new THREE.MeshStandardMaterial({color:0xb9a98c,roughness:.5,transparent:true,alphaMap:canvasTex(c,{srgb:false}),depthWrite:false});
    const fl=new THREE.Mesh(new THREE.CircleGeometry(34,48).rotateX(-Math.PI/2),this.floorMat);fl.position.y=FLOOR-.01;fl.receiveShadow=true;fl.renderOrder=-1;scene.add(fl);
    this.art=new THREE.Group();scene.add(this.art);
  }
  async set(id){
    const s=SETTINGS.find(x=>x.id===id)||SETTINGS[0];this.cur=s.id;
    this.art.visible=s.art;this.floorMat.color.set(s.floor);
    let e=this.cache[s.id];
    if(!e){const url=`assets/pano/${s.file}-${s.big&&!this.small?4096:2048}.jpg?v=6`;
      const tex=await new THREE.TextureLoader().loadAsync(url);
      tex.mapping=THREE.EquirectangularReflectionMapping;tex.colorSpace=THREE.SRGBColorSpace;
      e=this.cache[s.id]={tex,env:this.pm.fromEquirectangular(tex).texture}}
    if(this.cur!==s.id)return;
    const sc=this.scene;sc.background=e.tex;sc.environment=e.env;sc.environmentIntensity=.55;sc.backgroundIntensity=1;
    this.yaw=s.yaw;sc.environmentRotation.set(0,s.yaw,0);sc.fog=null;this.aim(this._cam||null,this._pitch||0);
  }
  // Fixed views look down at the board, so the photo is tilted about the camera's right axis to keep the
  // room's horizon just behind the board (seated eye level); Free mode shows the panorama untilted.
  aim(camera,pitch){this._cam=camera;this._pitch=pitch;
    // the background shader samples transpose(R(backgroundRotation)) * viewDir; we want Ry(-yaw)*Rpitch*viewDir
    const q=new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),this.yaw||0);
    if(camera&&pitch){const r=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);r.y=0;r.normalize();q.premultiply(new THREE.Quaternion().setFromAxisAngle(r,-pitch))}
    this.scene.backgroundRotation.setFromQuaternion(q,'XYZ')}
  // real paintings in gilded frames on easels, with brass plaques; loaded after the board is up
  buildArt(env){
    const gold=new THREE.MeshStandardMaterial({color:0xd4a64a,metalness:1,roughness:.32,envMap:env,envMapIntensity:1.3});
    const wood=new THREE.MeshStandardMaterial({color:0x4a2e1a,roughness:.6});
    const loader=new THREE.TextureLoader();
    for(const p of ART){
      const g=new THREE.Group();g.position.set(p.x,FLOOR,p.z);g.lookAt(0,FLOOR,p.z*.35);this.art.add(g);
      const H=p.h>p.w?6.2:4.2,W=H*p.w/p.h,cy=3.4+H/2,tilt=-.08;
      const canv=new THREE.Group();canv.position.set(0,cy,0);canv.rotation.x=tilt;g.add(canv);
      const mat=new THREE.MeshStandardMaterial({color:0xfff4e0,roughness:.7,emissive:0xffffff,emissiveIntensity:.12});
      loader.load(`assets/art/${p.f}.jpg?v=6`,t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;mat.map=t;mat.emissiveMap=t;mat.needsUpdate=true});
      const pic=new THREE.Mesh(new THREE.PlaneGeometry(W,H),mat);pic.position.z=.12;canv.add(pic);
      const F=.42;for(const [w,h,x,y] of [[W+2*F,F,0,H/2+F/2],[W+2*F,F,0,-H/2-F/2],[F,H,W/2+F/2,0],[F,H,-W/2-F/2,0]]){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,.3),gold);b.position.set(x,y,.1);b.castShadow=true;canv.add(b)}
      const back=new THREE.Mesh(new THREE.BoxGeometry(W+.2,H+.2,.06),wood);canv.add(back);
      // easel: two front legs, a rear leg, a ledge
      const legH=cy+H/2+.6;
      for(const s of [-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.22,legH,.22),wood);l.position.set(s*W*.32,legH/2,-.2);l.rotation.z=s*.05;l.castShadow=true;g.add(l)}
      const rl=new THREE.Mesh(new THREE.BoxGeometry(.2,legH,.2),wood);rl.position.set(0,legH/2-.1,-1.1);rl.rotation.x=-.28;g.add(rl);
      const ledge=new THREE.Mesh(new THREE.BoxGeometry(W*.9,.25,.6),wood);ledge.position.set(0,cy-H/2-F-.12,.25);g.add(ledge);
      // brass plaque
      const c=document.createElement('canvas');c.width=512;c.height=112;const x=c.getContext('2d');
      const gr=x.createLinearGradient(0,0,0,112);gr.addColorStop(0,'#e8c878');gr.addColorStop(.5,'#b08a3e');gr.addColorStop(1,'#d8b464');x.fillStyle=gr;x.fillRect(0,0,512,112);
      x.strokeStyle='#5a3e18';x.lineWidth=4;x.strokeRect(6,6,500,100);x.fillStyle='#2e1e0a';x.textAlign='center';
      x.font='bold 34px Georgia,serif';x.fillText(p.t,256,50);x.font='italic 28px Georgia,serif';x.fillText(p.a,256,88);
      const pl=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.57),new THREE.MeshStandardMaterial({map:canvasTex(c),metalness:.5,roughness:.4,emissive:0xffffff,emissiveMap:canvasTex(c),emissiveIntensity:.25}));
      pl.position.set(0,cy-H/2-F-.12,.78);pl.rotation.x=-.35;g.add(pl);
    }
  }
}
