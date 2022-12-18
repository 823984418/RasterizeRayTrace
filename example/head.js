import {Renderer, RendererConfig} from "../renderer.js";
import {mat3, mat4, vec3, vec4} from "../gl-matrix/index.js";
import {loadPmxTextureModel} from "../load_pmx_model.js";
import {loadObjLightModelWithoutNormal, loadObjStaticModelWithoutNormal} from "../load_obj_model.js";
import {mat4FromMat3} from "../kits.js";


/**
 *
 * @type {HTMLCanvasElement}
 */
let canvas = document.querySelector("#targetCanvas");
let gpu = navigator.gpu;
let adapter = await gpu.requestAdapter({
    powerPreference: "high-performance",
});

let limitMap = [];
for (let key of Object.getOwnPropertyNames(GPUSupportedLimits.prototype)) {
    if (key === "constructor") {
        continue;
    }
    limitMap.push(`${key} : ${adapter.limits[key]}`);
}

let device = await adapter.requestDevice({
    label: "renderer",
});

let config = new RendererConfig();
config.renderWidth = 1024;
config.renderHeight = 1024;
config.composeWidth = config.renderWidth;
config.composeHeight = config.renderHeight;
config.traceMappingSize = 800;
config.traceWordSize = 500;
config.shadowTextureSize = 256;
config.lightTextureSize = 128;
config.traceCount = 2;
config.traceDepth = 6;
config.lightSampleCount = 2;
config.shadowNearDistance = 10;
config.shadowFarDistance = 900;
config.traceDepthBias = 0.005;
config.shadowDepthBias = 0.001;
config.debug_taa = false;
config.taa_factor = 0.95;
config.taa_maxDeltaZ = 0.005;
config.taa_fastPower = 1 / 9;
let renderer = new Renderer(device, config);

vec3.copy(renderer.traceCenter, [278, 273, 300]);
let context = canvas.getContext("webgpu");
context.configure({
    device: device,
    format: "rgba8unorm",
    alphaMode: "opaque",
});
renderer.context = context;

let boxMatrix = mat4.create();
mat4.scale(boxMatrix, boxMatrix, [1, 1.093, 1]);

let light = loadObjLightModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/light.obj")).text());
light.lightPower = 1;
vec4.copy(light.modelInfo.light.buffer, [47, 38, 31, 1]);
vec4.copy(light.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
mat4.copy(light.modelInfo.model.buffer, boxMatrix);
renderer.models.push(light);

let floor = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/floor.obj")).text());
vec4.copy(floor.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
mat4.copy(floor.modelInfo.model.buffer, boxMatrix);
renderer.models.push(floor);

let left = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/left.obj")).text());
vec4.copy(left.modelInfo.diffuse.buffer, [0.63, 0.06, 0.05, 1]);
mat4.copy(left.modelInfo.model.buffer, boxMatrix);
renderer.models.push(left);

let right = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/right.obj")).text());
vec4.copy(right.modelInfo.diffuse.buffer, [0.14, 0.45, 0.091, 1]);
mat4.copy(right.modelInfo.model.buffer, boxMatrix);
renderer.models.push(right);

let bunny = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/bunny/bunny.obj")).text());
vec4.copy(bunny.modelInfo.emit.buffer, [0.6, 0.6, 0.6, 1]);
vec4.copy(bunny.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
let bunnyMatrix = mat4.create();
mat4.translate(bunnyMatrix, bunnyMatrix, [375, 152, 250]);
mat4.scale(bunnyMatrix, bunnyMatrix, [800, 800, 800]);
mat4.rotateY(bunnyMatrix, bunnyMatrix, Math.PI);
mat4.copy(bunny.modelInfo.model.buffer, bunnyMatrix);
mat4.copy(bunny.modelInfo.normalModel.buffer, mat4FromMat3(mat3.normalFromMat4([], bunnyMatrix)));
renderer.models.push(bunny);

let pmx = await loadPmxTextureModel(renderer, new URL("../models/ningguang/凝光.pmx", document.baseURI));
let matrix = mat4.create();
mat4.translate(matrix, matrix, [310, 0, 280]);
mat4.scale(matrix, matrix, [20, 20, 20]);
pmx.forEach(model => {
    mat4.copy(model.modelInfo.model.buffer, matrix);
    mat4.copy(model.modelInfo.normalModel.buffer, mat4FromMat3(mat3.normalFromMat4([], matrix)));
});

let eye = vec3.add([], [278, 273, 300], vec3.rotateY([], vec3.rotateX([], [0, 0, -1100], [0, 0, 0], 0), [0, 0, 0], 0));
renderer.setCamera(eye, [278, 273, 300], [0, 1, 0], Math.PI * 0.22, canvas.clientWidth / canvas.clientHeight, 500, 2000);

document.querySelector("#info").innerText = "渲染中";
renderer.begin();

renderer.onRenderFinishListeners.push(() => {
    if (renderer.lastTime - renderer.beginTime > 10000) {
        renderer.end();
        document.querySelector("#info").innerText =
            `时间:${renderer.lastTime - renderer.beginTime}ms `
            + `帧计数:${renderer.renderIndex}`;
    }
});

