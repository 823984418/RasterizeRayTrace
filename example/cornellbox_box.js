import {Renderer, RendererConfig} from "../renderer.js";
import {vec3, vec4} from "../gl-matrix/index.js";
import {loadObjLightModelWithoutNormal, loadObjStaticModelWithoutNormal} from "../load_obj_model.js";

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
let renderer = new Renderer(device, config);

vec3.copy(renderer.traceCenter, [278, 273, 300]);
let context = canvas.getContext("webgpu");
context.configure({
    device: device,
    format: "rgba8unorm",
    alphaMode: "opaque",
});
renderer.context = context;

let light = loadObjLightModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/light.obj")).text());
light.lightPower = 1;
vec4.copy(light.modelInfo.light.buffer, [47, 38, 31, 1]);
vec4.copy(light.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
renderer.models.push(light);

let floor = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/floor.obj")).text());
vec4.copy(floor.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(floor);

let left = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/left.obj")).text());
vec4.copy(left.modelInfo.diffuse.buffer, [0.63, 0.06, 0.05, 1]);
renderer.models.push(left);

let right = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/right.obj")).text());
vec4.copy(right.modelInfo.diffuse.buffer, [0.14, 0.45, 0.091, 1]);
renderer.models.push(right);

let shortbox = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/shortbox.obj")).text());
vec4.copy(shortbox.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(shortbox);

let tallbox = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/tallbox.obj")).text());
vec4.copy(tallbox.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(tallbox);


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

