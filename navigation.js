const R=1737400,D=Math.PI/180;
export const WAYPOINTS=[
 {id:'falcon',name:'Falcon landing site',short:'FALCON',latitude:26.1322,longitude:3.6339,radius:90,altitude:150,description:'Apollo 15 landing site. The descent stage stayed on the Moon.'},
 {id:'rille',name:'Hadley Rille overlook',short:'HADLEY RILLE',latitude:26.15,longitude:3.575,radius:300,altitude:250,description:'An approximate educational viewpoint near the rille, not a surveyed Apollo EVA station.'},
 {id:'hadley',name:'Mons Hadley',short:'MONS HADLEY',latitude:26.69,longitude:4.17,radius:1200,altitude:350,description:'Regional mountain waypoint; an approximate aim point, not a surveyed summit marker.'}
];
// Inverse of the azimuthal equidistant projection used to build our elevation extracts.
export function coordinatesToWorld(latitude,longitude){
 const p=latitude*D,l=(longitude-3.6339)*D,p0=26.1322*D;
 const c=Math.acos(Math.max(-1,Math.min(1,Math.sin(p0)*Math.sin(p)+Math.cos(p0)*Math.cos(p)*Math.cos(l))));
 const k=c<1e-10?1:c/Math.sin(c);
 return {x:R*k*Math.cos(p)*Math.sin(l),z:-R*k*(Math.cos(p0)*Math.sin(p)-Math.sin(p0)*Math.cos(p)*Math.cos(l))};
}
for(const w of WAYPOINTS)Object.assign(w,coordinatesToWorld(w.latitude,w.longitude));
export function bearingTo(x,z,target){return (Math.atan2(target.x-x,z-target.z)/D+360)%360;}
export function heading(yaw){return ((-yaw/D)%360+360)%360;}
export function cardinal(degrees){return ['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8];}
export function navigationReadout(x,z,yaw,target){
 const bearing=bearingTo(x,z,target),direction=((bearing-heading(yaw)+540)%360)-180;
 return {distance:Math.hypot(target.x-x,target.z-z),bearing,heading:heading(yaw),arrow:Math.abs(direction)<15?'↑':direction>0?'→':'←'};
}
export const MISSIONS=[
 {id:'meet-falcon',target:'falcon',title:'Meet Falcon',instruction:'Approach the Apollo 15 descent stage.',fact:'Apollo 15 landed on 30 July 1971. David Scott and James Irwin explored the surface while Alfred Worden orbited above. Falcon’s descent stage stayed on the Moon when the crew lifted off.'},
 {id:'visit-rille',target:'rille',title:'Find the ancient lava channel',instruction:'Fly to the Hadley Rille overlook and descend below 250 m above the surface.',fact:'Hadley Rille is a winding volcanic channel. Ancient lava helped carve or form it billions of years ago. Apollo 15’s astronauts photographed its walls and collected rocks near its edge.'},
 {id:'visit-hadley',target:'hadley',title:'Explore Mons Hadley',instruction:'Reach the mountain waypoint within 350 m above the terrain. Use BOOST for the journey.',fact:'Mons Hadley rises roughly four kilometres above the nearby plain. It is part of the Apennine mountains along the edge of the ancient Imbrium impact basin.'},
 {id:'return-base',target:'falcon',title:'Return to Falcon',instruction:'Fly home to Falcon, or use ↺ BASE to return.',fact:'Apollo 15 was the first Apollo mission to use a lunar rover. Scott and Irwin drove almost 28 kilometres across the Moon. You have completed your own lunar discovery expedition!'}
];
export function createProgress(saved=null){
 let count=0;
 if(saved?.version===1&&saved.started===true&&Array.isArray(saved.completed))while(count<MISSIONS.length&&saved.completed[count]===MISSIONS[count].id)count++;
 const completed=MISSIONS.slice(0,count).map(m=>m.id);
 return {version:1,started:saved?.started===true,completed,pending:completed.length&&saved?.pending===completed.at(-1)?saved.pending:null};
}
export function startExpedition(){return {version:1,started:true,completed:[],pending:null};}
export function currentMission(progress){return progress.started&&!progress.pending?MISSIONS[progress.completed.length]??null:null;}
export function visitMission(progress,position,surface){
 const mission=currentMission(progress);if(!mission)return progress;
 const target=WAYPOINTS.find(w=>w.id===mission.target),clearance=position.y-surface;
 if(Math.hypot(position.x-target.x,position.z-target.z)>target.radius||clearance<0||clearance>target.altitude)return progress;
 return {...progress,completed:[...progress.completed,mission.id],pending:mission.id};
}
export function continueExpedition(progress){return {...progress,pending:null};}
