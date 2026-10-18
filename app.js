
    import * as THREE from 'three/webgpu';
    import {rnd, noise, fbm, height, sampleSurface, configureTerrain} from './terrain.js';
    import {bodyPosition,starDirection,angularRadius,createSkyTransform,earthAxes} from './sky.js';
    import {createApollo15Landmark} from './landmark.js';
    const $ = (s) => document.getElementById(s);
    const clamp = THREE.MathUtils.clamp;
    const isTouch = matchMedia('(pointer:coarse)').matches;
    const params = new URLSearchParams(location.search);
    const forceWebGL = params.get('renderer') === 'webgl';
    let renderer, camera, scene, sun, earth, stars;
    let running = false, lowPower = isTouch, boosting = false, ascend = false, descend = false;
    let yaw = 0, pitch = -Math.atan2(16,42), targetYaw=0, targetPitch=-Math.atan2(16,42), cameraSpeed = 62;
    let sensitivity=1, lunarGravity=false, paused=false, recoveryRequired=false, resetInput=()=>{};
    let lastFrame = performance.now(), lastStats = 0;
    const key = {}, move = {x:0,y:0}, tiles = new Map();
    const startPoint = new THREE.Vector3(0,18,42);
    const startPitch=-Math.atan2(16,42);
    let brightStars,brightStarIndices=[],starBrightness=1.4;
    const landmarkProjection=new THREE.Vector3();
    const TILE = 700, RANGE = 3, TWO_PI = Math.PI*2;
    let tileOriginX = 99999, tileOriginZ = 99999;
    const forward = new THREE.Vector3(), right = new THREE.Vector3(), desired = new THREE.Vector3();
    const moveSmoothed = new THREE.Vector3();

    function createDustTexture(){
      const c=document.createElement('canvas');c.width=c.height=256;
      const ctx=c.getContext('2d'),img=ctx.createImageData(256,256);
      for(let y=0;y<256;y++)for(let x=0;x<256;x++){
        const i=(y*256+x)*4;
        const n=noise(x*.063,y*.063)*25+noise(x*.22,y*.22)*15+(rnd(x,y)-.5)*25;
        const v=Math.round(clamp(184+n,115,238));img.data[i]=v;img.data[i+1]=v;img.data[i+2]=Math.min(255,v+2);img.data[i+3]=255;
      }
      ctx.putImageData(img,0,0);
      const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(8,8);
      t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;
    }
    let terrainMaterial, horizonMesh, skyObjects=[],starCatalog=[],siteMetadata,skyLastUpdate=0;
    let simulationDate=new Date('1971-07-30T22:16:00Z'),realTime=false,enhancedStars=true,viewRange=35;
    const worker=new Worker('./terrain-worker.js',{type:'module'});
    let pending=[],busy=false,jobID=0,activeJob=null,terrainError=false,workerReady=false;
    const segments=()=>lowPower?32:48;
    function disposeTile(tile){scene.remove(tile.mesh);tile.mesh.geometry.dispose();tile.rocks.removeFromParent();tile.rocks.dispose()}
    function installTile(data){
      const {tx,tz,segments:detail,positions,colors,normals,uvs,indices}=data;
      const id=tx+','+tz;
      if(Math.abs(tx-tileOriginX)>RANGE||Math.abs(tz-tileOriginZ)>RANGE||detail!==segments())return;
      const old=tiles.get(id);if(old)disposeTile(old);
      const g=new THREE.BufferGeometry();
      for(const [name,array,size] of [['position',positions,3],['color',colors,3],['normal',normals,3],['uv',uvs,2]])g.setAttribute(name,new THREE.BufferAttribute(array,size));
      g.setIndex(new THREE.BufferAttribute(indices,1));g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,terrainMaterial);mesh.position.set(tx*TILE,0,tz*TILE);mesh.receiveShadow=true;mesh.castShadow=true;scene.add(mesh);
      tiles.set(id,{mesh,segments:detail,rocks:placeRocks(tx,tz,detail)});
    }
    worker.onmessage=({data})=>{
      if(data.type==='ready'){workerReady=true;pumpTiles();return;}
      busy=false;activeJob=null;
      if(data.type==='horizon'){
        const g=new THREE.BufferGeometry();for(const [name,array,size] of [['position',data.positions,3],['normal',data.normals,3],['color',data.colors,3],['uv',data.uvs,2]])g.setAttribute(name,new THREE.BufferAttribute(array,size));
        g.setIndex(new THREE.BufferAttribute(data.indices,1));g.computeBoundingSphere();
        if(horizonMesh){scene.remove(horizonMesh);horizonMesh.geometry.dispose()}
        horizonMesh=new THREE.Mesh(g,terrainMaterial);horizonMesh.receiveShadow=true;scene.add(horizonMesh);
        for(const [id,tile] of tiles)if(Math.abs(tile.mesh.position.x/TILE-tileOriginX)>RANGE||Math.abs(tile.mesh.position.z/TILE-tileOriginZ)>RANGE){disposeTile(tile);tiles.delete(id)}
      }else installTile(data);pumpTiles();
    };
    worker.onerror=()=>{terrainError=true;busy=false;pending=[];showRecovery('Terrain generation failed. Reload to retry.');};
    function pumpTiles(){
      if(busy||paused||terrainError||!workerReady||!pending.length)return;
      activeJob=pending.shift();busy=true;worker.postMessage({...activeJob,id:++jobID});
    }
    function updateTiles(force=false){
      const tx=Math.round(camera.position.x/TILE),tz=Math.round(camera.position.z/TILE);
      if(!force&&tx===tileOriginX&&tz===tileOriginZ)return;
      tileOriginX=tx;tileOriginZ=tz;pending=[];
      for(let dz=-RANGE;dz<=RANGE;dz++)for(let dx=-RANGE;dx<=RANGE;dx++){
        const cx=tx+dx,cz=tz+dz,id=cx+','+cz,old=tiles.get(id);
        if(old?.segments===segments())continue;
        if(activeJob?.type!=='horizon'&&activeJob?.tx===cx&&activeJob?.tz===cz&&activeJob?.segments===segments())continue;
        pending.push({tx:cx,tz:cz,segments:segments(),distance:dx*dx+dz*dz});
      }
      pending.sort((a,b)=>a.distance-b.distance);pending.splice(Math.min(9,pending.length),0,{type:'horizon',tx,tz,rangeKm:viewRange});
      // Retain the previous edge tiles until the replacement horizon is installed.
      pumpTiles();
    }
    function ground(x,z){
      const tile=tiles.get(Math.round(x/TILE)+','+Math.round(z/TILE));
      return sampleSurface(x,z,tile?.segments??segments());
    }
    let rockGeometry,rockMaterial;
    function createRocks(){
      rockGeometry=new THREE.DodecahedronGeometry(1,0);
      rockMaterial=new THREE.MeshStandardMaterial({color:0x858585,roughness:1});
    }
    function placeRocks(tx,tz,detail){
      const mesh=new THREE.InstancedMesh(rockGeometry,rockMaterial,detail===32?10:24);
      mesh.castShadow=true;mesh.receiveShadow=true;
      const dummy=new THREE.Object3D();
      for(let i=0;i<mesh.count;i++){
        const seed=tx*97+tz*137+i*3.19;
        const x=tx*TILE+(rnd(seed,31)-.5)*TILE,z=tz*TILE+(rnd(seed,51)-.5)*TILE;
        const size=.5+Math.pow(rnd(seed,12),5)*8.5;
        dummy.position.set(x,sampleSurface(x,z,detail)+size*.2,z);
        dummy.rotation.set(rnd(seed,3)*3,rnd(seed,7)*6.283,rnd(seed,11)*3);
        dummy.scale.set(size,size*(.35+rnd(seed,15)*.5),size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();scene.add(mesh);return mesh;
    }
    async function createStars(){
      const response=await fetch('./stars.json');if(!response.ok)throw new Error('Star catalogue unavailable');starCatalog=await response.json();
      const a=new Float32Array(starCatalog.length*3),col=new Float32Array(a.length);
      for(let i=0;i<starCatalog.length;i++){
        const bv=starCatalog[i][5],brightness=Math.max(.3,Math.min(1,Math.pow(10,-.10*(starCatalog[i][4]+1))));
        const colour=new THREE.Color().setRGB(bv<.3?.7:1,bv>1?.7:.9,bv>1?.5:1).multiplyScalar(brightness);col.set([colour.r,colour.g,colour.b],i*3);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));g.setAttribute('color',new THREE.BufferAttribute(col,3));
      const starMaterial=new THREE.PointsMaterial({vertexColors:true,size:2.4,sizeAttenuation:false,transparent:true,depthWrite:false,toneMapped:false});starMaterial.color.setScalar(starBrightness);
      stars=new THREE.Points(g,starMaterial);stars.frustumCulled=false;scene.add(stars);
      brightStarIndices=starCatalog.map((star,index)=>star[4]<2.5?index:-1).filter(index=>index>=0);
      const brightGeometry=new THREE.BufferGeometry();brightGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(brightStarIndices.length*3),3));
      brightGeometry.setAttribute('color',new THREE.Float32BufferAttribute(brightStarIndices.flatMap(i=>Array.from(col.subarray(i*3,i*3+3))),3));
      const brightMaterial=starMaterial.clone();brightMaterial.size=3.8;
      brightStars=new THREE.Points(brightGeometry,brightMaterial);brightStars.frustumCulled=false;scene.add(brightStars);
      for(const [name,colour,size] of [['Mercury',0xc4b6a1,2],['Venus',0xffefd0,3],['Mars',0xf1a070,2],['Jupiter',0xf6dfb3,2.8],['Saturn',0xe5d9af,2],['Uranus',0xa2d8dd,1.2],['Neptune',0x829fdb,1]]){
        const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0],3));
        const mesh=new THREE.Points(geometry,new THREE.PointsMaterial({color:colour,size,sizeAttenuation:false,transparent:true,depthWrite:false}));scene.add(mesh);skyObjects.push({name,mesh});
      }
      const solarDisc=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0xffffff,toneMapped:false}));scene.add(solarDisc);skyObjects.push({name:'Sun',mesh:solarDisc});
    }
    function updateSky(force=false){
      const now=performance.now();if(!force&&now-skyLastUpdate<1000)return;skyLastUpdate=now;
      if(realTime){simulationDate=new Date();$('skyDate').value=simulationDate.toISOString().slice(0,16)}
      const date=simulationDate,x=camera.position.x,z=camera.position.z;
      const bodies=[{name:'Earth',mesh:earth},...skyObjects];let solar;
      for(const body of bodies){
        const position=bodyPosition(body.name,date,x,z,camera.position.y+siteMetadata.siteElevationMetres);
        body.direction=position.direction;if(body.name==='Earth')earth.userData.direction=new THREE.Vector3().fromArray(position.direction);body.mesh.position.fromArray(position.direction).multiplyScalar(100000).add(camera.position);
        if(body.name==='Sun'||body.name==='Earth')body.mesh.scale.setScalar(Math.tan(angularRadius(body.name==='Sun'?695700000:6371000,position.distance))*100000/(body.name==='Earth'?145:1));
        if(body.name==='Sun')solar=position;
      }
      const axes=earthAxes(date,x,z);earth.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(...['x','y','z'].map(a=>new THREE.Vector3().fromArray(axes[a]))));
      const positions=stars.geometry.getAttribute('position'),transform=createSkyTransform(date,x,z);
      for(let i=0;i<starCatalog.length;i++){const direction=starDirection(starCatalog[i],date,x,z,transform);positions.setXYZ(i,...direction.map(a=>a*100000))}positions.needsUpdate=true;
      const brightPositions=brightStars.geometry.getAttribute('position');for(let i=0;i<brightStarIndices.length;i++){const k=brightStarIndices[i];brightPositions.setXYZ(i,positions.getX(k),positions.getY(k),positions.getZ(k))}brightPositions.needsUpdate=true;
      const daylight=solar.altitude>0;stars.material.opacity=daylight&&!enhancedStars?0:1;brightStars.material.opacity=stars.material.opacity;
      for(const body of skyObjects)if(body.name!=='Sun')body.mesh.material.opacity=daylight&&!enhancedStars?0:1;
      sun.intensity=daylight?3:0;
      sun.userData.direction=new THREE.Vector3().fromArray(solar.direction);
      $('skyInfo').textContent='APOLLO 15 · '+date.toISOString().slice(0,16).replace('T',' ')+' UTC · SUN '+solar.altitude.toFixed(1)+'°'+(enhancedStars?' · STARS ENHANCED':'');
      $('hint').textContent=daylight?'DRAG UP TO SEE STARS · ↺ BASE TO RETURN':'LUNAR NIGHT · CHANGE DATE FOR SUNLIT TERRAIN';
    }
    async function createEarth(){
      const texture=await new THREE.TextureLoader().loadAsync('./earth.jpg');texture.colorSpace=THREE.SRGBColorSpace;
      earth=new THREE.Mesh(new THREE.SphereGeometry(145,40,28),new THREE.MeshStandardMaterial({map:texture,roughness:1,metalness:0}));scene.add(earth);
    }
    function configureGraphics(){
      renderer.setPixelRatio(lowPower?1:Math.min(devicePixelRatio,isTouch?1.35:1.75));
      renderer.setSize(innerWidth,innerHeight);
      renderer.shadowMap.enabled=!lowPower;sun.castShadow=!lowPower;
      if(tiles.size)updateTiles(true);
      $('quality').textContent=lowPower?'DETAIL: ECO':'DETAIL: HIGH';
      $('quality').setAttribute('aria-pressed',String(lowPower));
    }
    function initControls(){
      const joy=$('joy'),knob=$('stick');let joyID=null;
      function handleJoy(e){
        const rect=joy.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
        const radius=rect.width*.33,dx=e.clientX-cx,dy=e.clientY-cy;
        const m=Math.max(0,(Math.min(1,Math.hypot(dx,dy)/radius)-.1)/.9),a=Math.atan2(dy,dx);
        move.x=Math.cos(a)*m;move.y=-Math.sin(a)*m;
        knob.style.left='calc(50% + '+(move.x*radius)+'px)';
        knob.style.top='calc(50% - '+(move.y*radius)+'px)';
      }
      joy.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(joyID!==null)return;joyID=e.pointerId;joy.setPointerCapture(joyID);handleJoy(e)});
      joy.addEventListener('pointermove',e=>{if(e.pointerId===joyID){e.preventDefault();handleJoy(e)}});
      function endJoy(e){if(e.pointerId!==joyID)return;joyID=null;move.x=move.y=0;knob.style.left='50%';knob.style.top='50%'}
      joy.addEventListener('pointerup',endJoy);joy.addEventListener('pointercancel',endJoy);joy.addEventListener('lostpointercapture',endJoy);
      const bindHold=(id,change)=>{const el=$(id);
        el.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();el.setPointerCapture(e.pointerId);change(true)});
        el.addEventListener('pointerup',()=>change(false));el.addEventListener('pointercancel',()=>change(false));el.addEventListener('lostpointercapture',()=>change(false));
      };
      bindHold('ascend',v=>ascend=v);bindHold('descend',v=>descend=v);
      let lookID=null,px=0,py=0;
      renderer.domElement.addEventListener('pointerdown',e=>{if(lookID!==null||!running)return;lookID=e.pointerId;px=e.clientX;py=e.clientY;renderer.domElement.setPointerCapture(lookID)});
      renderer.domElement.addEventListener('pointermove',e=>{if(e.pointerId!==lookID||!running)return;
        const dx=e.clientX-px,dy=e.clientY-py;px=e.clientX;py=e.clientY;
        targetYaw-=dx*(isTouch?.0042:.0028)*sensitivity;targetPitch=clamp(targetPitch-dy*(isTouch?.0042:.0028)*sensitivity,-1.49,1.49);
      });
      const endLook=e=>{if(e.pointerId===lookID)lookID=null};
      renderer.domElement.addEventListener('pointerup',endLook);renderer.domElement.addEventListener('pointercancel',endLook);renderer.domElement.addEventListener('lostpointercapture',endLook);
      addEventListener('keydown',e=>{key[e.code]=true;if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault()});
      addEventListener('keyup',e=>{key[e.code]=false});
      resetInput=()=>{for(const name in key)key[name]=false;move.x=move.y=0;ascend=descend=false;joyID=lookID=null;knob.style.left=knob.style.top='50%';moveSmoothed.set(0,0,0);boosting=false;$('cruise').setAttribute('aria-pressed','false');$('cruise').textContent='BOOST ×3'};
      addEventListener('blur',()=>{paused=true;resetInput()});
      addEventListener('focus',()=>{paused=document.hidden;lastFrame=performance.now();pumpTiles()});
      document.addEventListener('visibilitychange',()=>{paused=document.hidden;resetInput();lastFrame=performance.now();if(!paused)pumpTiles()});
      $('settings').onclick=()=>{const panel=$('flightSettings');panel.hidden=!panel.hidden;$('settings').setAttribute('aria-expanded',String(!panel.hidden))};
      $('sensitivity').oninput=e=>sensitivity=Number(e.target.value);
      $('gravity').onchange=e=>{lunarGravity=e.target.checked;moveSmoothed.y=0};
      $('skyDate').value=simulationDate.toISOString().slice(0,16);
      $('skyDate').onchange=e=>{const date=new Date(e.target.value+'Z');if(!Number.isFinite(date.getTime())||date.getUTCFullYear()<1900||date.getUTCFullYear()>2100)return;simulationDate=date;realTime=false;$('liveSky').checked=false;updateSky(true)};
      $('liveSky').onchange=e=>{realTime=e.target.checked;updateSky(true)};
      $('enhancedStars').onchange=e=>{enhancedStars=e.target.checked;updateSky(true)};
      $('starBrightness').oninput=e=>{starBrightness=Number(e.target.value);stars.material.color.setScalar(starBrightness);brightStars.material.color.setScalar(starBrightness)};
      $('viewRange').onchange=e=>{viewRange=Number(e.target.value);updateTiles(true)};
      $('lookAt').onchange=e=>{if(!e.target.value)return;const p=bodyPosition(e.target.value,simulationDate,camera.position.x,camera.position.z,camera.position.y+siteMetadata.siteElevationMetres);const [x,y,z]=p.direction;const angle=Math.atan2(-x,-z);targetYaw=yaw+Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw));targetPitch=clamp(Math.asin(y),-1.49,1.49);$('objectInfo').textContent=e.target.value+': '+p.altitude.toFixed(1)+'° altitude, '+p.azimuth.toFixed(1)+'° azimuth'+(p.altitude<0?' — below the horizon':'');};
      $('cruise').addEventListener('click',()=>{boosting=!boosting;$('cruise').setAttribute('aria-pressed',String(boosting));$('cruise').textContent=boosting?'BOOST: ON':'BOOST ×3'});
      $('quality').addEventListener('click',()=>{lowPower=!lowPower;configureGraphics()});
      $('reset').addEventListener('click',()=>resetFlight());
      $('start').addEventListener('click',()=>{if(!renderer)return;running=true;$('overlay').classList.add('hidden')});
    }
    function resetFlight(){
      camera.position.set(startPoint.x,height(startPoint.x,startPoint.z)+startPoint.y,startPoint.z);
      resetInput();yaw=targetYaw=0;pitch=targetPitch=startPitch;moveSmoothed.set(0,0,0);updateTiles();
    }
    function frame(time){
      const dt=Math.min((time-lastFrame)/1000,.045);lastFrame=time;
      if(paused||terrainError||recoveryRequired)return;
      if(running){
        yaw+=(targetYaw-yaw)*(1-Math.exp(-18*dt));pitch+=(targetPitch-pitch)*(1-Math.exp(-18*dt));
        camera.rotation.set(pitch,yaw,0,'YXZ');
        const mx=clamp(move.x+Number(!!key.KeyD)-Number(!!key.KeyA),-1,1);
        const my=clamp(move.y+Number(!!key.KeyW)-Number(!!key.KeyS),-1,1);
        forward.set(-Math.sin(yaw),0,-Math.cos(yaw));right.set(Math.cos(yaw),0,-Math.sin(yaw));
        desired.set(0,0,0).addScaledVector(forward,my).addScaledVector(right,mx);
        if(desired.lengthSq()>1)desired.normalize();
        desired.y=Number(ascend||!!key.KeyE||!!key.Space)-Number(descend||!!key.KeyQ);
        if(desired.lengthSq()>1)desired.normalize();
        
        const boosted=(boosting||!!key.ShiftLeft||!!key.ShiftRight)?3:1;
        cameraSpeed=62*boosted;
        desired.multiplyScalar(cameraSpeed);
        if(lunarGravity){
          moveSmoothed.x+=(desired.x-moveSmoothed.x)*(1-Math.exp(-4*dt));
          moveSmoothed.z+=(desired.z-moveSmoothed.z)*(1-Math.exp(-4*dt));
          moveSmoothed.y=clamp(moveSmoothed.y+((ascend||key.KeyE||key.Space?5:0)-(descend||key.KeyQ?3:0)-1.62)*dt,-45,45);
        }else moveSmoothed.lerp(desired,1-Math.exp(-(desired.lengthSq()?4:7)*dt));
        // Do not fly into tiles that have not arrived yet.
        const nextX=camera.position.x+moveSmoothed.x*dt,nextZ=camera.position.z+moveSmoothed.z*dt;
        if(tiles.has(Math.round(nextX/TILE)+','+Math.round(nextZ/TILE))){camera.position.x=clamp(nextX,-50000,50000);camera.position.z=clamp(nextZ,-50000,50000)}
        camera.position.y+=moveSmoothed.y*dt;
        const floor=ground(camera.position.x,camera.position.z)+5;
        const ahead=ground(camera.position.x+moveSmoothed.x*.5,camera.position.z+moveSmoothed.z*.5)+12;
        if(!lunarGravity&&camera.position.y<ahead)camera.position.y+=(ahead-camera.position.y)*(1-Math.exp(-6*dt));
        if(camera.position.y<floor){camera.position.y=floor;moveSmoothed.y=Math.max(0,moveSmoothed.y)}
        const currTx=Math.round(camera.position.x/TILE),currTz=Math.round(camera.position.z/TILE);
        if(currTx!==tileOriginX||currTz!==tileOriginZ)updateTiles();
      }
      if(camera){
        camera.rotation.set(pitch,yaw,0,'YXZ');
        // Anchor astronomical bodies to the observer, preventing apparent parallax on short flights.
        stars.position.copy(camera.position);brightStars.position.copy(camera.position);
        const distance=Math.hypot(camera.position.x,camera.position.z);
        $('baseInfo').textContent='APOLLO 15 LANDING SITE · '+(distance<1000?Math.round(distance)+' m':(distance/1000).toFixed(1)+' km')+' · ↺ BASE TO RETURN';
        landmarkProjection.set(0,height(0,0)+4,0).project(camera);
        const label=$('landmarkLabel');label.hidden=!running||distance>800||landmarkProjection.z>1||landmarkProjection.z< -1||Math.abs(landmarkProjection.x)>.9||Math.abs(landmarkProjection.y)>.85;
        label.style.left=((landmarkProjection.x+1)*innerWidth/2)+'px';label.style.top=((-landmarkProjection.y+1)*innerHeight/2)+'px';
        updateSky();
        for(const body of skyObjects)if(body.direction)body.mesh.position.fromArray(body.direction).multiplyScalar(100000).add(camera.position);
        if(earth.userData.direction)earth.position.copy(earth.userData.direction).multiplyScalar(100000).add(camera.position);
        const surface=ground(camera.position.x,camera.position.z);
        sun.position.copy(sun.userData.direction??new THREE.Vector3(1,1,0)).multiplyScalar(2000).add(new THREE.Vector3(camera.position.x,surface,camera.position.z));
        sun.target.position.set(camera.position.x,surface,camera.position.z);sun.target.updateMatrixWorld();
      }
      if(time-lastStats>230){
        $('altitude').textContent=Math.max(0,Math.round(camera.position.y-ground(camera.position.x,camera.position.z))).toLocaleString();
        $('speed').textContent=Math.round(moveSmoothed.length())+' m/s';
        lastStats=time;
      }
      try{renderer.render(scene,camera)}catch(error){showRecovery('Graphics stopped. Reload to recover.');console.error(error)}
    }
    function showRecovery(message){recoveryRequired=true;paused=true;resetInput();$('status').hidden=false;$('status').textContent=message+' ';const button=document.createElement('button');button.textContent='RELOAD';button.className='pill';button.onclick=()=>location.reload();$('status').append(button)}
    async function boot(){
      try{
        $('loadingText').textContent='INITIALISING WEBGPU RENDERER…';
        const metadataResponse=await fetch('./apollo15.json'),elevationResponse=await fetch('./apollo15.f32');
        if(!metadataResponse.ok||!elevationResponse.ok)throw new Error('Apollo 15 elevation data unavailable');
        siteMetadata=await metadataResponse.json();const elevationBuffer=await elevationResponse.arrayBuffer();configureTerrain(siteMetadata,elevationBuffer);
        worker.postMessage({type:'init',metadata:siteMetadata,buffer:elevationBuffer});
        scene=new THREE.Scene();scene.background=new THREE.Color(0x010205);
        camera=new THREE.PerspectiveCamera(isTouch?74:70,innerWidth/innerHeight,.5,180000);
        renderer=new THREE.WebGPURenderer({antialias:true,alpha:false,forceWebGL});
        renderer.domElement.id='scene';
        renderer.outputColorSpace=THREE.SRGBColorSpace;
        renderer.toneMapping=THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure=1.05;
        document.body.prepend(renderer.domElement);
        renderer.setPixelRatio(Math.min(devicePixelRatio,isTouch?1.35:1.75));
        renderer.setSize(innerWidth,innerHeight);
        await renderer.init();
        $('backend').textContent=renderer.backend?.isWebGPUBackend?'WebGPU':'WebGL 2';
        $('loadingText').textContent='SCULPTING CRATERS AND HIGHLANDS…';
        await new Promise(r=>requestAnimationFrame(r));
        const ambient=new THREE.AmbientLight(0xb4b8c0,.055);scene.add(ambient);
        sun=new THREE.DirectionalLight(0xfffaf0,3.0);
        sun.castShadow=true;
        sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);
        sun.shadow.camera.left=-320;sun.shadow.camera.right=320;
        sun.shadow.camera.top=320;sun.shadow.camera.bottom=-320;
        sun.shadow.camera.near=.1;sun.shadow.camera.far=5000;
        sun.shadow.normalBias=.035;sun.shadow.bias=-.00015;
        scene.add(sun);scene.add(sun.target);
        terrainMaterial=new THREE.MeshStandardMaterial({map:createDustTexture(),vertexColors:true,roughness:1,metalness:0});
        camera.position.set(startPoint.x,height(startPoint.x,startPoint.z)+startPoint.y,startPoint.z);
        await createStars();await createEarth();createRocks();scene.add(createApollo15Landmark(height));updateTiles();
        initControls();configureGraphics();updateSky(true);
        renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showRecovery('Graphics context lost. Reload to recover.')});
        if(renderer.backend?.device?.lost)renderer.backend.device.lost.then(()=>showRecovery('Graphics device disconnected. Reload to recover.'));
        while((!tiles.has('0,0')||!horizonMesh)&&!terrainError)await new Promise(r=>setTimeout(r,20));
        if(terrainError)return;
        addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});
        renderer.setAnimationLoop(frame);
        $('loadingText').textContent='TERRAIN READY · '+(renderer.backend?.isWebGPUBackend?'WEBGPU ACTIVE':'WEBGL2 COMPATIBILITY MODE');
        const btn=$('start');btn.disabled=false;btn.style.opacity='1';
      }catch(error){
        console.error(error);$('loadingText').textContent='COULD NOT START THE SIMULATION';
        const msg=String(error?.message||error);
        $('error').style.display='block';$('error').textContent=msg+' — Try current Safari or Chrome, or use a phone that supports WebGL 2.';
        $('start').style.display='none';
      }
    }
    boot();
