import {BufferMat4x4F32, BufferStruct, BufferVec4F32} from "./buffer_struct.js";
import {
    CAMERA_DEFINE,
    CAMERA_DEPTH_DEFINE,
    SHADOW_DEFINE,
    TRACE_DEFINE,
    TRACE_DEPTH_DEFINE
} from "./renderer_interface.js";
import {mat4, vec4} from "./gl-matrix/index.js";
import {Model} from "./model.js";
import {createRGBA8UNormConstantTextureView} from "./kits.js";


class TextureModelInfo extends BufferStruct {
    static WGSL = "struct TextureModelInfo {model: mat4x4<f32>, lastModel: mat4x4<f32>, normalModel: mat4x4<f32>, diffuse: vec4<f32>, emit: vec4<f32>}";

    constructor() {
        super();
        this.setStruct([
            this.model,
            this.lastModel,
            this.normalModel,
            this.diffuse,
            this.emit,
        ], 256);
    }

    buffer;
    model = new BufferMat4x4F32();
    lastModel = new BufferMat4x4F32();
    normalModel = new BufferMat4x4F32();
    diffuse = new BufferVec4F32();
    emit = new BufferVec4F32();
}

let TEXTURE_MODEL_VERTEX_DEFINE = `// WGSL
struct VertexInput {
    @builtin(vertex_index)
    vertex_index: u32,
    
    @location(0)
    position: vec3<f32>,
    
    @location(1)
    normal: vec3<f32>,
    
    @location(2)
    uv: vec2<f32>,
}

@group(1) @binding(1)
var diffuseTexture: texture_2d<f32>;

@group(1) @binding(2)
var emitTexture: texture_2d<f32>;

@group(1) @binding(3)
var modelSampler: sampler;

`;

let TEXTURE_MODEL_SHADOW_CODE = `// WGSL
${SHADOW_DEFINE}
${TextureModelInfo.WGSL}
${TEXTURE_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: TextureModelInfo;

@vertex
fn vertex_main(input: VertexInput) -> @builtin(position) vec4<f32> {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let pos: vec4<f32> = shadowInfo.viewProjection * vec4<f32>(worldPosition, 1);
    return pos;
}

@fragment
fn fragment_main() {
}
`;

let STATIC_MODEL_CAMERA_DEPTH_CODE = `// WGSL
${CAMERA_DEPTH_DEFINE}
${TextureModelInfo.WGSL}
${TEXTURE_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: TextureModelInfo;

@vertex
fn vertex_main(input: VertexInput) -> @builtin(position) vec4<f32> {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let pos: vec4<f32> = cameraInfo.viewProjection * vec4<f32>(worldPosition, 1);
    return pos;
}

@fragment
fn fragment_main() {
}
`;

let STATIC_MODEL_CAMERA_CODE = `// WGSL
${CAMERA_DEFINE}
${TextureModelInfo.WGSL}
${TEXTURE_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: TextureModelInfo;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
    
    @location(2)
    @interpolate(linear)
    lastPosition: vec3<f32>,
    
    @location(3)
    uv: vec2<f32>,
    
}

struct FragmentInput {
    @builtin(position)
    position: vec4<f32>,
    
    @builtin(front_facing)
    facing: bool,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
    
    @location(2)
    @interpolate(linear)
    lastPosition: vec3<f32>,
    
    @location(3)
    uv: vec2<f32>,
    
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let worldNormal: vec3<f32> = (modelInfo.normalModel * vec4<f32>(input.normal, 0)).xyz;
    let pos: vec4<f32> = cameraInfo.viewProjection * vec4<f32>(worldPosition, 1);
    let lastWorldPosition: vec3<f32> = (modelInfo.lastModel * vec4<f32>(input.position, 1)).xyz;
    let lastPos: vec4<f32> = cameraInfo.lastViewProjection * vec4<f32>(lastWorldPosition, 1);
    return VertexOutput(pos, worldPosition, normalize(worldNormal), lastPos.xyz / lastPos.w, input.uv);
}

@fragment
fn fragment_main(input: FragmentInput) -> FragmentOutput {
    let normal: vec3<f32> = normalize(input.worldNormal);
    let camera: vec3<f32> = cameraInfo.cameraPosition.xyz;
    let position: vec3<f32> = input.worldPosition.xyz;
    let c = dot(normalize(camera - position), normal);
    
    let pos = vec2<i32>(input.position.xy);
    let diffuse: vec3<f32> = modelInfo.diffuse.rgb * textureSampleLevel(diffuseTexture, modelSampler, input.uv, 0).rgb;
    let emit: vec3<f32> = modelInfo.emit.rgb * textureSampleLevel(emitTexture, modelSampler, input.uv, 0).rgb;
    var appendColor: vec3<f32> = emit;
    var color = vec3<f32>(0);
    if (depthTest(pos, input.position.z)) {
    
        for (var i: i32 = 0; i < i32(traceCount); i++) {
            let targetI: vec4<f32> = cameraInfo.directionToArray[i];
            var factor = vec3<f32>(0);
            if (targetI.w == 0) {
                let tc = dot(targetI.xyz, normal);
                if ((tc > 0) == (c > 0)) {
                    factor = diffuse * abs(tc) * 4 / f32(traceCount);
                }
            }
            setFactor(pos, i, factor);
        }
        for (var i = 0; i < i32(lightSampleCount); i++) {
            let lightPositionAndFactor = cameraInfo.lightArray[i];
            if (lightPositionAndFactor.w != 0) {
                let lc = dot(normalize(lightPositionAndFactor.xyz - position), normal);
                if ((lc > 0) == (c > 0)) {
                    let light = getShadow(i, position);
                    color += light * diffuse * abs(lc) / PI / f32(lightSampleCount);
                }
            }
        }
    }
    return FragmentOutput(vec4(color, 1.0), vec4<f32>(input.worldPosition, 1), vec4<f32>(input.lastPosition, f32(input.facing) * 2 - 1), vec4(appendColor, 1));
}
`;

let STATIC_MODEL_TRACE_DEPTH_CODE = `// WGSL
${TRACE_DEPTH_DEFINE}
${TextureModelInfo.WGSL}
${TEXTURE_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: TextureModelInfo;

@vertex
fn vertex_main(input: VertexInput) -> @builtin(position) vec4<f32> {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let pos: vec4<f32> = traceInfo.viewProjection * vec4<f32>(worldPosition, 1);
    return pos;
}

@fragment
fn fragment_main(@builtin(position) position: vec4<f32>) {
    let pos = vec2<i32>(position.xy);
    submitDepth(pos, position.z);
}
`;

let STATIC_MODEL_TRACE_CODE = `// WGSL
${TRACE_DEFINE}
${TextureModelInfo.WGSL}
${TEXTURE_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: TextureModelInfo;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
    
    @location(2)
    uv: vec2<f32>,
}

struct FragmentInput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
    
    @location(2)
    uv: vec2<f32>,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let worldNormal: vec3<f32> = normalize((modelInfo.normalModel * vec4<f32>(input.normal, 0)).xyz);
    let pos: vec4<f32> = traceInfo.viewProjection * vec4<f32>(worldPosition, 1);
    return VertexOutput(pos, worldPosition, worldNormal, input.uv);
}

@fragment
fn fragment_main(input: FragmentInput) {
    let pos = vec2<i32>(input.position.xy);
    let head = getHead(pos, input.position.z);
    if (head != 0) {
        let diffuse: vec3<f32> = modelInfo.diffuse.rgb * textureSampleLevel(diffuseTexture, modelSampler, input.uv, 0).rgb;
        let emit: vec3<f32> = modelInfo.emit.rgb * textureSampleLevel(emitTexture, modelSampler, input.uv, 0).rgb;
        
        let normal: vec3<f32> = normalize(input.worldNormal);
        let c = dot(traceInfo.directionFrom.xyz, normal);
        let ct = dot(traceInfo.directionTo.xyz, normal);
        var factor: vec3<f32> = diffuse * 4 * ct;
        var currentPosition = vec4(input.worldPosition, 1);
        if ((c > 0) == (ct > 0)) {
            factor = vec3(0);
            currentPosition.w = 0;
        }
        var color: vec3<f32> = emit;
        for (var i = 0; i < i32(lightSampleCount); i++) {
            let lightPositionAndFactor = traceInfo.lightArray[i];
            if (lightPositionAndFactor.w != 0) {
                let lc = dot(normalize(input.worldPosition.xyz - lightPositionAndFactor.xyz), normal);
                if ((lc > 0) == (c > 0)) {
                    let light = getShadow(i, input.worldPosition.xyz);
                    color += light * diffuse * abs(lc) / PI / f32(lightSampleCount);
                }
            }
        }
        submit(head, input.position.z, currentPosition, vec4(color, 1), vec4<f32>(factor, 1));
    }
}
`;


export class TextureModel extends Model {

    /**
     * @param {Renderer} renderer
     * @param {GPUCullMode} cullMode
     */
    constructor(renderer, cullMode = "none") {
        super(renderer);
        this.modelInfo = new TextureModelInfo();
        this.modelInfo.buffer = new ArrayBuffer(this.modelInfo.use_size());
        this.modelInfo.allocate(this.modelInfo.buffer, 0);

        let device = renderer.device;
        this.sampler = device.createSampler({
            label: "texture model sampler",
            minFilter: "linear",
            magFilter: "linear",
        });

        let shadowShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${TEXTURE_MODEL_SHADOW_CODE}
`,
        });
        let cameraDepthShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${STATIC_MODEL_CAMERA_DEPTH_CODE}
`,
        });
        let cameraShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${STATIC_MODEL_CAMERA_CODE}
`,
        });
        let traceDepthShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${STATIC_MODEL_TRACE_DEPTH_CODE}
`,
        });
        let traceShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${STATIC_MODEL_TRACE_CODE}
`,
        });

        this.modelInfoBuffer = device.createBuffer({
            label: "modelInfoBuffer",
            size: this.modelInfo.use_size(),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        this.bindGroup1Layout = device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"},
            }, {
                binding: 1,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {viewDimension: "2d", sampleType: "float"},
            }, {
                binding: 2,
                visibility: GPUShaderStage.FRAGMENT,
                texture: {viewDimension: "2d", sampleType: "float"},
            }, {
                binding: 3,
                visibility: GPUShaderStage.FRAGMENT,
                sampler: {type: "filtering"},
            }],
        });

        let vertexBuffers = [{
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
            attributes: [
                {shaderLocation: 0, format: "float32x3", offset: 0},
            ],
        }, {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 3,
            attributes: [
                {shaderLocation: 1, format: "float32x3", offset: 0},
            ],
        }, {
            arrayStride: Float32Array.BYTES_PER_ELEMENT * 2,
            attributes: [
                {shaderLocation: 2, format: "float32x2", offset: 0},
            ],
        }];

        this.shadowPipeline = device.createRenderPipeline({
            label: "shadowPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.shadowBindGroup0Layout,
                    this.bindGroup1Layout,
                ],
            }),
            vertex: {
                module: shadowShaderModule,
                entryPoint: "vertex_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: shadowShaderModule,
                entryPoint: "fragment_main",
                targets: [],
            },
            depthStencil: {
                format: "depth32float",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
            primitive: {
                cullMode: cullMode,
            },
        });
        this.cameraDepthPipeline = device.createRenderPipeline({
            label: "cameraDepthPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.cameraDepthBindGroup0Layout,
                    this.bindGroup1Layout,
                ],
            }),
            vertex: {
                module: cameraDepthShaderModule,
                entryPoint: "vertex_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: cameraDepthShaderModule,
                entryPoint: "fragment_main",
                targets: [],
            },
            depthStencil: {
                format: "depth32float",
                depthWriteEnabled: true,
                depthCompare: "less",
            },
            primitive: {
                cullMode: cullMode,
            },
        });
        this.cameraPipeline = device.createRenderPipeline({
            label: "cameraPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.cameraBindGroup0Layout,
                    this.bindGroup1Layout,
                ],
            }),
            vertex: {
                module: cameraShaderModule,
                entryPoint: "vertex_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: cameraShaderModule,
                entryPoint: "fragment_main",
                targets: [
                    {format: "rgba32float"},
                    {format: "rgba32float"},
                    {format: "rgba32float"},
                    {format: "rgba16float"},
                ],
            },
            depthStencil: {
                format: "depth32float",
                depthWriteEnabled: false,
                depthCompare: "equal",
            },
            primitive: {
                cullMode: cullMode,
            },
        });
        this.traceDepthPipeline = device.createRenderPipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.traceDepthBindGroup0Layout,
                    this.bindGroup1Layout,
                ],
            }),
            vertex: {
                module: traceDepthShaderModule,
                entryPoint: "vertex_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: traceDepthShaderModule,
                entryPoint: "fragment_main",
                targets: [],
            },
            depthStencil: {
                format: "stencil8",
                depthWriteEnabled: false,
                depthCompare: "always",
            },
            primitive: {
                cullMode: cullMode,
            },
        });
        this.tracePipeline = device.createRenderPipeline({
            label: "tracePipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.traceBindGroup0Layout,
                    this.bindGroup1Layout,
                ],
            }),
            vertex: {
                module: traceShaderModule,
                entryPoint: "vertex_main",
                buffers: vertexBuffers,
            },
            fragment: {
                module: traceShaderModule,
                entryPoint: "fragment_main",
                targets: [],
            },
            depthStencil: {
                format: "stencil8",
                depthWriteEnabled: false,
                depthCompare: "always",
            },
            primitive: {
                cullMode: cullMode,
            },
        });

        this.setTexture(createRGBA8UNormConstantTextureView(device, [1, 1, 1, 1]), createRGBA8UNormConstantTextureView(device, [1, 1, 1, 1]));
        this.setData(new Float32Array([]), new Float32Array([]), new Float32Array([]), new Uint32Array([]));
        mat4.copy(this.modelInfo.model.buffer, mat4.create());
        mat4.copy(this.modelInfo.normalModel.buffer, mat4.create());
        vec4.copy(this.modelInfo.emit.buffer, [1, 1, 1, 1]);
        vec4.copy(this.modelInfo.diffuse.buffer, [1, 1, 1, 1]);
    }

    /**
     * @type {GPUBindGroupLayout}
     */
    bindGroup1Layout;


    shadowPipeline;
    cameraDepthPipeline;
    cameraPipeline;
    traceDepthPipeline;
    tracePipeline;

    /**
     * @type {GPUSampler}
     */
    sampler;

    /**
     * @type {TextureModelInfo}
     */
    modelInfo;

    /**
     * @type {GPUBuffer}
     */
    modelInfoBuffer;

    /**
     * @type {GPUBindGroup}
     */
    bindGroup1;

    /**
     * @type {GPUBuffer}
     */
    positionBuffer;

    /**
     * @type {GPUBuffer}
     */
    normalBuffer;

    /**
     * @type {GPUBuffer}
     */
    uvBuffer;

    indexBuffer;

    /**
     * @type {number}
     */
    indexCount;

    firstIndex = 0;
    baseVertex = 0;

    /**
     * @param {Float32Array} position
     * @param {Float32Array} normal
     * @param {Float32Array} uv
     * @param {Uint32Array} index
     */
    setData(position, normal, uv, index) {
        let count = (position.length / 3) | 0;
        if (position.length !== count * 3 || normal.length !== count * 3 || uv.length !== count * 2) {
            throw new Error("");
        }
        this.positionBuffer = this.renderer.device.createBuffer({
            label: "positionBuffer",
            size: position.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        });
        this.normalBuffer = this.renderer.device.createBuffer({
            label: "normalBuffer",
            size: normal.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        });
        this.uvBuffer = this.renderer.device.createBuffer({
            label: "uvBuffer",
            size: uv.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX,
        });
        this.indexBuffer = this.renderer.device.createBuffer({
            label: "indexBuffer",
            size: index.byteLength,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.INDEX,
        });
        this.indexCount = index.length;
        this.renderer.device.queue.writeBuffer(this.positionBuffer, 0, position);
        this.renderer.device.queue.writeBuffer(this.normalBuffer, 0, normal);
        this.renderer.device.queue.writeBuffer(this.uvBuffer, 0, uv);
        this.renderer.device.queue.writeBuffer(this.indexBuffer, 0, index);
    }


    /**
     *
     * @param {GPUTextureView} diffuseTextureView
     * @param {GPUTextureView} emitTextureView
     */
    setTexture(diffuseTextureView, emitTextureView) {
        this.bindGroup1 = this.renderer.device.createBindGroup({
            label: "bindGroup1",
            layout: this.bindGroup1Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.modelInfoBuffer,
                },
            }, {
                binding: 1,
                resource: diffuseTextureView,
            }, {
                binding: 2,
                resource: emitTextureView,
            }, {
                binding: 3,
                resource: this.sampler,
            }],
        });
    }

    prepare() {
        this.renderer.device.queue.writeBuffer(this.modelInfoBuffer, 0, this.modelInfo.buffer);
        mat4.copy(this.modelInfo.lastModel.buffer, this.modelInfo.model.buffer);
    }

    shadowPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.shadowPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.setVertexBuffer(2, this.uvBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint32");
        pass.drawIndexed(this.indexCount, 1, this.firstIndex, this.baseVertex);
    }

    cameraDepthPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.cameraDepthPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.setVertexBuffer(2, this.uvBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint32");
        pass.drawIndexed(this.indexCount, 1, this.firstIndex, this.baseVertex);
    }

    cameraPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.cameraPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.setVertexBuffer(2, this.uvBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint32");
        pass.drawIndexed(this.indexCount, 1, this.firstIndex, this.baseVertex);
    }

    traceDepthPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.traceDepthPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.setVertexBuffer(2, this.uvBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint32");
        pass.drawIndexed(this.indexCount, 1, this.firstIndex, this.baseVertex);
    }

    tracePass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.tracePipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.setVertexBuffer(2, this.uvBuffer);
        pass.setIndexBuffer(this.indexBuffer, "uint32");
        pass.drawIndexed(this.indexCount, 1, this.firstIndex, this.baseVertex);
    }


}