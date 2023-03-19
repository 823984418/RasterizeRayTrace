import {mat4, vec3, vec4} from "./gl-matrix/index.js";
import {BufferArray, BufferMat4x4F32, BufferStruct, BufferUint32, BufferVec4F32} from "./buffer_struct.js";
import {array, arrayCycleIndex} from "./kits.js";


let cubeTarget = Object.freeze([
    Object.freeze([-1, 0, 0]),
    Object.freeze([1, 0, 0]),
    Object.freeze([0, -1, 0]),
    Object.freeze([0, 1, 0]),
    Object.freeze([0, 0, -1]),
    Object.freeze([0, 0, 1]),
]);

let cubeUp = Object.freeze([
    Object.freeze([0, -1, 0]),
    Object.freeze([0, -1, 0]),
    Object.freeze([0, 0, 1]),
    Object.freeze([0, 0, -1]),
    Object.freeze([0, -1, 0]),
    Object.freeze([0, -1, 0]),
]);

/**
 * 生成一个随机方向以及其垂直的方向
 */
function randomDirection(dir, ver) {
    let r = Math.random() * 2 * Math.PI;
    let z = Math.random() * 2 - 1;
    let x = Math.sin(r);
    let y = Math.cos(r);
    let h = Math.sqrt(1 - z * z);
    dir[0] = x * h;
    dir[1] = y * h;
    dir[2] = z;

    ver[0] = -y;
    ver[1] = x;
    ver[2] = 0;
}

export class ShadowInfoStruct extends BufferStruct {

    static WGSL = "struct ShadowInfo {lightPositionAndFactor: vec4<f32>, viewProjection: mat4x4<f32>}";

    constructor() {
        super();
        this.setStruct([
            this.lightPositionAndFactor,
            this.viewProjection,
        ], 256);
    }

    lightPositionAndFactor = new BufferVec4F32();

    viewProjection = new BufferMat4x4F32();

}

export class CameraInfoStruct extends BufferStruct {

    static WGSL = "struct CameraInfo {cameraPosition: vec4<f32>, viewProjection: mat4x4<f32>, lastViewProjection: mat4x4<f32>, directionToArray: array<vec4<f32>, traceCount>, lightArray: array<vec4<f32>, lightSampleCount>}";

    constructor(config) {
        super();
        this.directionToArray = new BufferArray(BufferVec4F32, config.traceCount, 16);
        this.lightArray = new BufferArray(BufferVec4F32, config.lightSampleCount, 16);
        this.setStruct([
            this.cameraPosition,
            this.viewProjection,
            this.lastViewProjection,
            this.directionToArray,
            this.lightArray,
        ], 256);
    }

    cameraPosition = new BufferVec4F32();
    viewProjection = new BufferMat4x4F32();
    lastViewProjection = new BufferMat4x4F32();
    /**
     * @type {BufferArray}
     */
    directionToArray;
    /**
     * @type {BufferArray}
     */
    lightArray;

}

export class TraceInfoStruct extends BufferStruct {

    static WGSL = "struct TraceInfo {directionFrom: vec4<f32>, directionTo: vec4<f32>, viewProjection: mat4x4<f32>, lightArray: array<vec4<f32>, lightSampleCount>}";

    constructor(config) {
        super();
        this.lightArray = new BufferArray(BufferVec4F32, config.lightSampleCount, 16);
        this.setStruct([
            this.directionFrom,
            this.directionTo,
            this.viewProjection,
            this.lightArray,
        ], 256);
    }

    directionFrom = new BufferVec4F32();
    directionTo = new BufferVec4F32();
    viewProjection = new BufferMat4x4F32();

    /**
     * @type {BufferArray}
     */
    lightArray;
}

export class ComposeInfoStruct extends BufferStruct {

    static WGSL = "struct ComposeInfo {lastCameraMatrix: mat4x4<f32>, renderIndex: u32}";

    constructor() {
        super();
        this.setStruct([
            this.lastCameraMatrix,
            this.renderIndex,
        ], 256);
    }

    lastCameraMatrix = new BufferMat4x4F32();
    renderIndex = new BufferUint32();

}

export class RendererInfoBufferStruct extends BufferStruct {

    /**
     * @param {RendererConfig} config
     */
    constructor(config) {
        super();
        this.shadowInfoArray2 = array(config.lightSampleCount, _ => array(6, _ => new ShadowInfoStruct()));
        this.cameraInfo = new CameraInfoStruct(config);
        this.traceInfoArray2 = array(config.traceCount, _ => array(config.traceDepth, _ => new TraceInfoStruct(config)));
        this.composeInfo = new ComposeInfoStruct();
        this.setStruct([
            ...this.shadowInfoArray2.flat(),
            this.cameraInfo,
            ...this.traceInfoArray2.flat(),
            this.composeInfo,
        ]);

    }

    buffer;

    /**
     * @type {ShadowInfoStruct[][]}
     */
    shadowInfoArray2;

    /**
     * @type {CameraInfoStruct}
     */
    cameraInfo;

    /**
     * @type {TraceInfoStruct[][]}
     */
    traceInfoArray2;

    /**
     * @type {ComposeInfoStruct}
     */
    composeInfo;

    setLightPositionAndFactor(light, position) {
        this.shadowInfoArray2[light].forEach(i => vec4.copy(i.lightPositionAndFactor.buffer, position));
        vec4.copy(this.cameraInfo.lightArray.array[light].buffer, position);
        this.traceInfoArray2.forEach(i => i.forEach(j => vec4.copy(j.lightArray.array[light].buffer, position)));
    }

    setShadowViewProjection(light, cube, matrix) {
        mat4.copy(this.shadowInfoArray2[light][cube].viewProjection.buffer, matrix);
    }

    setCameraPosition(position) {
        let p = [position[0], position[1], position[2], 1.0];
        vec4.copy(this.cameraInfo.cameraPosition.buffer, p);
    }

    setCameraViewProjection(matrix) {
        mat4.copy(this.cameraInfo.viewProjection.buffer, matrix);
    }

    setTraceDirection(count, depth, direction) {
        if (depth !== 0) {
            vec4.copy(this.traceInfoArray2[count][depth - 1].directionTo.buffer, [...direction, 0]);
            vec4.copy(this.traceInfoArray2[count][depth].directionFrom.buffer, [...direction, 0]);
        } else {
            vec4.copy(this.cameraInfo.directionToArray.array[count].buffer, [...direction, 0]);
            vec4.copy(this.traceInfoArray2[count][0].directionFrom.buffer, [...direction, 0]);
        }
    }

    setTraceViewProjection(count, depth, matrix) {
        mat4.copy(this.traceInfoArray2[count][depth].viewProjection.buffer, matrix);
    }

    setRenderIndex(i) {
        this.composeInfo.renderIndex.buffer[0] = i;
    }

}

export class RendererConfig {
    renderWidth = 1024;
    renderHeight = 1024;
    composeWidth = 1024;
    composeHeight = 1024;
    lightSampleCount = 1;
    traceCount = 1;
    traceDepth = 1;
    lightTextureSize = 128;
    shadowTextureSize = 128;
    traceMappingSize = 2048;
    traceWordSize = 2000;
    shadowNearDistance = 1;
    shadowFarDistance = 1000;
    traceDepthBias = 0;
    shadowDepthBias = 0;
    debug_clearCameraFactor = true;
    debug_taa = true;
    taa_factor = 0.98;
    taa_maxDeltaZ = 0.01;
    taa_fastPower = 0.3;
    light_factor = 50.0;

    toWGSL() {
        return `// WGSL
const renderWidth: u32 = ${this.renderWidth | 0};
const renderHeight: u32 = ${this.renderHeight | 0};
const composeWidth: u32 = ${this.composeWidth | 0};
const composeHeight: u32 = ${this.composeHeight | 0};
const lightSampleCount: u32 = ${this.lightSampleCount | 0};
const traceCount: u32 = ${this.traceCount | 0};
const traceDepth: u32 = ${this.traceDepth | 0};
const lightTextureSize: u32 = ${this.lightTextureSize | 0};
const shadowTextureSize: u32 = ${this.shadowTextureSize | 0};
const traceMappingSize: u32 = ${this.traceMappingSize | 0};
const traceWordSize: u32 = ${this.traceWordSize | 0};
const shadowNearDistance: f32 = ${this.shadowNearDistance};
const shadowFarDistance: f32 = ${this.shadowFarDistance};
const traceDepthBias: f32 = ${this.traceDepthBias};
const shadowDepthBias: f32 = ${this.shadowDepthBias};
const debug_taa: bool = ${!!this.debug_taa};
const taa_factor: f32 = ${this.taa_factor};
const taa_maxDeltaZ: f32 = ${this.taa_maxDeltaZ};
const taa_fastPower: f32 = ${this.taa_fastPower};
const light_factor: f32 = ${this.light_factor};
const PI: f32 = 3.1415916;

`;
    }

}

let RENDERER_TRACE_MAPPING_CODE = `// WGSL
${TraceInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> traceInfo: TraceInfo;

@group(0) @binding(1)
var pointPosition: texture_2d<f32>;

@group(0) @binding(2)
var<storage, read_write> mappingBuffer: array<atomic<u32>>;

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index : u32) -> @builtin(position) vec4<f32> {
    let pos = vec2<f32>(vec2<u32>((vertex_index % 3) & 1, (vertex_index % 3) >> 1));
    return vec4(pos * 4 - 1, 0.0, 1.0);
}

struct FragmentOutput {
    @location(0) link: u32,
    @location(1) depth: f32,
}

@fragment
fn fragment_main(@builtin(position) position: vec4<f32>) -> FragmentOutput {
    var pos = vec2<u32>(position.xy);
    let inputPosition: vec4<f32> = textureLoad(pointPosition, vec2<i32>(pos), 0);
    if (inputPosition.w != 1) {
        return FragmentOutput(0, 0);
    }
    let mapping = traceInfo.viewProjection * inputPosition;
    let div: vec3<f32> = mapping.xyz / mapping.w;
    if (div.x >= -1 && div.x <= 1 && div.y >= -1 && div.y <= 1) {
        let map_pos: vec2<u32> = vec2<u32>((div.xy + vec2(1, -1)) * vec2(0.5, -0.5) * f32(traceMappingSize));
        let p = map_pos.x + map_pos.y * traceMappingSize;
        let link = atomicExchange(&mappingBuffer[p], pos.x + pos.y * renderWidth + 1);
        return FragmentOutput(link, div.z);
    } else {
        return FragmentOutput(0, 0);
    }
}
`;
let RENDERER_COMPOSE_CODE = `// WGSL
${ComposeInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> composeInfo: ComposeInfo;

@group(0) @binding(1)
var lastComposeColorTexture: texture_2d<f32>;

@group(0) @binding(2)
var overlayColorTexture: texture_2d<f32>;

@group(0) @binding(3)
var lastPositionTexture: texture_2d<f32>;

@group(0) @binding(4)
var composeSampler: sampler;

@group(0) @binding(5)
var lastDepthTexture: texture_depth_2d;

@group(0) @binding(6)
var composeColorSampler: sampler;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    pos: vec2<f32>,
}

struct FragmentInput {

    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    pos: vec2<f32>,
    
}

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index: u32) -> VertexOutput {
    let pos = vec2<f32>(vec2<u32>((vertex_index % 3) & 1, (vertex_index % 3) >> 1));
    return VertexOutput(vec4(pos * 4 - 1, 0.0, 1.0), pos * 4 - 1);
}

@fragment
fn fragment_main(input: FragmentInput) -> @location(0) vec4<f32> {
    var inputPos = input.pos;
    inputPos.y = -inputPos.y;
    inputPos = inputPos * 0.5 + 0.5;
    let fPos = inputPos * vec2(f32(renderWidth), f32(renderHeight));
    let deltaPos = (fract(fPos) - 0.5) / vec2(f32(renderWidth), f32(renderHeight));
    
    var color: vec4<f32> = textureSampleLevel(overlayColorTexture, composeSampler, inputPos, 0);
    var facing: f32 = 1;
    if (debug_taa) {
        var lastPosition = textureSampleLevel(lastPositionTexture, composeSampler, inputPos, 0);
        lastPosition.y = -lastPosition.y;
        facing = lastPosition.w;
        if (lastPosition.x > -1 && lastPosition.x < 1 && lastPosition.y > -1 && lastPosition.y < 1 && lastPosition.z > 0 && lastPosition.z < 1) {
            let lastDepth = textureSampleLevel(lastDepthTexture, composeSampler, lastPosition.xy * 0.5 + 0.5, 0);
            if (abs(lastDepth - lastPosition.z) < taa_maxDeltaZ) {
                let lastComposeColor: vec4<f32> = textureSampleLevel(lastComposeColorTexture, composeColorSampler, lastPosition.xy * 0.5 + 0.5 + deltaPos, 0);
                let p = abs(lastComposeColor.a);
                if ((lastComposeColor.a > 0) == (facing > 0)) {
                    if (p == 1) {
                        color = vec4(color.rgb * (1 - taa_factor) + lastComposeColor.rgb * taa_factor, 1);
                    } else {
                        color = vec4((color.rgb * p + lastComposeColor.rgb * taa_fastPower) / (p + taa_fastPower), min(p + taa_fastPower, 1));
                    }
                }
            }
        }
    } else {
        let lastComposeColor = textureSampleLevel(lastComposeColorTexture, composeColorSampler, inputPos, 0).rgb;
        let ab = vec2<f32>(f32(composeInfo.renderIndex), 1) / f32(composeInfo.renderIndex + 1);
        color = vec4(lastComposeColor.rgb * ab.x + color.rgb * ab.y, 1);
    }
    
    color.w *= facing;
    return color;
}
`;
let RENDERER_DISPLAY_CODE = `// WGSL

@group(0) @binding(0)
var composeColorTexture: texture_2d<f32>;

@group(0) @binding(1)
var cameraColorTexture: texture_2d<f32>;

@group(0) @binding(2)
var displaySampler: sampler;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    pos: vec2<f32>,
}

struct FragmentInput {

    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    pos: vec2<f32>,
    
}

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index : u32) -> VertexOutput {
    let pos = vec2<f32>(vec2<u32>((vertex_index % 3) & 1, (vertex_index % 3) >> 1));
    return VertexOutput(vec4(pos * 4 - 1, 0.0, 1.0), pos * 4 - 1);
}

@fragment
fn fragment_main(input: FragmentInput) -> @location(0) vec4<f32> {
    var pos = input.pos;
    pos.y = -pos.y;
    pos = pos * 0.5 + 0.5;
    let composeColor = textureSampleLevel(composeColorTexture, displaySampler, pos, 0);
    let cameraColor = textureSampleLevel(cameraColorTexture, displaySampler, pos, 0);
    return vec4(pow(composeColor.rgb + cameraColor.rgb, vec3(0.6)), 1);
}
`;


export class Renderer {

    constructor(device, config = new RendererConfig()) {
        Object.seal(this);
        this.device = device;
        this.config = Object.freeze(config);
        this.configWGSL = config.toWGSL();
        this.state = new RendererInfoBufferStruct(config);
        this.state.buffer = new ArrayBuffer(this.state.use_size());
        this.state.allocate(this.state.buffer, 0);
        this.state.traceInfoArray2.forEach(i => {
            if (i.length !== 0) {
                vec4.set(i[i.length - 1].directionTo.buffer, 0, 0, 0, 2);
            }
        })

        this.shadowProjection = new Float32Array(16);
        mat4.perspectiveZO(this.shadowProjection, Math.PI / 2, 1, config.shadowNearDistance, config.shadowFarDistance);

        let traceMappingShaderModule = device.createShaderModule({
            label: "traceMappingShaderModule",
            code: `
${this.configWGSL}
${RENDERER_TRACE_MAPPING_CODE}
            `,
        });
        let composeShaderModule = device.createShaderModule({
            label: "composeShaderModule",
            code: `
${this.configWGSL}
${RENDERER_COMPOSE_CODE}
`,
        });
        let displayShaderModule = device.createShaderModule({
            label: "displayShaderModule",
            code: `
${this.configWGSL}
${RENDERER_DISPLAY_CODE}
`,
        });

        this.stateBuffer = device.createBuffer({
            label: "stateBuffer",
            size: this.state.use_size(),
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.lightTexture = device.createTexture({
            label: "lightTexture",
            size: [config.lightTextureSize, config.lightTextureSize, 6 * config.lightSampleCount],
            dimension: "2d",
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.shadowTexture = device.createTexture({
            label: "shadowTexture",
            size: [config.shadowTextureSize, config.shadowTextureSize, 6 * config.lightSampleCount],
            dimension: "2d",
            format: "depth32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.cameraDepthTexture = device.createTexture({
            label: "cameraDepthTexture",
            size: [config.renderWidth, config.renderHeight, 2],
            dimension: "2d",
            format: "depth32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.cameraColorTexture = device.createTexture({
            label: "cameraColorTexture",
            size: [config.renderWidth, config.renderHeight, 1],
            dimension: "2d",
            format: "rgba16float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.cameraPositionTexture = device.createTexture({
            label: "cameraPositionTexture",
            size: [config.renderWidth, config.renderHeight, 1],
            dimension: "2d",
            format: "rgba32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.cameraLastPositionTexture = device.createTexture({
            label: "cameraLastPositionTexture",
            size: [config.renderWidth, config.renderHeight, 1],
            dimension: "2d",
            format: "rgba32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        this.cameraFactorTexture = device.createTexture({
            label: "cameraFactorTexture",
            size: [config.renderWidth, config.renderHeight, config.traceCount],
            dimension: "2d",
            format: "rgba16float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.tracePositionTexture = device.createTexture({
            label: "tracePositionTexture",
            size: [config.renderWidth, config.renderHeight, 2],
            dimension: "2d",
            format: "rgba32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.traceFactorTexture = device.createTexture({
            label: "traceFactorTexture",
            size: [config.renderWidth, config.renderHeight, 2],
            dimension: "2d",
            format: "rgba16float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING,
        });
        this.traceMaxDepthTexture = device.createTexture({
            label: "traceMaxDepthTexture",
            size: [config.renderWidth, config.renderHeight, 1],
            dimension: "2d",
            format: "r32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.traceLinkTexture = device.createTexture({
            label: "traceLinkTexture",
            size: [config.renderWidth, config.renderHeight, 1],
            dimension: "2d",
            format: "r32uint",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.traceMappingBuffer = device.createBuffer({
            label: "traceMappingBuffer",
            size: config.traceMappingSize * config.traceMappingSize * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.traceDepthBuffer = device.createBuffer({
            label: "traceDepthBuffer",
            size: config.renderWidth * config.renderHeight * Uint32Array.BYTES_PER_ELEMENT,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        this.traceMappingStencilTexture = device.createTexture({
            label: "traceMappingStencilTexture",
            size: [config.traceMappingSize, config.traceMappingSize, 1],
            dimension: "2d",
            format: "stencil8",
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        this.colorTexture = device.createTexture({
            label: "colorTexture",
            size: [config.renderWidth, config.renderHeight, 2],
            dimension: "2d",
            format: "rgba16float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_DST | GPUTextureUsage.COPY_SRC | GPUTextureUsage.STORAGE_BINDING,
        });
        this.composeColorTexture = device.createTexture({
            label: "composeColorTexture",
            size: [config.composeWidth, config.composeHeight, 2],
            dimension: "2d",
            format: config.debug_taa ? "rgba16float" : "rgba32float",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        this.lightSampler = device.createSampler({
            label: "lightSampler",
            minFilter: "linear",
            magFilter: "linear",
        });
        this.shadowSampler = device.createSampler({
            label: "shadowSampler",
            minFilter: "nearest",
            magFilter: "nearest",
        });
        this.composeSampler = device.createSampler({
            label: "composeSampler",
            minFilter: "nearest",
            magFilter: "nearest",
        });
        this.composeColorSampler = device.createSampler({
            label: "composeColorSampler",
            minFilter: config.debug_taa ? "linear" : "nearest",
            magFilter: config.debug_taa ? "linear" : "nearest",
        });
        this.displaySampler = device.createSampler({
            label: "displaySampler",
            minFilter: config.debug_taa ? "linear" : "nearest",
            magFilter: config.debug_taa ? "linear" : "nearest",
        });

        this.lightTexture2DViewArray = array(6 * config.lightSampleCount, i => this.lightTexture.createView({
            label: `lightTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.lightTextureCubeArrayView = this.lightTexture.createView({
            label: "lightTextureCubeArrayView",
            dimension: "cube-array",
        });
        this.shadowTexture2DViewArray = array(6 * config.lightSampleCount, i => this.shadowTexture.createView({
            label: `shadowTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.shadowTextureCubeArrayView = this.shadowTexture.createView({
            label: "shadowTextureCubeArrayView",
            dimension: "cube-array",
        });
        this.cameraDepthTexture2DViewArray = array(2, i => this.cameraDepthTexture.createView({
            label: `cameraDepthTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.cameraColorTexture2DView = this.cameraColorTexture.createView({
            label: "cameraColorTexture2DView",
            dimension: "2d",
        });
        this.cameraPositionTexture2DView = this.cameraPositionTexture.createView({
            label: "cameraPositionTexture2DView",
            dimension: "2d",
        });
        this.cameraLastPositionTexture2DView = this.cameraLastPositionTexture.createView({
            label: "cameraLastPositionTexture2DView",
            dimension: "2d",
        });
        this.cameraFactorTexture2DArrayView = this.cameraFactorTexture.createView({
            label: "cameraFactorTexture2DArrayView",
            dimension: "2d-array",
        });
        this.cameraFactorTexture2DViewArray = array(config.traceCount, i => this.cameraFactorTexture.createView({
            label: `cameraFactorTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.tracePositionTexture2DViewArray = array(2, i => this.tracePositionTexture.createView({
            label: `tracePositionTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
        }));
        this.traceFactorTexture2DViewArray = array(2, i => this.traceFactorTexture.createView({
            label: `traceFactorTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.traceMaxDepthTexture2DView = this.traceMaxDepthTexture.createView({
            label: "traceMaxDepthTexture2DView",
            dimension: "2d",
        });
        this.traceLinkTexture2DView = this.traceLinkTexture.createView({
            label: "traceLinkTexture2DView",
            dimension: "2d",
        });
        this.traceMappingStencilTexture2DView = this.traceMappingStencilTexture.createView({
            label: "traceMappingStubTexture2DView",
            dimension: "2d",
        });
        this.colorTexture2DViewArray = array(2, i => this.colorTexture.createView({
            label: `colorTexture2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));
        this.composeColorTexture2DViewArray = array(2, i => this.composeColorTexture.createView({
            label: `color2DViewArray[${i}]`,
            dimension: "2d",
            baseArrayLayer: i,
            arrayLayerCount: 1,
        }));

        let traceMappingBindGroup0Layout = device.createBindGroupLayout({
            label: "traceMappingBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"},
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {type: "storage"},
            }],
        });
        let composeBindGroup0Layout = device.createBindGroupLayout({
            label: "composeBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"},
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: config.debug_taa ? "float" : "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {type: "non-filtering"},
            }, {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: "depth", viewDimension: "2d"},
            }, {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {type: config.debug_taa ? "filtering" : "non-filtering"},
            }],
        });
        let displayBindGroup0Layout = device.createBindGroupLayout({
            label: "displayBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: config.debug_taa ? "float" : "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {sampleType: config.debug_taa ? "float" : "unfilterable-float", viewDimension: "2d"},
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {type: config.debug_taa ? "filtering" : "non-filtering"},
            }]
        });

        this.traceMappingPipeline = device.createRenderPipeline({
            label: "traceMappingPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [traceMappingBindGroup0Layout],
            }),
            vertex: {
                module: traceMappingShaderModule,
                entryPoint: "vertex_main",
            },
            fragment: {
                module: traceMappingShaderModule,
                entryPoint: "fragment_main",
                targets: [{
                    format: "r32uint",
                    writeMask: GPUColorWrite.RED,
                }, {
                    format: "r32float",
                    writeMask: GPUColorWrite.RED,
                }],
            },
        });
        this.composePipeline = device.createRenderPipeline({
            label: "composePipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [composeBindGroup0Layout],
            }),
            vertex: {
                module: composeShaderModule,
                entryPoint: "vertex_main",
            },
            fragment: {
                module: composeShaderModule,
                entryPoint: "fragment_main",
                targets: [{
                    format: config.debug_taa ? "rgba16float" : "rgba32float",
                }],
            },
        });
        this.displayPipeline = device.createRenderPipeline({
            label: "displayPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [displayBindGroup0Layout],
            }),
            vertex: {
                module: displayShaderModule,
                entryPoint: "vertex_main",
            },
            fragment: {
                module: displayShaderModule,
                entryPoint: "fragment_main",
                targets: [{
                    format: "rgba8unorm",
                }],
            },
        });

        this.lightBindGroup0Layout = device.createBindGroupLayout({
            label: "lightBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }],
        });
        this.shadowBindGroup0Layout = device.createBindGroupLayout({
            label: "shadowBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }],
        });
        this.cameraDepthBindGroup0Layout = device.createBindGroupLayout({
            label: "cameraDepthBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }],
        });
        this.cameraBindGroup0Layout = device.createBindGroupLayout({
            label: "cameraBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "cube-array",
                },
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "depth",
                    viewDimension: "cube-array",
                },
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    access: "write-only",
                    format: "rgba16float",
                    viewDimension: "2d-array",
                },
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "depth",
                    viewDimension: "2d",
                }
            }, {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering",
                },
            }, {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "non-filtering",
                },
            }, {
                binding: 7,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    access: "write-only",
                    format: "rgba32float",
                    viewDimension: "2d",
                }
            }],
        });
        this.traceDepthBindGroup0Layout = device.createBindGroupLayout({
            label: "traceDepthBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "read-only-storage",
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "uint",
                    viewDimension: "2d",
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "storage",
                }
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "unfilterable-float",
                    viewDimension: "2d",
                }
            }],
        });
        this.traceBindGroup0Layout = device.createBindGroupLayout({
            label: "traceBindGroup0Layout",
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "uniform",
                },
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "read-only-storage",
                }
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "uint",
                    viewDimension: "2d",
                }
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                buffer: {
                    type: "read-only-storage",
                }
            }, {
                binding: 4,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "float",
                    viewDimension: "cube-array",
                },
            }, {
                binding: 5,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "depth",
                    viewDimension: "cube-array",
                },
            }, {
                binding: 6,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "unfilterable-float",
                    viewDimension: "2d",
                },
            }, {
                binding: 7,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    access: "write-only",
                    format: "rgba16float",
                    viewDimension: "2d",
                }
            }, {
                binding: 8,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    access: "write-only",
                    format: "rgba32float",
                    viewDimension: "2d",
                }
            }, {
                binding: 9,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {
                    sampleType: "unfilterable-float",
                    viewDimension: "2d",
                },
            }, {
                binding: 10,
                visibility: GPUShaderStage.FRAGMENT,
                storageTexture: {
                    access: "write-only",
                    format: "rgba16float",
                    viewDimension: "2d",
                },
            }, {
                binding: 11,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "filtering",
                },
            }, {
                binding: 12,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {
                    type: "non-filtering",
                },
            }],
        });

        this.shadowBindGroup0Array2 = array(config.lightSampleCount, count => array(6, cube => device.createBindGroup({
            label: `shadowBindGroup0Array2[${count}][${cube}]`,
            layout: this.shadowBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.shadowInfoArray2[count][cube].offset,
                    size: this.state.shadowInfoArray2[count][cube].use_size(),
                },
            }],
        })));
        this.cameraDepthBindGroup0 = device.createBindGroup({
            label: "cameraDepthBindGroup0",
            layout: this.cameraDepthBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.cameraInfo.offset,
                    size: this.state.cameraInfo.use_size(),
                },
            }],
        });
        this.cameraBindGroup0Array = array(2, i => device.createBindGroup({
            label: `cameraBindGroup0[${i}]`,
            layout: this.cameraBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.cameraInfo.offset,
                    size: this.state.cameraInfo.use_size(),
                },
            }, {
                binding: 1,
                resource: this.lightTextureCubeArrayView,
            }, {
                binding: 2,
                resource: this.shadowTextureCubeArrayView,
            }, {
                binding: 3,
                resource: this.cameraFactorTexture2DArrayView,
            }, {
                binding: 4,
                resource: this.cameraDepthTexture2DViewArray[i],
            }, {
                binding: 5,
                resource: this.lightSampler,
            }, {
                binding: 6,
                resource: this.shadowSampler,
            }, {
                binding: 7,
                resource: this.cameraLastPositionTexture2DView,
            }],
        }));
        this.traceMappingBindGroup0Array2 = array(config.traceCount, count => array(config.traceDepth, depth => device.createBindGroup({
            label: `traceMappingBindGroup0Array2[${count}][${depth}]`,
            layout: traceMappingBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.traceInfoArray2[count][depth].offset,
                    size: this.state.traceInfoArray2[count][depth].use_size(),
                }
            }, {
                binding: 1,
                resource: depth === 0 ? this.cameraPositionTexture2DView : arrayCycleIndex(this.tracePositionTexture2DViewArray, depth),
            }, {
                binding: 2,
                resource: {buffer: this.traceMappingBuffer},
            }],
        })));
        this.traceDepthBindGroup0Array2 = array(config.traceCount, count => array(config.traceDepth, depth => device.createBindGroup({
            label: `traceDepthBindGroup0Array2[${count}][${depth}]`,
            layout: this.traceDepthBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.traceInfoArray2[count][depth].offset,
                    size: this.state.traceInfoArray2[count][depth].use_size(),
                }
            }, {
                binding: 1,
                resource: {
                    buffer: this.traceMappingBuffer,
                }
            }, {
                binding: 2,
                resource: this.traceLinkTexture2DView,
            }, {
                binding: 3,
                resource: {
                    buffer: this.traceDepthBuffer,
                }
            }, {
                binding: 4,
                resource: this.traceMaxDepthTexture2DView,
            }],
        })));
        this.traceBindGroup0Array2 = array(config.traceCount, count => array(config.traceDepth, depth => device.createBindGroup({
            label: `traceBindGroup0Array2[${count}][${depth}]`,
            layout: this.traceBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.traceInfoArray2[count][depth].offset,
                    size: this.state.traceInfoArray2[count][depth].use_size(),
                }
            }, {
                binding: 1,
                resource: {
                    buffer: this.traceMappingBuffer,
                }
            }, {
                binding: 2,
                resource: this.traceLinkTexture2DView,
            }, {
                binding: 3,
                resource: {
                    buffer: this.traceDepthBuffer,
                }
            }, {
                binding: 4,
                resource: this.lightTextureCubeArrayView,
            }, {
                binding: 5,
                resource: this.shadowTextureCubeArrayView,
            }, {
                binding: 6,
                resource: depth === 0 ? this.cameraFactorTexture2DViewArray[count] : arrayCycleIndex(this.traceFactorTexture2DViewArray, depth),
            }, {
                binding: 7,
                resource: arrayCycleIndex(this.traceFactorTexture2DViewArray, depth + 1),
            }, {
                binding: 8,
                resource: arrayCycleIndex(this.tracePositionTexture2DViewArray, depth + 1),
            }, {
                binding: 9,
                resource: this.colorTexture2DViewArray[1],
            }, {
                binding: 10,
                resource: this.colorTexture2DViewArray[0],
            }, {
                binding: 11,
                resource: this.lightSampler,
            }, {
                binding: 12,
                resource: this.shadowSampler,
            }],
        })));
        this.composeBindGroup0Array = array(2, i => device.createBindGroup({
            label: `composeBindGroup0Array[${i}]`,
            layout: composeBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.stateBuffer,
                    offset: this.state.composeInfo.offset,
                    size: this.state.composeInfo.use_size(),
                },
            }, {
                binding: 1,
                resource: arrayCycleIndex(this.composeColorTexture2DViewArray, i + 1),
            }, {
                binding: 2,
                resource: this.colorTexture2DViewArray[0],
            }, {
                binding: 3,
                resource: this.cameraLastPositionTexture2DView,
            }, {
                binding: 4,
                resource: this.composeSampler,
            }, {
                binding: 5,
                resource: arrayCycleIndex(this.cameraDepthTexture2DViewArray, i + 1),
            }, {
                binding: 6,
                resource: this.composeColorSampler,
            }],
        }));
        this.displayBindGroup0Array = array(2, i => device.createBindGroup({
            label: `displayBindGroup0Array[${i}]`,
            layout: displayBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: arrayCycleIndex(this.composeColorTexture2DViewArray, i),
            }, {
                binding: 1,
                resource: this.cameraColorTexture2DView,
            }, {
                binding: 2,
                resource: this.displaySampler,
            }],
        }));

        this.setCamera([0, 0, 0], [0, 1, 0], [0, 0, 1], 60 * Math.PI / 180, 1, 0.001, 1000);
    }

    /**
     * @type {number}
     */
    renderIndex = 0;

    /**
     * @type {RendererConfig}
     */
    config;

    /**
     * @type {string}
     */
    configWGSL;

    /**
     * @type {GPUDevice}
     */
    device;

    /**
     * @type {GPUCanvasContext}
     */
    context;

    /**
     * @type {Float32Array}
     */
    cameraPosition = new Float32Array(3);

    /**
     * @type {Float32Array}
     */
    traceCenter = new Float32Array(3);

    /**
     * @type {Model[]}
     */
    models = [];

    /**
     * @type {Float32Array}
     */
    shadowProjection;

    /**
     * @type {RendererInfoBufferStruct}
     */
    state;

    /// 资源

    /**
     * 状态缓冲
     *
     * @type {GPUBuffer}
     */
    stateBuffer;

    /**
     * 光源向四周辐射的亮度
     * 每六层构成一个立方体纹理
     *
     * @type {GPUTexture}
     */
    lightTexture;

    /**
     * 以光源为中心的深度纹理
     * 每六层构成一个立方体纹理
     *
     * @type {GPUTexture}
     */
    shadowTexture;

    /**
     * 相机深度纹理
     *
     * @type {GPUTexture}
     */
    cameraDepthTexture;

    /**
     * @type {GPUTexture}
     */
    cameraColorTexture;

    /**
     * 相机位置纹理
     *
     * @type {GPUTexture}
     */
    cameraPositionTexture;

    /**
     * 上一帧的位置
     *
     * @type {GPUTexture}
     */
    cameraLastPositionTexture;

    /**
     * 相机颜色系数纹理
     *
     * @type {GPUTexture}
     */
    cameraFactorTexture;

    /**
     * 追踪位置纹理
     * 两层轮换追踪位置
     *
     * @type {GPUTexture}
     */
    tracePositionTexture;

    /**
     * 追踪颜色系数纹理
     * 两层轮换累积追踪颜色系数
     *
     * @type {GPUTexture}
     */
    traceFactorTexture;

    /**
     * 追踪最大深度纹理
     *
     * @type {GPUTexture}
     */
    traceMaxDepthTexture;

    /**
     * 追踪链表节点纹理
     *
     * @type {GPUTexture}
     */
    traceLinkTexture;

    /**
     * 追踪链表头缓冲
     *
     * 指向一个位置
     * 0 代表空
     *
     * WebGPU 中储存纹理只写
     * 使用储存缓冲回退
     *
     * @type {GPUBuffer}
     */
    traceMappingBuffer;

    /**
     * 追踪深度缓冲
     *
     * WebGPU 中储存纹理只写
     * 使用储存缓冲回退
     *
     * @type {GPUBuffer}
     */
    traceDepthBuffer;

    /**
     * 用于追踪的深度模板附件占位符
     *
     * @type {GPUTexture}
     */
    traceMappingStencilTexture;

    /**
     * 颜色纹理
     * 两层轮换累积追踪颜色
     *
     * @type {GPUTexture}
     */
    colorTexture;

    /**
     * 输出颜色纹理
     * 两层轮换累积相机和追踪颜色
     * 两层轮换过滤输出颜色
     *
     * @type {GPUTexture}
     */
    composeColorTexture;

    /// 采样器

    /**
     * @type {GPUSampler}
     */
    lightSampler;

    /**
     * @type {GPUSampler}
     */
    shadowSampler;

    /**
     * @type {GPUSampler}
     */
    composeSampler;

    /**
     * @type {GPUSampler}
     */
    composeColorSampler;

    /**
     * @type {GPUSampler}
     */
    displaySampler;

    /// 纹理视图

    /**
     * `lightTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    lightTexture2DViewArray;

    /**
     * `lightTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    lightTextureCubeArrayView;

    /**
     * `lightTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    shadowTexture2DViewArray;

    /**
     * `lightTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    shadowTextureCubeArrayView;

    /**
     * `cameraDepthTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    cameraDepthTexture2DViewArray;

    /**
     * `cameraPositionTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    cameraPositionTexture2DView;

    /**
     * @type {GPUTextureView}
     */
    cameraColorTexture2DView;

    /**
     * @type {GPUTextureView}
     */
    cameraLastPositionTexture2DView;

    /**
     * `cameraFactorTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    cameraFactorTexture2DArrayView;

    /**
     * `cameraFactorTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    cameraFactorTexture2DViewArray;

    /**
     * `tracePositionTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    tracePositionTexture2DViewArray;

    /**
     * `traceFactorTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    traceFactorTexture2DViewArray;

    /**
     * `traceMaxDepthTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    traceMaxDepthTexture2DView;

    /**
     * `traceLinkTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    traceLinkTexture2DView;

    /**
     * `traceMappingStubTexture` 的视图
     *
     * @type {GPUTextureView}
     */
    traceMappingStencilTexture2DView;

    /**
     * `colorTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    colorTexture2DViewArray;

    /**
     * `composeColorTexture` 的视图
     *
     * @type {GPUTextureView[]}
     */
    composeColorTexture2DViewArray;

    /// 管线

    /**
     * @type {GPURenderPipeline}
     */
    traceMappingPipeline;

    /**
     * @type {GPURenderPipeline}
     */
    composePipeline;

    /**
     * @type {GPURenderPipeline}
     */
    displayPipeline;

    /// 绑定组布局

    /**
     * @type {GPUBindGroupLayout}
     */
    lightBindGroup0Layout;

    /**
     * @type {GPUBindGroupLayout}
     */
    shadowBindGroup0Layout;

    /**
     * @type {GPUBindGroupLayout}
     */
    cameraDepthBindGroup0Layout;

    /**
     * @type {GPUBindGroupLayout}
     */
    cameraBindGroup0Layout;

    /**
     * @type {GPUBindGroupLayout}
     */
    traceDepthBindGroup0Layout;

    /**
     * @type {GPUBindGroupLayout}
     */
    traceBindGroup0Layout;

    /// 绑定组

    /**
     * 某次阴影映射的某个面的绑定组
     *
     * @type {GPUBindGroup[][]}
     */
    shadowBindGroup0Array2;

    /**
     * @type {GPUBindGroup}
     */
    cameraDepthBindGroup0;

    /**
     * @type {GPUBindGroup[]}
     */
    cameraBindGroup0Array;

    /**
     * @type {GPUBindGroup[][]}
     */
    traceMappingBindGroup0Array2;

    /**
     * 某次追踪的某个深度的绑定组
     *
     * @type {GPUBindGroup[][]}
     */
    traceDepthBindGroup0Array2;

    /**
     * @type {GPUBindGroup[][]}
     */
    traceBindGroup0Array2;

    /**
     * 某次渲染的乒乓绑定组
     *
     * @type {GPUBindGroup[]}
     */
    composeBindGroup0Array;

    /**
     * 某次渲染的乒乓绑定组
     *
     * @type {GPUBindGroup[]}
     */
    displayBindGroup0Array;

    /// 渲染过程

    generateTraceDirection() {
        let size = this.config.traceWordSize;
        let center = this.traceCenter;
        for (let count = 0; count < this.config.traceCount; count++) {
            for (let depth = 0; depth < this.config.traceDepth; depth++) {
                let dir = vec3.create();
                let ver = vec3.create();
                randomDirection(dir, ver);
                this.state.setTraceDirection(count, depth, dir);
                let target = vec3.add(vec3.create(), center, dir);
                let view = mat4.lookAt(mat4.create(), center, target, ver);
                let project = mat4.orthoZO(mat4.create(), -size, size, -size, size, size, -size);
                let viewProjection = mat4.mul(mat4.create(), project, view);
                this.state.setTraceViewProjection(count, depth, viewProjection);
            }
        }
    }

    light() {
        let powerArray = this.models.map(i => i.getLightPower());
        let sum = 0;
        let sumArray = powerArray.map(v => sum += v);
        let sample = array(this.config.lightSampleCount, _ => Math.random() * sum).map(e => sumArray.findIndex(v => v > e));

        sample.forEach((modelIndex, sampleIndex) => {
            let commandEncoder = this.device.createCommandEncoder();
            let lightPass = commandEncoder.beginRenderPass({
                label: `light ${sampleIndex}`,
                colorAttachments: array(6, cubeIndex => ({
                    view: this.lightTexture2DViewArray[sampleIndex * 6 + cubeIndex],
                    loadOp: "clear",
                    storeOp: "store",
                })),
            });

            if (modelIndex !== -1) {
                let positionAndFactor = this.models[modelIndex].sampleLight(lightPass, sum / powerArray[modelIndex]);
                this.state.setLightPositionAndFactor(sampleIndex, positionAndFactor);
                for (let i = 0; i < 6; i++) {
                    let center = vec3.add(vec3.create(), positionAndFactor, cubeTarget[i]);
                    let view = mat4.lookAt(mat4.create(), positionAndFactor, center, cubeUp[i]);
                    let viewProjection = mat4.mul(mat4.create(), this.shadowProjection, view);
                    this.state.setShadowViewProjection(sampleIndex, i, viewProjection);
                }
            } else {
                this.state.setLightPositionAndFactor(sampleIndex, new Float32Array(4));
                for (let i = 0; i < 6; i++) {
                    this.state.setShadowViewProjection(sampleIndex, i, new Float32Array(16));
                }
            }
            lightPass.end();
            this.device.queue.submit([commandEncoder.finish()]);
        });
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder
     */
    shadow(commandEncoder) {
        for (let index = 0; index < this.config.lightSampleCount; index++) {
            for (let cube = 0; cube < 6; cube++) {
                let shadowPass = commandEncoder.beginRenderPass({
                    label: `shadow ${index} ${cube}`,
                    colorAttachments: [],
                    depthStencilAttachment: {
                        view: this.shadowTexture2DViewArray[index * 6 + cube],
                        depthClearValue: 1,
                        depthLoadOp: "clear",
                        depthStoreOp: "store",
                        depthReadOnly: false,
                    }
                });
                shadowPass.setBindGroup(0, this.shadowBindGroup0Array2[index][cube]);
                this.models.forEach(model => model.shadowPass(shadowPass));
                shadowPass.end();
            }
        }
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder
     */
    camera(commandEncoder) {
        let cameraDepthPass = commandEncoder.beginRenderPass({
            label: "cameraDepthPass",
            colorAttachments: [],
            depthStencilAttachment: {
                view: arrayCycleIndex(this.cameraDepthTexture2DViewArray, this.renderIndex),
                depthClearValue: 1,
                depthLoadOp: "clear",
                depthStoreOp: "store",
                depthReadOnly: false,
            },
        });
        cameraDepthPass.setBindGroup(0, this.cameraDepthBindGroup0);
        for (let model of this.models) {
            model.cameraDepthPass(cameraDepthPass);
        }
        cameraDepthPass.end();

        if (this.config.debug_clearCameraFactor) {
            this.cameraFactorTexture2DViewArray.forEach(v => {
                commandEncoder.beginRenderPass({
                    label: "clearCameraFactor",
                    colorAttachments: [{
                        view: v,
                        loadOp: "clear",
                        storeOp: "store",
                    }]
                }).end();
            });
        }

        let cameraPass = commandEncoder.beginRenderPass({
            label: "cameraPass",
            colorAttachments: [{
                view: this.colorTexture2DViewArray[0],
                loadOp: "clear",
                storeOp: "store",
            }, {
                view: this.cameraPositionTexture2DView,
                loadOp: "clear",
                storeOp: "store",
            }, {
                view: this.cameraColorTexture2DView,
                loadOp: "clear",
                storeOp: "store",
            }],
            depthStencilAttachment: {
                view: arrayCycleIndex(this.cameraDepthTexture2DViewArray, this.renderIndex),
                depthReadOnly: true,
            },
        });
        cameraPass.setBindGroup(0, arrayCycleIndex(this.cameraBindGroup0Array, this.renderIndex));
        for (let model of this.models) {
            model.cameraPass(cameraPass);
        }
        cameraPass.end();
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder
     */
    trace(commandEncoder) {
        for (let count = 0; count < this.config.traceCount; count++) {
            for (let depth = 0; depth < this.config.traceDepth; depth++) {
                commandEncoder.clearBuffer(this.traceMappingBuffer);
                commandEncoder.clearBuffer(this.traceDepthBuffer);
                commandEncoder.copyTextureToTexture({
                    texture: this.colorTexture,
                    origin: [0, 0, 0],
                }, {
                    texture: this.colorTexture,
                    origin: [0, 0, 1],
                }, [this.config.renderWidth, this.config.renderHeight, 1]);

                let traceMappingPass = commandEncoder.beginRenderPass({
                    label: `traceMappingPass ${count} ${depth}`,
                    colorAttachments: [{
                        view: this.traceLinkTexture2DView,
                        loadOp: "clear",
                        storeOp: "store",
                    }, {
                        view: this.traceMaxDepthTexture2DView,
                        loadOp: "clear",
                        storeOp: "store",
                    }],
                });
                traceMappingPass.setBindGroup(0, this.traceMappingBindGroup0Array2[count][depth]);
                traceMappingPass.setPipeline(this.traceMappingPipeline);
                traceMappingPass.draw(3);
                traceMappingPass.end();

                let traceDepthPass = commandEncoder.beginRenderPass({
                    label: `traceDepthPass ${count} ${depth}`,
                    colorAttachments: [],
                    depthStencilAttachment: {
                        view: this.traceMappingStencilTexture2DView,
                        depthReadOnly: true,
                        stencilReadOnly: true,
                    },
                });
                traceDepthPass.setBindGroup(0, this.traceDepthBindGroup0Array2[count][depth]);
                for (let model of this.models) {
                    model.traceDepthPass(traceDepthPass);
                }
                traceDepthPass.end();

                commandEncoder.beginRenderPass({
                    label: "clearTracePosition",
                    colorAttachments: [{
                        view: arrayCycleIndex(this.tracePositionTexture2DViewArray, depth + 1),
                        loadOp: "clear",
                        storeOp: "store",
                    }]
                }).end();

                let tracePass = commandEncoder.beginRenderPass({
                    label: `tracePass ${count} ${depth}`,
                    colorAttachments: [],
                    depthStencilAttachment: {
                        view: this.traceMappingStencilTexture2DView,
                        depthReadOnly: true,
                        stencilReadOnly: true,
                    },
                });
                tracePass.setBindGroup(0, this.traceBindGroup0Array2[count][depth]);
                for (let model of this.models) {
                    model.tracePass(tracePass);
                }
                tracePass.end();
            }
        }
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder
     */
    compose(commandEncoder) {
        let pass = commandEncoder.beginRenderPass({
            label: "compose",
            colorAttachments: [
                {
                    view: arrayCycleIndex(this.composeColorTexture2DViewArray, this.renderIndex),
                    loadOp: "clear",
                    storeOp: "store",
                },
            ],
        });
        pass.setBindGroup(0, arrayCycleIndex(this.composeBindGroup0Array, this.renderIndex));
        pass.setPipeline(this.composePipeline);
        pass.draw(3);
        pass.end();
    }

    /**
     * @param {GPUCommandEncoder} commandEncoder
     */
    display(commandEncoder) {
        if (this.context != null) {
            let pass = commandEncoder.beginRenderPass({
                label: "display",
                colorAttachments: [
                    {
                        view: this.context.getCurrentTexture().createView({
                            label: "context texture view",
                        }),
                        loadOp: "clear",
                        storeOp: "store",
                    }
                ],
            });
            pass.setBindGroup(0, arrayCycleIndex(this.displayBindGroup0Array, this.renderIndex));
            pass.setPipeline(this.displayPipeline);
            pass.draw(3);
            pass.end();
        }
    }

    /// 行为

    setCamera(eye, center, up, fovy, aspect, near, far) {
        vec3.copy(this.cameraPosition, eye);
        this.state.setCameraPosition(this.cameraPosition);
        let view = mat4.lookAt(mat4.create(), eye, center, up);
        let projection = mat4.perspectiveZO(mat4.create(), fovy, aspect, near, far);
        let viewProjection = mat4.mul(mat4.create(), projection, view);
        this.state.setCameraViewProjection(viewProjection);
    }

    onRenderListeners = [];
    onRenderFinishListeners = [];

    render() {
        for (let l of this.onRenderListeners) {
            l(this);
        }
        for (let model of this.models) {
            model.prepare();
        }
        this.state.setRenderIndex(this.renderIndex);
        this.generateTraceDirection();
        this.light();
        let commandEncoder = this.device.createCommandEncoder();
        this.shadow(commandEncoder);
        this.camera(commandEncoder);
        this.trace(commandEncoder);
        this.compose(commandEncoder);
        this.display(commandEncoder);
        let commandBuffer = commandEncoder.finish({
            label: `commandBuffer ${this.renderIndex}`,
        });
        this.device.queue.writeBuffer(this.stateBuffer, 0, this.state.buffer);
        this.device.queue.submit([commandBuffer]);
        mat4.copy(this.state.composeInfo.lastCameraMatrix.buffer, this.state.cameraInfo.viewProjection.buffer);
        mat4.copy(this.state.cameraInfo.lastViewProjection.buffer, this.state.cameraInfo.viewProjection.buffer);

        this.lastTime = performance.now();
        for (let l of this.onRenderFinishListeners) {
            l(this);
        }
        this.renderIndex++;
    }

    beginTime;
    lastTime;
    lastFpsTime;

    handle = 0;

    begin() {
        this.beginTime = this.lastFpsTime = performance.now();
        let loop = () => {
            this.handle = requestAnimationFrame(loop);
            this.render();
        }
        this.handle = requestAnimationFrame(loop);
    }

    end() {
        cancelAnimationFrame(this.handle);
    }

}
