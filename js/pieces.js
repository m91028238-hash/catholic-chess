// Staunton piece geometry: lathe profiles + sculpted (extruded, tapered) knight.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three';

const SEG=40;
function arc(pts,cx,cy,r,a0,a1,n=10){for(let i=0;i<=n;i++){const a=a0+(a1-a0)*i/n;pts.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r])}}
function base(rb){ // classic Staunton foot: wide base, cove, bead
  return [[0,0],[rb,0],[rb,.035],[rb*.985,.06],[rb*.94,.075],[rb*.9,.085],[rb*.93,.105],[rb*.92,.13],[rb*.84,.145],[rb*.78,.16],[rb*.8,.18],[rb*.77,.2],[rb*.68,.215]];
}
function lathe(pts){
  const v=pts.map(p=>new THREE.Vector2(Math.max(0.0001,p[0]),p[1]));
  const g=new THREE.LatheGeometry(v,SEG);return g.toNonIndexed();
}
function prep(g){g=g.index?g.toNonIndexed():g; if(!g.attributes.uv){const n=g.attributes.position.count;g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2))} if(!g.attributes.normal)g.computeVertexNormals();return g}

function pawn(){
  const p=base(.3);
  p.push([.19,.24],[.15,.3],[.12,.38],[.105,.45],[.1,.49],[.17,.505],[.18,.525],[.16,.545],[.1,.555]);
  arc(p,0,.665,.125,-Math.PI/2+.62,Math.PI/2,14);
  return lathe(p);
}
function rook(){
  const p=base(.33);
  p.push([.22,.24],[.2,.32],[.18,.5],[.18,.62],[.21,.64],[.24,.66],[.25,.69],[.23,.7],[.24,.72],[.27,.74],[.27,.92],[.2,.92],[.2,.84],[.0001,.84]);
  const body=lathe(p);
  const parts=[body];
  const nm=6;
  for(let i=0;i<nm;i++){
    const a=i/nm*Math.PI*2;
    const g=new THREE.BoxGeometry(.11,.09,.075);
    g.translate(0,.965,.235);g.rotateY(a);parts.push(prep(g));
  }
  return mergeGeometries(parts.map(prep));
}
function bishop(){
  const p=base(.31);
  p.push([.19,.24],[.15,.32],[.12,.45],[.1,.62],[.1,.66],[.17,.68],[.185,.7],[.16,.72],[.19,.74],[.12,.76],[.11,.78]);
  // mitre (egg)
  const cy=.95, ry=.2, rx=.13;
  for(let i=0;i<=16;i++){const t=-Math.PI/2+ i/16*Math.PI;const x=Math.cos(t)*rx*(1-.18*Math.max(0,Math.sin(t))),y=cy+Math.sin(t)*ry; if(i>2)p.push([x,y])}
  p.push([.03,1.15],[.04,1.17]);arc(p,0,1.2,.04,-Math.PI/2+.5,Math.PI/2,8);
  return lathe(p);
}
function queen(){
  const p=base(.34);
  p.push([.22,.24],[.17,.33],[.13,.48],[.11,.7],[.11,.78],[.19,.8],[.2,.83],[.15,.85],[.17,.87],[.12,.9],[.13,.95],[.17,1.08],[.21,1.17],[.2,1.19],[.15,1.17],[.11,1.18],[.1,1.2]);
  arc(p,0,1.2,.1,0,Math.PI/2,8);p.push([.03,1.32]);arc(p,0,1.36,.05,-Math.PI/2+.6,Math.PI/2,8);
  const parts=[lathe(p)];
  for(let i=0;i<10;i++){const s=new THREE.SphereGeometry(.03,10,8);const a=i/10*Math.PI*2;s.translate(Math.cos(a)*.205,1.19,Math.sin(a)*.205);parts.push(prep(s))}
  return mergeGeometries(parts.map(prep));
}
function king(){
  const p=base(.35);
  p.push([.23,.24],[.18,.34],[.14,.5],[.12,.76],[.12,.84],[.2,.86],[.21,.89],[.16,.91],[.18,.93],[.13,.96],[.14,1.0],[.18,1.14],[.21,1.22],[.19,1.24],[.15,1.25]);
  arc(p,0,1.25,.15,0,Math.PI/2,10);
  p.push([.06,1.41],[.06,1.43],[.0001,1.43]);
  const parts=[lathe(p)];
  const v=new THREE.BoxGeometry(.065,.25,.065);v.translate(0,1.54,0);
  const h=new THREE.BoxGeometry(.19,.06,.065);h.translate(0,1.58,0);
  parts.push(prep(v),prep(h));
  return mergeGeometries(parts.map(prep));
}
function knight(){
  const p=base(.33);p.push([.25,.24],[.24,.27],[.0001,.27]);
  const b=lathe(p);
  // horse head silhouette (x forward, y up)
  const s=new THREE.Shape();
  s.moveTo(-.2,.25);
  s.lineTo(.23,.25);
  s.bezierCurveTo(.25,.38,.12,.5,.13,.6);        // chest to throat
  s.bezierCurveTo(.2,.66,.34,.68,.4,.74);        // jaw
  s.quadraticCurveTo(.47,.78,.45,.86);           // chin/muzzle
  s.quadraticCurveTo(.43,.94,.36,.97);           // nose
  s.bezierCurveTo(.28,1.02,.2,1.07,.15,1.12);    // face
  s.lineTo(.13,1.24);                             // ear front
  s.lineTo(.07,1.14);
  s.lineTo(.02,1.2);                              // second ear
  s.lineTo(-.03,1.1);
  s.bezierCurveTo(-.17,1.02,-.24,.86,-.25,.68);  // mane
  s.bezierCurveTo(-.26,.5,-.23,.38,-.2,.25);
  const head=new THREE.ExtrudeGeometry(s,{depth:.16,bevelEnabled:true,bevelThickness:.06,bevelSize:.035,bevelSegments:4,curveSegments:16});
  head.translate(0,0,-.08);
  // taper muzzle & round the back
  const pos=head.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i);let z=pos.getZ(i);
    const t=Math.min(1,Math.max(0,(x+.1)/.55));
    z*=1-.38*t*Math.min(1,Math.max(0,(y-.6)/.3));
    z*=1-.15*Math.max(0,(-x-.12)/.13);
    pos.setZ(i,z);
  }
  // mane ridge
  const ridge=new THREE.TorusGeometry(.24,.03,6,18,Math.PI*.62);ridge.rotateZ(Math.PI*.42);ridge.translate(.02,.78,0);
  // eyes (small bumps)
  head.deleteAttribute('uv');head.deleteAttribute('normal');
  let hm=mergeVertices(head,1e-4);hm.computeVertexNormals();hm=hm.toNonIndexed();
  { const P=hm.attributes.position,uv=new Float32Array(P.count*2);for(let i=0;i<P.count;i++){uv[2*i]=P.getZ(i)*2+.5;uv[2*i+1]=P.getY(i)} hm.setAttribute('uv',new THREE.BufferAttribute(uv,2)); }
  const parts=[b,hm,prep(ridge)];
  for(const sz of [-1,1]){const e=new THREE.SphereGeometry(.025,8,6);e.translate(.22,1.0,sz*.075);parts.push(prep(e))}
  return mergeGeometries(parts.map(prep));
}

let cache=null;
export function pieceGeometries(){
  if(cache)return cache;
  cache={p:pawn(),r:rook(),n:knight(),b:bishop(),q:queen(),k:king()};
  for(const k in cache){cache[k].computeBoundingBox()}
  // knight: flat-shade-ish normals already computed per face; lathe ones smooth via toNonIndexed+computeVertexNormals -> faceted; fix with merge
  return cache;
}
