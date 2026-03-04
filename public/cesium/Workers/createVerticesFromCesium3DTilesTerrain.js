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

import{a as u}from"./chunk-GGYRJCFH.js";import"./chunk-OWJWRYGM.js";import"./chunk-OUZ34R6R.js";import{a as f}from"./chunk-RH6XN2ZV.js";import"./chunk-A3G5ORRJ.js";import"./chunk-C5F5JZAC.js";import"./chunk-MSR5BKMH.js";import"./chunk-SRXN2PE4.js";import"./chunk-T4S74O3D.js";import"./chunk-PNKG35NX.js";import"./chunk-453UE67U.js";import"./chunk-Q6F3SO7I.js";import"./chunk-QROIA2H7.js";import"./chunk-ANKVUFZB.js";import"./chunk-TITUTZNR.js";import"./chunk-LAGV6F3C.js";import"./chunk-PAML32O3.js";import"./chunk-3ULTL2FZ.js";import"./chunk-HBIOVTO5.js";import"./chunk-3MO6V622.js";import"./chunk-OJH7UFER.js";import"./chunk-6J7K26F7.js";import"./chunk-YSN2K4FT.js";import"./chunk-VAPRBQYE.js";function a(c,d){return u.createMesh(c).then(function(e){let t=e.vertices.buffer,r=e.indices.buffer,s=e.westIndicesSouthToNorth.buffer,o=e.southIndicesEastToWest.buffer,i=e.eastIndicesNorthToSouth.buffer,n=e.northIndicesWestToEast.buffer;return d.push(t,r,s,o,i,n),{verticesBuffer:t,indicesBuffer:r,vertexCountWithoutSkirts:e.vertexCountWithoutSkirts,indexCountWithoutSkirts:e.indexCountWithoutSkirts,encoding:e.encoding,westIndicesBuffer:s,southIndicesBuffer:o,eastIndicesBuffer:i,northIndicesBuffer:n}})}var T=f(a);export{T as default};
