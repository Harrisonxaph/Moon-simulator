import {buildTile} from './terrain.js';
onmessage=({data:{tx,tz,segments,id}})=>{const data=buildTile(tx,tz,segments);postMessage({tx,tz,segments,id,...data},Object.values(data).map(a=>a.buffer));};
