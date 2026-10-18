import {buildTile,buildHorizon,configureTerrain,configureDetail} from './terrain.js';
onmessage=({data})=>{
 if(data.type==='init'){configureTerrain(data.metadata,data.buffer);if(data.detailMetadata)configureDetail(data.detailMetadata,data.detailBuffer);postMessage({type:'ready'});return;}
 const {tx,tz,segments,id,rangeKm}=data;
 const buffers=data.type==='horizon'?buildHorizon(tx,tz,rangeKm):buildTile(tx,tz,segments);
 postMessage({type:data.type,tx,tz,segments,id,...buffers},Object.values(buffers).map(a=>a.buffer));
};
