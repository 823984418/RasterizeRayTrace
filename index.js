import {Renderer, RendererConfig} from "./renderer.js";
import {mat3, mat4, vec3, vec4} from "./gl-matrix/index.js";
import {loadObjLightModelWithoutNormal, loadObjStaticModelWithoutNormal} from "./load_obj_model.js";


window.addEventListener("error", event => {
    alert(`${event.message}
    ${event.error.stack}`);
});

/**
 *
 * @type {HTMLCanvasElement}
 */
let canvas = document.querySelector("#targetCanvas");
let gpu = navigator.gpu;
let adapter = await gpu.requestAdapter({
    powerPreference: "high-performance",
});

window.adapter = adapter;
let limitMap = [];
for (let key of Object.getOwnPropertyNames(GPUSupportedLimits.prototype)) {
    if (key === "constructor") {
        continue;
    }
    limitMap.push(`${key} : ${adapter.limits[key]}`);
}
document.querySelector("#feature").innerText = [...adapter.features].join("\n");

document.querySelector("#limit").innerText = limitMap.join("\n");
let device = await adapter.requestDevice({
    label: "renderer",
});

if (GPUCommandEncoder.prototype.clearBuffer == null || true) {
    let zeroBuffer = device.createBuffer({
        size: 1024 * 1024 * 16,
        usage: GPUBufferUsage.COPY_SRC,
    });
    GPUCommandEncoder.prototype.clearBuffer = function (buffer, offset, size) {
        offset ??= 0;
        size ??= buffer.size - offset;
        this.copyBufferToBuffer(zeroBuffer, 0, buffer, offset, size);
    }
}

adapter.requestAdapterInfo().then(info => {
    document.querySelector("#gpuInfo").innerText = `${info.vendor} : ${info.architecture} : ${info.description}`;
});

let config = new RendererConfig();
config.renderWidth = 1024;
config.renderHeight = 1024;
config.composeWidth = config.renderWidth;
config.composeHeight = config.renderHeight;
config.traceMappingSize = 800;
config.traceWordSize = 800;
config.shadowTextureSize = 256;
config.lightTextureSize = 128;
config.traceCount = 2;
config.traceDepth = 2;
config.lightSampleCount = 1;
config.shadowNearDistance = 10;
config.shadowFarDistance = 900;
config.traceDepthBias = 0.005;
config.shadowDepthBias = 0.001;
config.debug_taa = false;
config.taa_factor = 0.93;
config.taa_maxDeltaZ = 0.005;
config.taa_fastPower = 1 / 2;
let renderer = new Renderer(device, config);
renderer.onRenderFinishListeners.push(() => {

    document.querySelector("#frameCount").innerText = `${renderer.renderIndex}`;
    document.querySelector("#time").innerText = `${(renderer.lastTime - renderer.beginTime) | 0}`;
    if (renderer.renderIndex % 60 === 59) {
        document.querySelector("#fps").innerText = `${((6000000 / (renderer.lastTime - renderer.lastFpsTime)) | 0) / 100}`;
        renderer.lastFpsTime = renderer.lastTime;
    }

})

vec3.copy(renderer.traceCenter, [278, 273, 300]);
let context = canvas.getContext("webgpu");
context.configure({
    device: device,
    format: "rgba8unorm",
    alphaMode: "premultiplied",
});
renderer.context = context;

let boxMatrix = mat4.create();
mat4.scale(boxMatrix, boxMatrix, [1, 1.093, 1]);

let useLight = true;
if (useLight) {
    let light = loadObjLightModelWithoutNormal(renderer, await (await fetch("models/cornellbox/light.obj")).text());
    light.lightPower = 1;
    vec4.copy(light.modelInfo.light.buffer, [47, 38, 31, 1]);
    vec4.copy(light.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
    mat4.copy(light.modelInfo.model.buffer, boxMatrix);
    renderer.models.push(light);
} else {
    let light = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/light.obj")).text());
    vec4.copy(light.modelInfo.emit.buffer, [47, 38, 31, 1]);
    vec4.copy(light.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
    mat4.copy(light.modelInfo.model.buffer, boxMatrix);
    renderer.models.push(light);
}

let floor = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/floor.obj")).text());
vec4.copy(floor.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
mat4.copy(floor.modelInfo.model.buffer, boxMatrix);
renderer.models.push(floor);

let left = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/left.obj")).text());
vec4.copy(left.modelInfo.diffuse.buffer, [0.63, 0.06, 0.05, 1]);
mat4.copy(left.modelInfo.model.buffer, boxMatrix);
renderer.models.push(left);

let right = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/right.obj")).text());
vec4.copy(right.modelInfo.diffuse.buffer, [0.14, 0.45, 0.091, 1]);
mat4.copy(right.modelInfo.model.buffer, boxMatrix);
renderer.models.push(right);

// let bunny = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/bunny/bunny.obj")).text());
// vec4.copy(bunny.modelInfo.emit.buffer, [0.6, 0.6, 0.6, 1]);
// vec4.copy(bunny.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
// let bunnyMatrix = mat4.create();
// mat4.translate(bunnyMatrix, bunnyMatrix, [375, 152, 250]);
// mat4.scale(bunnyMatrix, bunnyMatrix, [800, 800, 800]);
// mat4.rotateY(bunnyMatrix, bunnyMatrix, Math.PI);
// mat4.copy(bunny.modelInfo.model.buffer, bunnyMatrix);
// mat4.copy(bunny.modelInfo.normalModel.buffer, mat4FromMat3(mat3.normalFromMat4([], bunnyMatrix)));
// renderer.models.push(bunny);
//
// let pmx = await loadPmxTextureModel(renderer, new URL("models/ningguang/凝光.pmx", document.baseURI));


let shortbox = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/shortbox.obj")).text());
vec4.copy(shortbox.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(shortbox);

let tallbox = loadObjStaticModelWithoutNormal(renderer, await (await fetch("models/cornellbox/tallbox.obj")).text());
vec4.copy(tallbox.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
renderer.models.push(tallbox);

let x = 0;
let y = 0;

let matrix = mat4.create();
mat4.translate(matrix, matrix, [250, 0, 280]);
mat4.translate(matrix, matrix, [60, 0, 0]);
mat4.scale(matrix, matrix, [20, 20, 20]);
let begin = performance.now();
if (config.debug_taa) {
    mat4.rotateY(matrix, matrix, (performance.now() - begin) * 0.0001);
}

// pmx.forEach(model => {
//     mat4.copy(model.modelInfo.model.buffer, matrix);
//     mat4.copy(model.modelInfo.normalModel.buffer, mat4FromMat3(mat3.normalFromMat4([], matrix)));
// });

function updateCamera() {

    let eye = vec3.add([], [278, 273, 300], vec3.rotateY([], vec3.rotateX([], [0, 0, -1100], [0, 0, 0], y * 4), [0, 0, 0], -x * 4));

    renderer.setCamera(eye, [278, 273, 300], [0, 1, 0], Math.PI * 0.22, canvas.clientWidth / canvas.clientHeight, 500, 2000);
    if (!config.debug_taa) {
        renderer.beginTime = performance.now();
        renderer.renderIndex = 0;
    }
    // renderer.render();
}

updateCamera();

renderer.begin();

renderer.onRenderListeners.push(() => {
    if (config.debug_taa) {


        let matrix = mat4.create();
        mat4.translate(matrix, matrix, [250, 0, 280]);
        mat4.translate(matrix, matrix, [Math.sin((performance.now() - begin) * 0.001) * 100 + 60, 0, 0]);
        // mat4.translate(matrix, matrix, [-x * 700, -y * 700, 0]);
        mat4.scale(matrix, matrix, [20, 20, 20]);
        if (config.debug_taa) {
            mat4.rotateY(matrix, matrix, (performance.now() - begin) * 0.0001);
        }
        let nm = mat3.normalFromMat4([], matrix);
        // pmx.forEach(model => {
        //     mat4.copy(model.modelInfo.model.buffer, matrix);
        //     let nn = model.modelInfo.normalModel.buffer;
        //     nn[0] = nm[0];
        //     nn[1] = nm[1];
        //     nn[2] = nm[2];
        //     nn[3] = 0;
        //     nn[4] = nm[3];
        //     nn[5] = nm[4];
        //     nn[6] = nm[5];
        //     nn[7] = 0;
        //     nn[8] = nm[6];
        //     nn[9] = nm[7];
        //     nn[10] = nm[8];
        //     nn[11] = 0;
        //     nn[12] = 0;
        //     nn[13] = 0;
        //     nn[14] = 0;
        //     nn[15] = 0;
        //
        // });
    }


});


console.log(renderer);
window.renderer = renderer;


canvas.addEventListener("mousemove", event => {
    x = event.offsetX / canvas.clientWidth - 0.5;
    y = event.offsetY / canvas.clientHeight - 0.5;
    updateCamera();
});
