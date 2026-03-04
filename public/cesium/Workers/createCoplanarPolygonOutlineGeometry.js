/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.139.0
 *
 * Copyright 2011-2022 Cesium Contributors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Columbus View (Pat. Pend.)
 *
 * Portions licensed separately.
 * See https://github.com/CesiumGS/cesium/blob/main/LICENSE.md for full licensing details.
 */

import{a as T}from"./chunk-SUBLUDWJ.js";import"./chunk-C5F5JZAC.js";import{a as l}from"./chunk-ISGFCDPW.js";import"./chunk-CK62LO4L.js";import{a as G}from"./chunk-VBYW5FXW.js";import{a as C}from"./chunk-MWVHSLYS.js";import"./chunk-MSR5BKMH.js";import"./chunk-W5T7UWKW.js";import"./chunk-SRXN2PE4.js";import"./chunk-T4S74O3D.js";import"./chunk-NSDLDP72.js";import{a as L}from"./chunk-OHMLE6SB.js";import"./chunk-IFBNVX3N.js";import"./chunk-PNKG35NX.js";import"./chunk-453UE67U.js";import{a as w}from"./chunk-Q6F3SO7I.js";import{a as O}from"./chunk-DXDIQEOK.js";import{b,c as d,d as k}from"./chunk-XLJBHQML.js";import{c as P}from"./chunk-QROIA2H7.js";import"./chunk-ANKVUFZB.js";import"./chunk-TITUTZNR.js";import"./chunk-LAGV6F3C.js";import{a as H}from"./chunk-PAML32O3.js";import"./chunk-3ULTL2FZ.js";import"./chunk-HBIOVTO5.js";import{c as g}from"./chunk-3MO6V622.js";import{a as y,c as u}from"./chunk-OJH7UFER.js";import"./chunk-6J7K26F7.js";import{b as m}from"./chunk-YSN2K4FT.js";import{e as f}from"./chunk-VAPRBQYE.js";function E(o){let e=o.length,t=new Float64Array(e*3),i=w.createTypedArray(e,e*2),r=0,a=0;for(let n=0;n<e;n++){let p=o[n];t[r++]=p.x,t[r++]=p.y,t[r++]=p.z,i[a++]=n,i[a++]=(n+1)%e}let s=new O({position:new k({componentDatatype:H.DOUBLE,componentsPerAttribute:3,values:t})});return new d({attributes:s,indices:i,primitiveType:b.LINES})}function c(o){o=o??u.EMPTY_OBJECT;let e=o.polygonHierarchy;m.defined("options.polygonHierarchy",e),this._polygonHierarchy=e,this._workerName="createCoplanarPolygonOutlineGeometry",this.packedLength=l.computeHierarchyPackedLength(e,y)+1}c.fromPositions=function(o){o=o??u.EMPTY_OBJECT,m.defined("options.positions",o.positions);let e={polygonHierarchy:{positions:o.positions}};return new c(e)};c.pack=function(o,e,t){return m.typeOf.object("value",o),m.defined("array",e),t=t??0,t=l.packPolygonHierarchy(o._polygonHierarchy,e,t,y),e[t]=o.packedLength,e};var v={polygonHierarchy:{}};c.unpack=function(o,e,t){m.defined("array",o),e=e??0;let i=l.unpackPolygonHierarchy(o,e,y);e=i.startingIndex,delete i.startingIndex;let r=o[e];return f(t)||(t=new c(v)),t._polygonHierarchy=i,t.packedLength=r,t};c.createGeometry=function(o){let e=o._polygonHierarchy,t=e.positions;if(t=L(t,y.equalsEpsilon,!0),t.length<3||!T.validOutline(t))return;let r=l.polygonOutlinesFromHierarchy(e,!1);if(r.length===0)return;let a=[];for(let p=0;p<r.length;p++){let _=new G({geometry:E(r[p])});a.push(_)}let s=C.combineInstances(a)[0],n=P.fromPoints(e.positions);return new d({attributes:s.attributes,indices:s.indices,primitiveType:s.primitiveType,boundingSphere:n})};var h=c;function A(o,e){return f(e)&&(o=h.unpack(o,e)),o._ellipsoid=g.clone(o._ellipsoid),h.createGeometry(o)}var Z=A;export{Z as default};
