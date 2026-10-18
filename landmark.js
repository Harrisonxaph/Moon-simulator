import * as THREE from 'three/webgpu';
// Approximate reconstruction of the descent stage left at Apollo 15, not a surveyed model.
export function createApollo15Landmark(height){
 const group=new THREE.Group();group.name='Apollo 15 — Falcon descent stage';
 const gold=new THREE.MeshStandardMaterial({color:0xd9a544,roughness:.75,metalness:.25});
 const dark=new THREE.MeshStandardMaterial({color:0x34383b,roughness:.85});
 const metal=new THREE.MeshStandardMaterial({color:0xb8b7ad,roughness:.65,metalness:.4});
 const add=(geometry,material,x,y,z)=>{const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh};
 const y=height(0,0);
 add(new THREE.CylinderGeometry(2.1,2.2,1.65,8),gold,0,y+1.8,0);
 add(new THREE.BoxGeometry(2.8,.2,2.8),dark,0,y+2.72,0);
 add(new THREE.CylinderGeometry(.7,.4,.65,12),dark,0,y+.65,0);
 function strut(a,b,radius=.07){const direction=b.clone().sub(a);const mesh=add(new THREE.CylinderGeometry(radius,radius,direction.length(),6),metal,...a.clone().add(b).multiplyScalar(.5).toArray());mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());}
 for(let i=0;i<4;i++){
  const angle=Math.PI/4+i*Math.PI/2,c=Math.cos(angle),s=Math.sin(angle),x=c*4.6,z=s*4.6,ground=height(x,z);
  add(new THREE.CylinderGeometry(.48,.48,.12,12),gold,x,ground+.08,z);
  strut(new THREE.Vector3(c*1.6,y+2.1,s*1.6),new THREE.Vector3(x,ground+.2,z),.1);
  strut(new THREE.Vector3(c*1.5,y+1,s*1.5),new THREE.Vector3(x,ground+.2,z));
 }
 for(const x of [-.35,.35])strut(new THREE.Vector3(x,y+.25,2.9),new THREE.Vector3(x,y+2.6,2.1),.045);
 for(let i=0;i<7;i++){const t=i/6;strut(new THREE.Vector3(-.35,y+.25+t*2.35,2.9-t*.8),new THREE.Vector3(.35,y+.25+t*2.35,2.9-t*.8),.035)}
 return group;
}
