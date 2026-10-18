import {GeoVector,MakeTime,SiderealTime,Rotation_EQD_EQJ,RotateVector,Vector} from './astronomy.js';
const DEG=Math.PI/180,AU=149597870700,R=1737400;
const sin=d=>Math.sin(d*DEG),cos=d=>Math.cos(d*DEG);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const SITE={latitude:26.1322,longitude:3.6339};
// IAU 2009 lunar orientation (Archinal et al. 2011, table 2), relative to ICRF/J2000.
export function lunarOrientation(date){
 const d=MakeTime(date).tt,T=d/36525;
 const E=[0,125.045-.0529921*d,250.089-.1059842*d,260.008+13.0120009*d,176.625+13.3407154*d,357.529+.9856003*d,311.589+26.4057084*d,134.963+13.0649930*d,276.617+.3287146*d,34.226+1.7484877*d,15.134-.1589763*d,119.743+.0036096*d,239.961+.1643573*d,25.053+12.9590088*d];
 const ra=269.9949+.0031*T-3.8787*sin(E[1])-.1204*sin(E[2])+.0700*sin(E[3])-.0172*sin(E[4])+.0072*sin(E[6])-.0052*sin(E[10])+.0043*sin(E[13]);
 const dec=66.5392+.0130*T+1.5419*cos(E[1])+.0239*cos(E[2])-.0278*cos(E[3])+.0068*cos(E[4])-.0029*cos(E[6])+.0009*cos(E[7])+.0008*cos(E[10])-.0009*cos(E[13]);
 const w=38.3213+13.17635815*d-1.4e-12*d*d+3.5610*sin(E[1])+.1208*sin(E[2])-.0642*sin(E[3])+.0158*sin(E[4])+.0252*sin(E[5])-.0066*sin(E[6])-.0047*sin(E[7])-.0046*sin(E[8])+.0028*sin(E[9])+.0052*sin(E[10])+.0040*sin(E[11])+.0019*sin(E[12])-.0044*sin(E[13]);
 return {ra,dec,w};
}
export function inertialToBody(vector,date){
 const {ra,dec,w}=lunarOrientation(date),a=(90+ra)*DEG,b=(90-dec)*DEG,c=w*DEG;
 const rz=(v,t)=>[Math.cos(t)*v[0]+Math.sin(t)*v[1],-Math.sin(t)*v[0]+Math.cos(t)*v[1],v[2]];
 const v=rz(vector,a),u=[v[0],Math.cos(b)*v[1]+Math.sin(b)*v[2],-Math.sin(b)*v[1]+Math.cos(b)*v[2]];
 return rz(u,c);
}
export function observerBasis(x=0,z=0){
 const lat=SITE.latitude*DEG,lon=SITE.longitude*DEG;
 const up0=[Math.cos(lat)*Math.cos(lon),Math.cos(lat)*Math.sin(lon),Math.sin(lat)];
 const east0=[-Math.sin(lon),Math.cos(lon),0],north0=[-Math.sin(lat)*Math.cos(lon),-Math.sin(lat)*Math.sin(lon),Math.cos(lat)];
 const distance=Math.hypot(x,z),angle=distance/R;
 const up=up0.map((v,i)=>v*Math.cos(angle)+(distance?(east0[i]*x-north0[i]*z)/distance*Math.sin(angle):0));
 const longitude=Math.atan2(up[1],up[0]),latitude=Math.asin(up[2]);
 const east=[-Math.sin(longitude),Math.cos(longitude),0],north=[-Math.sin(latitude)*Math.cos(longitude),-Math.sin(latitude)*Math.sin(longitude),Math.cos(latitude)];
 return {up,east,north};
}
export function toLocal(vector,date,basis=observerBasis()){
 const v=inertialToBody(vector,date);
 // World x east, y up, negative z north.
 return [dot(v,basis.east),dot(v,basis.up),-dot(v,basis.north)];
}
export function bodyPosition(name,date,x=0,z=0,altitude=0){
 const t=MakeTime(date),moon=GeoVector('Moon',t,false);
 const v=name==='Earth'?{x:0,y:0,z:0}:GeoVector(name,t,false);
 const relative=[(v.x-moon.x)*AU,(v.y-moon.y)*AU,(v.z-moon.z)*AU];
 const local=toLocal(relative,date,observerBasis(x,z));local[1]-=R+altitude;
 const distance=Math.hypot(...local),direction=local.map(a=>a/distance);
 return {direction,distance,altitude:Math.asin(direction[1])/DEG,azimuth:(Math.atan2(direction[0],-direction[2])/DEG+360)%360};
}
export function createSkyTransform(date,x=0,z=0){
 const basis=observerBasis(x,z),columns=[[1,0,0],[0,1,0],[0,0,1]].map(v=>toLocal(v,date,basis));
 return vector=>[0,1,2].map(i=>columns[0][i]*vector[0]+columns[1][i]*vector[1]+columns[2][i]*vector[2]);
}
export function starDirection(star,date,x=0,z=0,transform=null){
 const years=(date.getTime()-Date.UTC(2000,0,1,12))/86400000/365.25;
 const dec=(star[3]+star[7]*years/3600000)*DEG;
 const ra=(star[2]*15+star[6]*years/(3600000*Math.max(.001,Math.cos(star[3]*DEG))))*DEG;
 const vector=[Math.cos(dec)*Math.cos(ra),Math.cos(dec)*Math.sin(ra),Math.sin(dec)];
 return transform?transform(vector):toLocal(vector,date,observerBasis(x,z));
}
export function angularRadius(radius,distance){return Math.asin(radius/distance)}

export function earthAxes(date,x=0,z=0){
 const time=MakeTime(date),angle=SiderealTime(time)*Math.PI/12,rotation=Rotation_EQD_EQJ(time),basis=observerBasis(x,z);
 const local=vector=>{const v=RotateVector(rotation,new Vector(...vector,time));return toLocal([v.x,v.y,v.z],date,basis)};
 return {x:local([Math.cos(angle),Math.sin(angle),0]),y:local([0,0,1]),z:local([Math.sin(angle),-Math.cos(angle),0])};
}
