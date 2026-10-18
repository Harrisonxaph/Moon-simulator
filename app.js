
    import * as THREE from 'three/webgpu';
    import {rnd, noise, fbm, height, sampleSurface} from './terrain.js';
    const $ = (s) => document.getElementById(s);
    const clamp = THREE.MathUtils.clamp;
    const isTouch = matchMedia('(pointer:coarse)').matches;
    const params = new URLSearchParams(location.search);
    const forceWebGL = params.get('renderer') === 'webgl';
    let renderer, camera, scene, sun, earth, stars;
    let running = false, lowPower = isTouch, boosting = false, ascend = false, descend = false;
    let yaw = 0, pitch = -0.18, targetYaw=0, targetPitch=-.18, cameraSpeed = 62;
    let sensitivity=1, lunarGravity=false, paused=false, recoveryRequired=false, resetInput=()=>{};
    let lastFrame = performance.now(), lastStats = 0;
    const key = {}, move = {x:0,y:0}, tiles = new Map();
    const startPoint = new THREE.Vector3(0,0,170);
    const TILE = 700, RANGE = 2, TWO_PI = Math.PI*2;
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
    let terrainMaterial;
    const worker=new Worker('./terrain-worker.js',{type:'module'});
    let pending=[],busy=false,jobID=0,activeJob=null,terrainError=false;
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
    worker.onmessage=({data})=>{busy=false;activeJob=null;installTile(data);pumpTiles()};
    worker.onerror=()=>{terrainError=true;busy=false;pending=[];showRecovery('Terrain generation failed. Reload to retry.');};
    function pumpTiles(){
      if(busy||paused||terrainError||!pending.length)return;
      activeJob=pending.shift();busy=true;worker.postMessage({...activeJob,id:++jobID});
    }
    function updateTiles(force=false){
      const tx=Math.round(camera.position.x/TILE),tz=Math.round(camera.position.z/TILE);
      if(!force&&tx===tileOriginX&&tz===tileOriginZ)return;
      tileOriginX=tx;tileOriginZ=tz;pending=[];
      for(let dz=-RANGE;dz<=RANGE;dz++)for(let dx=-RANGE;dx<=RANGE;dx++){
        const cx=tx+dx,cz=tz+dz,id=cx+','+cz,old=tiles.get(id);
        if(old?.segments===segments())continue;
        if(activeJob?.tx===cx&&activeJob?.tz===cz&&activeJob?.segments===segments())continue;
        pending.push({tx:cx,tz:cz,segments:segments(),distance:dx*dx+dz*dz});
      }
      pending.sort((a,b)=>a.distance-b.distance);
      for(const [id,tile] of tiles)if(Math.abs(tile.mesh.position.x/TILE-tx)>RANGE||Math.abs(tile.mesh.position.z/TILE-tz)>RANGE){disposeTile(tile);tiles.delete(id)}
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
    function createStars(){
      let seed=8319;function sr(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
      const count=isTouch?1900:3100,a=new Float32Array(count*3);
      for(let i=0;i<count;i++){
        const u=sr()*2-1,t=sr()*TWO_PI,r=7000+sr()*2000,k=Math.sqrt(1-u*u);
        a[i*3]=r*k*Math.cos(t);a[i*3+1]=r*u;a[i*3+2]=r*k*Math.sin(t);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(a,3));
      const m=new THREE.PointsMaterial({color:0xd5def5,size:isTouch?1:1.5,sizeAttenuation:false,transparent:true,opacity:.82,depthWrite:false});
      stars=new THREE.Points(g,m);stars.frustumCulled=false;scene.add(stars);
    }
    function createEarth(){
      const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;
      const ctx=canvas.getContext('2d'),im=ctx.createImageData(512,256);
      for(let y=0;y<256;y++)for(let x=0;x<512;x++){
        const lon=x/512*TWO_PI,lat=(y/255-.5)*Math.PI;
        const n=fbm(x*.008,y*.014,5), cloud=fbm(x*.028+113,y*.036-27,3);
        const land=(n>.48 && Math.abs(lat)<1.2),ice=Math.abs(lat)>1.29;
        const i=(y*512+x)*4;let r,g,b;
        if(ice){r=195;g=210;b=218}else if(land){r=75+n*61;g=93+n*78;b=58+n*29}
        else {r=19+n*23;g=64+n*43;b=123+n*77}
        if(cloud>.57){const a=Math.min(.8,(cloud-.57)*3.7);r=r*(1-a)+225*a;g=g*(1-a)+229*a;b=b*(1-a)+232*a}
        im.data[i]=r;im.data[i+1]=g;im.data[i+2]=b;im.data[i+3]=255;
      }
      ctx.putImageData(im,0,0);
      const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
      const sphere=new THREE.SphereGeometry(145,40,28);
      earth=new THREE.Mesh(sphere,new THREE.MeshStandardMaterial({map:tex,roughness:1,metalness:0}));
      earth.position.set(1050,1380,-6300);scene.add(earth);
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
      $('cruise').addEventListener('click',()=>{boosting=!boosting;$('cruise').setAttribute('aria-pressed',String(boosting));$('cruise').textContent=boosting?'BOOST: ON':'BOOST ×3'});
      $('quality').addEventListener('click',()=>{lowPower=!lowPower;configureGraphics()});
      $('reset').addEventListener('click',()=>resetFlight());
      $('start').addEventListener('click',()=>{if(!renderer)return;running=true;$('overlay').classList.add('hidden')});
    }
    function resetFlight(){
      camera.position.set(startPoint.x,height(startPoint.x,startPoint.z)+72,startPoint.z);
      resetInput();yaw=targetYaw=0;pitch=targetPitch=-.18;moveSmoothed.set(0,0,0);updateTiles();
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
        if(tiles.has(Math.round(nextX/TILE)+','+Math.round(nextZ/TILE))){camera.position.x=nextX;camera.position.z=nextZ}
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
        stars.position.copy(camera.position);
        earth.position.set(camera.position.x+1050,camera.position.y+1340,camera.position.z-6300);
        const surface=ground(camera.position.x,camera.position.z);
        sun.position.set(camera.position.x+1200,surface+650,camera.position.z-700);
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
        scene=new THREE.Scene();scene.background=new THREE.Color(0x010205);
        camera=new THREE.PerspectiveCamera(isTouch?74:70,innerWidth/innerHeight,.5,18000);
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
        camera.position.set(0,height(0,170)+72,170);
        createStars();createEarth();createRocks();updateTiles();
        initControls();configureGraphics();
        renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();showRecovery('Graphics context lost. Reload to recover.')});
        if(renderer.backend?.device?.lost)renderer.backend.device.lost.then(()=>showRecovery('Graphics device disconnected. Reload to recover.'));
        while(!tiles.has('0,0')&&!terrainError)await new Promise(r=>setTimeout(r,20));
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
