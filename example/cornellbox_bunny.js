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
config.renderWidth = 512;
config.renderHeight = 512;
config.composeWidth = config.renderWidth * 2;
config.composeHeight = config.renderHeight * 2;
config.traceMappingSize = 500;
config.traceWordSize = 500;
config.shadowTextureSize = 256;
config.lightTextureSize = 128;
config.traceCount = 16;
config.traceDepth = 1;
config.lightSampleCount = 2;
config.shadowNearDistance = 10;
config.shadowFarDistance = 900;
config.traceDepthBias = 0.005;
config.shadowDepthBias = 0.001;
config.debug_taa = true;
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
vec4.copy(bunny.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
renderer.models.push(bunny);


let x = 0;
let y = 0;

canvas.addEventListener("mousemove", event => {
    x = event.offsetX / canvas.clientWidth - 0.5;
    y = event.offsetY / canvas.clientHeight - 0.5;
});

renderer.onRenderListeners.push(() => {
    let now = performance.now();
    let bunnyMatrix = mat4.create();
    mat4.translate(bunnyMatrix, bunnyMatrix, [300 + Math.sin(now * 0.001) * 100, 0, 250]);
    mat4.scale(bunnyMatrix, bunnyMatrix, [1100, 1100, 1100]);
    mat4.rotateY(bunnyMatrix, bunnyMatrix, Math.PI + now * 0.0005);
    mat4.copy(bunny.modelInfo.model.buffer, bunnyMatrix);
    mat4.copy(bunny.modelInfo.normalModel.buffer, mat4FromMat3(mat3.normalFromMat4([], bunnyMatrix)));

    let eye = vec3.add([], [278, 273, 300], vec3.rotateY([], vec3.rotateX([], [0, 0, -1100], [0, 0, 0], y * 4), [0, 0, 0], -x * 4));
    renderer.setCamera(eye, [278, 273, 300], [0, 1, 0], Math.PI * 0.22, canvas.clientWidth / canvas.clientHeight, 500, 2000);
});

renderer.onRenderFinishListeners.push(() => {
    document.querySelector("#info").innerText =
        `时间:${(renderer.lastTime - renderer.beginTime) | 0}ms `
        + `帧计数:${renderer.renderIndex}`;
});


renderer.begin();