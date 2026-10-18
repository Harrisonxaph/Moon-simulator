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
    // Deterministic impact basins. Sampling a small neighbouring grid avoids costly crater lists.
    function impacts(x,z,cell,salt){
      const gx=Math.floor(x/cell),gz=Math.floor(z/cell);let elev=0;
      for(let iz=gz-1;iz<=gz+1;iz++) for(let ix=gx-1;ix<=gx+1;ix++){
        const seed=rnd(ix*2.31+salt,iz*7.13-salt);
        if(seed < .25)continue;
        const px=(ix+.13+.73*rnd(ix+salt*3,iz*.87))*cell;
        const pz=(iz+.13+.73*rnd(iz-salt*7,ix*.91))*cell;
        const radius=cell*(.12+.25*rnd(ix+salt*5,iz+salt*9));
        const dx=x-px,dz=z-pz;
        if(Math.abs(dx)>radius*1.5||Math.abs(dz)>radius*1.5)continue;
        const angle=Math.atan2(dz,dx);
        const t=Math.sqrt(dx*dx+dz*dz)/(radius*(1+.045*Math.sin(angle*5+seed*20)));
        if(t>1.5)continue;
        const depth=radius*(.105+.045*rnd(ix+salt*2,iz-salt*4));
        if(t<1){const q=1-t*t;elev-=depth*q*q}
        const ring=(t-1)/.18;
        elev+=depth*.39*Math.exp(-ring*ring);
        const ejecta=(t-1.23)/.24;
        elev+=depth*.08*Math.exp(-ejecta*ejecta)*(1+.35*Math.sin(angle*11+seed*9));
        if(radius>650)elev+=depth*.22*Math.exp(-t*t/ .025);
      }
      return elev;
    }
    function height(x,z){
      const continental=(fbm(x*.00034,z*.00034,5)-.47)*135;
      const peaks=(1-Math.abs(noise(x*.00145,z*.00145)*2-1));
      const mountain=peaks*peaks*47;
      const rolling=(fbm(x*.0039,z*.0039,4)-.46)*24;
      const regolith=(fbm(x*.027,z*.027,3)-.46)*3.2;
      const highlands=clamp((noise(x*.00016+41,z*.00016-17)-.35)*3,0,1);
      return continental*.5+(mountain+rolling)*highlands+regolith*(.35+.65*highlands)+impacts(x,z,3200,81)+impacts(x,z,760,7)+impacts(x,z,195,23)+impacts(x,z,57,51)*(.3+.7*highlands);
    }

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
      positions.set(positions.subarray(k*3,k*3+3),next*3);positions[next*3+1]-=lower*90;
      colors.set(colors.subarray(k*3,k*3+3),next*3);normals.set(normals.subarray(k*3,k*3+3),next*3);uvs.set(uvs.subarray(k*2,k*2+2),next*2);next++;
    }
    for(let i=0;i<segments;i++){const a=first+i*2;indices.push(a,a+1,a+2,a+2,a+1,a+3)}
  }
  return {positions,colors,normals,uvs,indices:new Uint32Array(indices)};
}
