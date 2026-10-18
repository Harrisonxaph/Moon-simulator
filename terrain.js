const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
    function fract(x){return x-Math.floor(x)}
    function rnd(x,z){return fract(Math.sin(x*127.137+z*311.721)*43758.5453123)}
    function noise(x,z){
      const ix=Math.floor(x), iz=Math.floor(z), tx=x-ix, tz=z-iz;
      const u=tx*tx*(3-2*tx),v=tz*tz*(3-2*tz);
      const a=rnd(ix,iz),b=rnd(ix+1,iz),c=rnd(ix,iz+1),d=rnd(ix+1,iz+1);
      return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
    }
    function fbm(x,z,n){let s=0,a=.5,f=1;for(let i=0;i<n;i++){s+=noise(x*f,z*f)*a;a*=.5;f*=2.02}return s}
let elevation=null,site=null,detail=null,detailSite=null;
export function configureTerrain(metadata,buffer){site=metadata;elevation=buffer instanceof Float32Array?buffer:new Float32Array(buffer);if(elevation.length!==site.size**2)throw new Error('Invalid elevation data');}
export function configureDetail(metadata,buffer){detailSite=metadata;detail=buffer instanceof Float32Array?buffer:new Float32Array(buffer);if(detail.length!==metadata.size**2)throw new Error('Invalid detail elevation data');}
function sampleGrid(x,z,metadata,values){
 const half=(metadata.size-1)/2,gx=clamp(x/metadata.spacing+half,0,metadata.size-1-1e-8),gz=clamp(z/metadata.spacing+half,0,metadata.size-1-1e-8);
 const i=Math.floor(gx),j=Math.floor(gz),u=gx-i,v=gz-j,n=metadata.size;
 const a=values[j*n+i],b=values[j*n+i+1],c=values[(j+1)*n+i],d=values[(j+1)*n+i+1];
 return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function measuredHeight(x,z){
 if(!elevation)throw new Error('Elevation data not loaded');
 const regional=sampleGrid(x,z,site,elevation);
 if(!detail)return regional;
 const edge=Math.max(Math.abs(x),Math.abs(z)),extent=detailSite.extentMetres;
 if(edge>=extent)return regional;
 const blend=clamp((extent-edge)/1500,0,1),smooth=blend*blend*(3-2*blend);
 return regional+(sampleGrid(x,z,detailSite,detail)-regional)*smooth;
}
function height(x,z){return measuredHeight(x,z);}

export {rnd, noise, fbm, height};

// All tiles use the same world-aligned grid. Interpolation follows PlaneGeometry's diagonal.
export function sampleSurface(x,z,segments){
  const step=700/segments, gx=Math.floor((x+350)/step), gz=Math.floor((z+350)/step);
  const x0=gx*step-350,z0=gz*step-350,u=(x-x0)/step,v=(z-z0)/step;
  const a=height(x0,z0),b=height(x0+step,z0),c=height(x0,z0+step),d=height(x0+step,z0+step);
  return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v);
}
export function buildTile(tx,tz,segments){
  const n=segments+1,base=n*n,count=base+4*n*2;
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),normals=new Float32Array(count*3),uvs=new Float32Array(count*2),indices=[];
  for(let j=0;j<n;j++)for(let i=0;i<n;i++){
    const k=j*n+i,x=i*700/segments-350+tx*700,z=j*700/segments-350+tz*700,h=height(x,z);
    positions.set([x-tx*700,h,z-tz*700],k*3);uvs.set([x/700, -z/700],k*2);
    const highlands=clamp((noise(x*.00016+41,z*.00016-17)-.35)*3,0,1);
    const tint=.48+highlands*.22+noise(x*.023,z*.023)*.08;
    colors.set([tint,tint,tint],k*3);
    const nx=height(x-2,z)-height(x+2,z),nz=height(x,z-2)-height(x,z+2),len=Math.hypot(nx,4,nz);
    normals.set([nx/len,4/len,nz/len],k*3);
    if(i<segments&&j<segments){const a=k,b=k+1,c=k+n,d=c+1;indices.push(a,c,b,b,c,d)}
  }
  // Deep skirts cover precision gaps and transitions when changing quality.
  let next=base;
  for(const edge of [Array.from({length:n},(_,i)=>i),Array.from({length:n},(_,i)=>i*n+n-1),Array.from({length:n},(_,i)=>(n-1)*n+n-1-i),Array.from({length:n},(_,i)=>(n-1-i)*n)]){
    const first=next;
    for(const k of edge)for(let lower=0;lower<2;lower++){
      positions.set(positions.subarray(k*3,k*3+3),next*3);positions[next*3+1]-=lower*600;
      colors.set(colors.subarray(k*3,k*3+3),next*3);normals.set(normals.subarray(k*3,k*3+3),next*3);uvs.set(uvs.subarray(k*2,k*2+2),next*2);next++;
    }
    for(let i=0;i<segments;i++){const a=first+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3)}
  }
  return {positions,colors,normals,uvs,indices:new Uint32Array(indices)};
}

// A single coarse ring extends the view without multiplying detailed flight tiles.
export function buildHorizon(tx,tz,rangeKm=35){
 const radius=Math.ceil(rangeKm*1000/700),n=radius*2+2;
 const positions=new Float32Array(n*n*3),normals=new Float32Array(n*n*3),colors=new Float32Array(n*n*3),uvs=new Float32Array(n*n*2),indices=[];
 for(let j=0;j<n;j++)for(let i=0;i<n;i++){
  const x=(tx+i-radius-.5)*700,z=(tz+j-radius-.5)*700,k=j*n+i;
  positions.set([x,height(x,z),z],k*3);uvs.set([x/700,-z/700],k*2);
  const dx=height(x-100,z)-height(x+100,z),dz=height(x,z-100)-height(x,z+100),length=Math.hypot(dx,200,dz);
  normals.set([dx/length,200/length,dz/length],k*3);colors.set([.58,.58,.58],k*3);
  if(i<n-1&&j<n-1){
   // Detailed 7x7 tiles occupy this exact inner square.
   const cx=(i-radius)*700,cz=(j-radius)*700;
   if(Math.abs(cx)<=2100&&Math.abs(cz)<=2100)continue;
   if(Math.abs(x)>62500||Math.abs(z)>62500)continue;
   const a=k,b=k+1,c=k+n,d=c+1;indices.push(a,c,b,b,c,d);
  }
 }
 return {positions,normals,colors,uvs,indices:new Uint32Array(indices)};
}
