/**
 * @license
 * Cesium - https://github.com/CesiumGS/cesium
 * Version 1.141.0
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

import{a as f}from"./chunk-LYLRYC4L.js";import"./chunk-EARRZPMO.js";import"./chunk-IH7GXIUB.js";import{a as u}from"./chunk-XR7MN4PJ.js";import"./chunk-EYZUSGKM.js";import"./chunk-AXNBHUAG.js";import"./chunk-XU6O4MRS.js";import"./chunk-VXCJOT4W.js";import"./chunk-VBYOXOSM.js";import"./chunk-EZSKHVA2.js";import"./chunk-2ZYB3DYT.js";import"./chunk-ZY2KCIWI.js";import"./chunk-A35GG5WJ.js";import"./chunk-FC6IYMYF.js";import"./chunk-U3YGOX3C.js";import"./chunk-XZBHEBLF.js";import"./chunk-SP35IT73.js";import"./chunk-DC3K7YTH.js";import"./chunk-PQ3V63XF.js";import"./chunk-EHC3BDVP.js";import"./chunk-TM6SYYHO.js";import"./chunk-VXAZXMUX.js";import"./chunk-GF67PEXE.js";import"./chunk-5XHUDY37.js";function h(c,d){let e=f.upsampleMesh(c),t=e.vertices.buffer,i=e.indices.buffer,s=e.westIndicesSouthToNorth.buffer,o=e.southIndicesEastToWest.buffer,r=e.eastIndicesNorthToSouth.buffer,n=e.northIndicesWestToEast.buffer;return d.push(t,i,s,o,r,n),{verticesBuffer:t,indicesBuffer:i,vertexCountWithoutSkirts:e.vertexCountWithoutSkirts,indexCountWithoutSkirts:e.indexCountWithoutSkirts,encoding:e.encoding,westIndicesBuffer:s,southIndicesBuffer:o,eastIndicesBuffer:r,northIndicesBuffer:n,minimumHeight:e.minimumHeight,maximumHeight:e.maximumHeight,boundingSphere:e.boundingSphere3D,orientedBoundingBox:e.orientedBoundingBox,horizonOcclusionPoint:e.horizonOcclusionPoint}}var I=u(h);export{I as default};
