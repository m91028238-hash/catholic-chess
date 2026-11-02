// The marble-and-gold table under the board (the surroundings are the Sistine Chapel, see sistine.js).
import * as THREE from 'three';
import { canvasTex } from './textures.js?v=18';

export const FLOOR=-2.05; // table top (y=0) 0.79 m above the chapel floor (2.6 units per metre)
const cv=(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return [c,c.getContext('2d')]};
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
function veins(g,w,h,col,n){g.strokeStyle=col;for(let i=0;i<n;i++){g.lineWidth=.5+rnd()*1.5;g.beginPath();let x=rnd()*w,y=rnd()*h;g.moveTo(x,y);for(let k=0;k<8;k++){x+=(rnd()-.4)*w*.15;y+=(rnd()-.5)*h*.12;g.lineTo(x,y)}g.stroke()}}
function marbleCanvas(w,h,base,vein){const [c,g]=cv(w,h);g.fillStyle=base;g.fillRect(0,0,w,h);veins(g,w,h,vein,Math.round(w*h/6000));return c}
// The stately table the board sits on (top surface at y=0): verde antico top, gilded edge, marble pedestal.
export function buildPlinth(scene,{env}){
  const g=new THREE.Group();scene.add(g);
  const vt=canvasTex(marbleCanvas(512,512,'#1f3a30','rgba(170,200,170,.22)'));vt.repeat.set(1.2,.85);
  const top=new THREE.Mesh(new THREE.BoxGeometry(13.4,.5,9.4),new THREE.MeshPhysicalMaterial({map:vt,roughness:.25,clearcoat:.6,clearcoatRoughness:.2}));top.position.y=-.25;top.receiveShadow=true;g.add(top);
  const gold=new THREE.MeshStandardMaterial({color:0xd8aa48,metalness:1,roughness:.3,envMap:env,envMapIntensity:1.4});
  const rim=new THREE.Mesh(new THREE.BoxGeometry(13.7,.16,9.7),gold);rim.position.y=-.42;g.add(rim);
  const pt=canvasTex(marbleCanvas(512,512,'#e2d5bc','rgba(140,120,95,.25)'));
  const ped=new THREE.Mesh(new THREE.BoxGeometry(11.6,-.5-(FLOOR+.3),7.8),new THREE.MeshStandardMaterial({map:pt,roughness:.4,emissive:0xffffff,emissiveMap:pt,emissiveIntensity:.04}));ped.position.y=(FLOOR+.3-.5)/2;g.add(ped);
  const step=new THREE.Mesh(new THREE.BoxGeometry(12.6,.3,8.8),new THREE.MeshStandardMaterial({color:0x8c867c,roughness:.5}));step.position.y=FLOOR+.15;g.add(step);
  return g;
}
