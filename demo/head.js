import {Renderer, RendererConfig} from "../renderer.js";
import {StaticModel} from "../static_model.js";
import {mat3, mat4, vec3, vec4} from "../gl-matrix/index.js";
import {TEST0, TEST1, TEST2, TESTP1, TESTP2, TESTP3, TESTP4} from "../test.js";
import {LightModel} from "../light_model.js";
import {loadPmxTextureModel} from "../load_pmx_model.js";


function getNormal(position) {
    let count = (position.length / 9) | 0;
    let normalBuffer = new Float32Array(count * 9);
    for (let face = 0; face < count; face++) {
        let a = [position[face * 9], position[face * 9 + 1], position[face * 9 + 2]];
        let b = [position[face * 9 + 3], position[face * 9 + 4], position[face * 9 + 5]];
        let c = [position[face * 9 + 6], position[face * 9 + 7], position[face * 9 + 8]];
        let n = vec3.cross(vec3.create(), vec3.sub(vec3.create(), b, a), vec3.sub(vec3.create(), c, b));
        vec3.normalize(n, n);
        for (let vertex = 0; vertex < 3; vertex++) {
            normalBuffer[face * 9 + vertex * 3] = n[0];
            normalBuffer[face * 9 + vertex * 3 + 1] = n[1];
            normalBuffer[face * 9 + vertex * 3 + 2] = n[2];
        }
    }
    return normalBuffer;
}

function getArea(position) {
    let count = (position.length / 9) | 0;
    let areaBuffer = new Float32Array(count);
    for (let face = 0; face < count; face++) {
        let a = [position[face * 9], position[face * 9 + 1], position[face * 9 + 2]];
        let b = [position[face * 9 + 3], position[face * 9 + 4], position[face * 9 + 5]];
        let c = [position[face * 9 + 6], position[face * 9 + 7], position[face * 9 + 8]];
        let n = vec3.cross(vec3.create(), vec3.sub(vec3.create(), b, a), vec3.sub(vec3.create(), c, b));
        areaBuffer[face] = vec3.len(n) / 2;
    }
    return areaBuffer;
}

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

let model0 = new LightModel(renderer);
model0.setData(TEST0, getNormal(TEST0), getArea(TEST0));
model0.lightPower = 1;
vec4.copy(model0.modelInfo.emit.buffer, [0, 0, 0, 0]);
vec4.copy(model0.modelInfo.light.buffer, [47, 38, 31, 1]);
vec4.copy(model0.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
renderer.models.push(model0);


let model1 = new StaticModel(renderer);
model1.setData(TEST1, getNormal(TEST1));
vec4.copy(model1.modelInfo.emit.buffer, [0, 0, 0, 1]);
vec4.copy(model1.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(model1);

let modelP1 = new StaticModel(renderer);
modelP1.setData(TESTP1, getNormal(TESTP1));
vec4.copy(modelP1.modelInfo.emit.buffer, [0, 0, 0, 1]);
vec4.copy(modelP1.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(modelP1);
let modelP2 = new StaticModel(renderer);
modelP2.setData(TESTP2, getNormal(TESTP2));
vec4.copy(modelP2.modelInfo.emit.buffer, [0, 0, 0, 1]);
vec4.copy(modelP2.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(modelP2);
let modelP3 = new StaticModel(renderer);
modelP3.setData(TESTP3, getNormal(TESTP3));
vec4.copy(modelP3.modelInfo.emit.buffer, [0, 0, 0, 1]);
vec4.copy(modelP3.modelInfo.diffuse.buffer, [0.63, 0.06, 0.05, 1]);
renderer.models.push(modelP3);
let modelP4 = new StaticModel(renderer);
modelP4.setData(TESTP4, getNormal(TESTP4));
vec4.copy(modelP4.modelInfo.emit.buffer, [0, 0, 0, 1]);
vec4.copy(modelP4.modelInfo.diffuse.buffer, [0.14, 0.45, 0.091, 1]);
renderer.models.push(modelP4);

let model2 = new StaticModel(renderer);
model2.setData(TEST2, getNormal(TEST2));
let bunny = mat4.create();
mat4.translate(bunny, bunny, [300, 180, 100]);
mat4.scale(bunny, bunny, [0.5, 0.5, 0.5]);
mat4.copy(model2.modelInfo.model.buffer, bunny);
vec4.copy(model2.modelInfo.emit.buffer, [0.6, 0.6, 0.6, 1]);
vec4.copy(model2.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
renderer.models.push(model2);

let pmx = await loadPmxTextureModel(renderer, new URL("../ningguang/凝光.pmx", document.baseURI));

let matrix = mat4.create();
mat4.translate(matrix, matrix, [310, 0, 280]);
mat4.scale(matrix, matrix, [20, 20, 20]);
let nm = mat3.normalFromMat4([], matrix);
pmx.forEach(model => {
    mat4.copy(model.modelInfo.model.buffer, matrix);
    let nn = model.modelInfo.normalModel.buffer;
    nn[0] = nm[0];
    nn[1] = nm[1];
    nn[2] = nm[2];
    nn[3] = 0;
    nn[4] = nm[3];
    nn[5] = nm[4];
    nn[6] = nm[5];
    nn[7] = 0;
    nn[8] = nm[6];
    nn[9] = nm[7];
    nn[10] = nm[8];
    nn[11] = 0;
    nn[12] = 0;
    nn[13] = 0;
    nn[14] = 0;
    nn[15] = 0;
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

