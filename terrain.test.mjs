import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildTile,sampleSurface,configureTerrain,configureDetail} from './terrain.js';
// Mirror app.js boot: configure the checked-in elevation before sampling geometry.
for(const [name,configure] of [['apollo15',configureTerrain],['apollo15-detail',configureDetail]]){
 const metadata=JSON.parse(readFileSync(new URL(`./${name}.json`,import.meta.url),'utf8'));
 const bytes=readFileSync(new URL(`./${name}.f32`,import.meta.url));
 configure(metadata,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
}
for(const segments of [32,48]){
 test(`tile edges and lighting match at ${segments} segments`,()=>{
  const a=buildTile(0,0,segments),b=buildTile(1,0,segments),n=segments+1;
  for(let j=0;j<n;j++)for(let component=1;component<3;component++)assert.equal(a.positions[(j*n+segments)*3+component],b.positions[j*n*3+component]);
  for(let j=0;j<n;j++)for(let c=0;c<3;c++)assert.equal(a.normals[(j*n+segments)*3+c],b.normals[j*n*3+c]);
  assert.ok(a.indices.every(i=>i<a.positions.length/3));
 });
 test(`collision follows rendered triangles including negative coordinates (${segments})`,()=>{
  for(const tx of [-2,0,3]){
   const a=buildTile(tx,-1,segments),n=segments+1;
   for(const [i,j,u,v] of [[3,5,.2,.3],[17,11,.8,.7]]){
    const at=(x,z)=>a.positions[(z*n+x)*3+1];
    const expected=u+v<=1?at(i,j)*(1-u-v)+at(i+1,j)*u+at(i,j+1)*v:at(i+1,j+1)*(u+v-1)+at(i,j+1)*(1-u)+at(i+1,j)*(1-v);
    const x=tx*700-350+(i+u)*700/segments,z=-700-350+(j+v)*700/segments;
    assert.ok(Math.abs(sampleSurface(x,z,segments)-expected)<.00002);
   }
  }
 });
}
