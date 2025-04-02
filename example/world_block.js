import {Renderer, RendererConfig} from "../renderer.js";
import {mat4, vec3, vec4} from "../gl-matrix/index.js";
import {StaticModel} from "../static_model.js";
import {getNormal} from "../kits.js";
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
config.renderWidth = 600;
config.renderHeight = 600;
config.composeWidth = config.renderWidth;
config.composeHeight = config.renderHeight;
config.traceMappingSize = 500;
config.traceWordSize = 600;
config.shadowTextureSize = 256;
config.lightTextureSize = 128;
config.traceCount = 20;
config.traceDepth = 1;
config.lightSampleCount = 1;
config.shadowNearDistance = 10;
config.shadowFarDistance = 900;
config.traceDepthBias = 0.005;
config.shadowDepthBias = 0.001;
config.debug_taa = true;
config.taa_factor = 0.995;
config.taa_maxDeltaZ = 0.0005;
config.taa_fastPower = 1 / 20;
let renderer = new Renderer(device, config);

let center = [-600, -273, 300];

vec3.copy(renderer.traceCenter, center);
let context = canvas.getContext("webgpu");
context.configure({
    device: device,
    format: "rgba8unorm",
    alphaMode: "opaque",
})
gpu.getPreferredCanvasFormat()
renderer.context = context;

class World {

    position = [];

    block(minX, minY, minZ, maxX, maxY, maxZ) {
        let p000 = [minX, minY, minZ];
        let p001 = [minX, minY, maxZ];
        let p010 = [minX, maxY, minZ];
        let p011 = [minX, maxY, maxZ];
        let p100 = [maxX, minY, minZ];
        let p101 = [maxX, minY, maxZ];
        let p110 = [maxX, maxY, minZ];
        let p111 = [maxX, maxY, maxZ];
        this.position.push(...p000, ...p001, ...p011);
        this.position.push(...p000, ...p011, ...p010);
        this.position.push(...p100, ...p111, ...p101);
        this.position.push(...p100, ...p110, ...p111);

        this.position.push(...p000, ...p101, ...p001);
        this.position.push(...p000, ...p100, ...p101);
        this.position.push(...p010, ...p011, ...p111);
        this.position.push(...p010, ...p111, ...p110);

        this.position.push(...p000, ...p010, ...p110);
        this.position.push(...p000, ...p110, ...p100);
        this.position.push(...p001, ...p111, ...p011);
        this.position.push(...p001, ...p101, ...p111);
    }

    blockOne(x, y, z) {
        this.block(x, y, z, x + 1, y + 1, z + 1);
    }

}

let light = loadObjLightModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/light.obj")).text());
light.lightPower = 1;
vec4.copy(light.modelInfo.light.buffer, [47, 38, 31, 1]);
vec4.copy(light.modelInfo.diffuse.buffer, [0.9, 0.9, 0.9, 1]);
renderer.models.push(light);

// let floor = loadObjStaticModelWithoutNormal(renderer, await (await fetch("../models/cornellbox/floor.obj")).text());
// vec4.copy(floor.modelInfo.diffuse.buffer, [0.725, 0.71, 0.68, 1]);
// renderer.models.push(floor);

let world = new World();
for (let i = 0; i < 500; i++) {
    let x = (Math.random() * 20);
    let y = (Math.random() * 20);
    let z = (Math.random() * 20);
    world.blockOne(x - 20, y - 30, z - 20);
}
let model = new StaticModel(renderer, "back");
let position = new Float32Array(world.position);
model.setData(position, getNormal(position));
mat4.scale(model.modelInfo.model.buffer, mat4.create(), [30, 30, 30]);
vec4.copy(model.modelInfo.diffuse.buffer, [1, 1, 1, 1]);
renderer.models.push(model);


renderer.onRenderFinishListeners.push(() => {
    document.querySelector("#frameCount").innerText = `${renderer.renderIndex}`;
    document.querySelector("#time").innerText = `${(renderer.lastTime - renderer.beginTime) | 0}`;
    if (renderer.renderIndex % 60 === 59) {
        document.querySelector("#fps").innerText = `${((6000000 / (renderer.lastTime - renderer.lastFpsTime)) | 0) / 100}`;
        renderer.lastFpsTime = renderer.lastTime;
    }
})
renderer.begin();

let x = 0;
let y = 0;

let mouseBeginX = 0;
let mouseBeginY = 0;
let target = 0;
let vertical  = 0;
renderer.onRenderListeners.push(() => {
    let eye = vec3.add([], center, vec3.rotateY([], vec3.rotateX([], [0, 0, -10], [0, 0, 0], y * 8), [0, 0, 0], -x * 8));
    renderer.setCamera(eye, center, [0, 1, 0], Math.PI * 0.22, canvas.clientWidth / canvas.clientHeight, 1, 2000);
});


canvas.addEventListener("mousemove", event => {
    x = event.offsetX / canvas.clientWidth - 0.5;
    y = event.offsetY / canvas.clientHeight - 0.5;

    if (!config.debug_taa) {
        renderer.beginTime = performance.now();
        renderer.renderIndex = 0;
    }
});

canvas.addEventListener("keypress", event => {
    console.log(event);
});
