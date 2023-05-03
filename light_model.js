import {Model} from "./model.js";
import {BufferMat4x4F32, BufferStruct, BufferUint32, BufferVec4F32} from "./buffer_struct.js";
import {
    CAMERA_DEFINE,
    CAMERA_DEPTH_DEFINE,
    LIGHT_DEFINE,
    SHADOW_DEFINE,
    TRACE_DEFINE,
    TRACE_DEPTH_DEFINE
} from "./renderer_interface.js";
import {mat3, mat4, vec3, vec4} from "./gl-matrix/index.js";

class LightInfo extends BufferStruct {
    static WGSL = "struct LightInfo {normalAndFactor: vec4<f32>, lightIndex: u32}";

    constructor() {
        super();
        this.setStruct([
            this.normalAndFactor,
            this.lightIndex,
        ], 256);
    }

    buffer;

    normalAndFactor = new BufferVec4F32();

    lightIndex = new BufferUint32();
}

class LightModelInfo extends BufferStruct {
    static WGSL = "struct LightModelInfo {model: mat4x4<f32>, lastModel: mat4x4<f32>, normalModel: mat4x4<f32>, diffuse: vec4<f32>, emit: vec4<f32>, light: vec4<f32>}";

    constructor() {
        super();
        this.setStruct([
            this.model,
            this.lastModel,
            this.normalModel,
            this.diffuse,
            this.emit,
            this.light,
        ], 256);
    }

    buffer;
    model = new BufferMat4x4F32();
    lastModel = new BufferMat4x4F32();
    normalModel = new BufferMat4x4F32();
    diffuse = new BufferVec4F32();
    emit = new BufferVec4F32();
    light = new BufferVec4F32();
}

let LIGHT_MODEL_VERTEX_DEFINE = `// WGSL
struct VertexInput {
    @builtin(vertex_index)
    vertex_index: u32,
    
    @location(0)
    position: vec3<f32>,
    
    @location(1)
    normal: vec3<f32>,
}
`;

let LIGHT_MODEL_LIGHT_CODE = `// WGSL
${LIGHT_DEFINE}
${LightInfo.WGSL}
${LightModelInfo.WGSL}

@group(0) @binding(0)
var<uniform> lightInfo: LightInfo;

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    pos: vec2<f32>,
}

struct FragmentInput {
    @location(0)
    pos: vec2<f32>,
}

@vertex
fn vertex_main(@builtin(vertex_index) vertex_index : u32) -> VertexOutput {
    let pos = vec2<f32>(vec2<u32>((vertex_index % 3) & 1, (vertex_index % 3) >> 1));
    return VertexOutput(vec4(pos * 4 - 1, 0.0, 1.0), pos * 4 - 1);
}

@fragment
fn fragment_main(input: FragmentInput) -> FragmentOutput {
    let pos = input.pos;
    let zz = array<vec3<f32>, 6>(
        vec3<f32>(-1, 0, 0),
        vec3<f32>(1, 0, 0),
        vec3<f32>(0, -1, 0),
        vec3<f32>(0, 1, 0),
        vec3<f32>(0, 0, -1),
        vec3<f32>(0, 0, 1),
    );
    let yy = array<vec3<f32>, 6>(
        vec3<f32>(0, -1, 0),
        vec3<f32>(0, -1, 0),
        vec3<f32>(0, 0, 1),
        vec3<f32>(0, 0, -1),
        vec3<f32>(0, -1, 0),
        vec3<f32>(0, -1, 0),
    );
    let i = lightInfo.lightIndex;
    let ss = zz[i] + pos.x * cross(zz[i], yy[i]) + pos.y * yy[i];
    let ns = normalize(ss);
    let output = modelInfo.light.rgb * abs(dot(lightInfo.normalAndFactor.xyz, ns)) / light_factor;
    return FragmentOutput(vec4<f32>(output, 1.0));
}

`;

let LIGHT_MODEL_SHADOW_CODE = `// WGSL
${SHADOW_DEFINE}
${LightModelInfo.WGSL}
${LIGHT_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

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

let LIGHT_MODEL_CAMERA_DEPTH_CODE = `// WGSL
${CAMERA_DEPTH_DEFINE}
${LightModelInfo.WGSL}
${LIGHT_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

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

let LIGHT_MODEL_CAMERA_CODE = `// WGSL
${CAMERA_DEFINE}
${LightModelInfo.WGSL}
${LIGHT_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

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
    
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let worldNormal: vec3<f32> = (modelInfo.normalModel * vec4<f32>(input.normal, 0)).xyz;
    let pos: vec4<f32> = cameraInfo.viewProjection * vec4<f32>(worldPosition, 1);
    let lastWorldPosition: vec3<f32> = (modelInfo.lastModel * vec4<f32>(input.position, 1)).xyz;
    let lastPos: vec4<f32> = cameraInfo.lastViewProjection * vec4<f32>(lastWorldPosition, 1);
    return VertexOutput(pos, worldPosition, normalize(worldNormal), lastPos.xyz / lastPos.w);
}

@fragment
fn fragment_main(input: FragmentInput) -> FragmentOutput {
    let normal: vec3<f32> = normalize(input.worldNormal);
    let camera: vec3<f32> = cameraInfo.cameraPosition.xyz;
    let position: vec3<f32> = input.worldPosition.xyz;
    let c = dot(normalize(camera - position), normal);
    
    let pos = vec2<i32>(input.position.xy);
    var appendColor: vec3<f32> = modelInfo.emit.rgb + modelInfo.light.rgb;
    var color = vec3<f32>(0);
    if (depthTest(pos, input.position.z)) {
        for (var i: i32 = 0; i < i32(traceCount); i++) {
            let targetI: vec4<f32> = cameraInfo.directionToArray[i];
            var factor = vec3<f32>(0);
            if (targetI.w == 0) {
                let tc = dot(targetI.xyz, normal);
                if ((tc > 0) == (c > 0)) {
                    factor = modelInfo.diffuse.rgb * abs(tc) * 4 / f32(traceCount);
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
                    color += light * modelInfo.diffuse.rgb * abs(lc) / PI / f32(lightSampleCount);
                }
            }
        }
        lastPosition(pos, input.lastPosition, input.facing);
    }
    return FragmentOutput(vec4(color, 1.0), vec4<f32>(input.worldPosition, 1), vec4(appendColor, 1));
}
`;

let LIGHT_MODEL_TRACE_DEPTH_CODE = `// WGSL
${TRACE_DEPTH_DEFINE}
${LightModelInfo.WGSL}
${LIGHT_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

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

let LIGHT_MODEL_TRACE_CODE = `// WGSL
${TRACE_DEFINE}
${LightModelInfo.WGSL}
${LIGHT_MODEL_VERTEX_DEFINE}

@group(1) @binding(0)
var<uniform> modelInfo: LightModelInfo;

struct VertexOutput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
}

struct FragmentInput {
    @builtin(position)
    position: vec4<f32>,
    
    @location(0)
    worldPosition: vec3<f32>,
    
    @location(1)
    worldNormal: vec3<f32>,
}

@vertex
fn vertex_main(input: VertexInput) -> VertexOutput {
    let worldPosition: vec3<f32> = (modelInfo.model * vec4<f32>(input.position, 1)).xyz;
    let worldNormal: vec3<f32> = normalize((modelInfo.normalModel * vec4<f32>(input.normal, 0)).xyz);
    let pos: vec4<f32> = traceInfo.viewProjection * vec4<f32>(worldPosition, 1);
    return VertexOutput(pos, worldPosition, worldNormal);
}

@fragment
fn fragment_main(input: FragmentInput) {
    let pos = vec2<i32>(input.position.xy);
    let head = getHead(pos, input.position.z);
    if (head != 0) {
        let normal: vec3<f32> = normalize(input.worldNormal);
        let c = dot(traceInfo.directionFrom.xyz, normal);
        let ct = dot(traceInfo.directionTo.xyz, normal);
        var factor: vec3<f32> = modelInfo.diffuse.rgb * 4 * ct;
        var currentPosition = vec4(input.worldPosition, 1);
        if ((c > 0) == (ct > 0)) {
            factor = vec3(0);
            currentPosition.w = 0;
        }
        var color = modelInfo.emit.rgb;
        for (var i = 0; i < i32(lightSampleCount); i++) {
            let lightPositionAndFactor = traceInfo.lightArray[i];
            if (lightPositionAndFactor.w != 0) {
                let lc = dot(normalize(input.worldPosition.xyz - lightPositionAndFactor.xyz), normal);
                if ((lc > 0) == (c > 0)) {
                    let light = getShadow(i, input.worldPosition.xyz);
                    color += light * modelInfo.diffuse.rgb * abs(lc) / PI / f32(lightSampleCount);
                }
            }
        }
        submit(head, input.position.z, currentPosition, vec4(color, 1), vec4<f32>(factor, 1));
    }
}
`;

export class LightModel extends Model {
    /**
     * @param {Renderer} renderer
     * @param {GPUCullMode} cullMode
     */
    constructor(renderer, cullMode = "none") {
        super(renderer);
        this.modelInfo = new LightModelInfo();
        this.modelInfo.buffer = new ArrayBuffer(this.modelInfo.use_size());
        this.modelInfo.allocate(this.modelInfo.buffer, 0);

        this.lightInfo = new LightInfo();
        this.lightInfo.buffer = new ArrayBuffer(this.lightInfo.use_size());
        this.lightInfo.allocate(this.lightInfo.buffer, 0);

        let device = renderer.device;
        let lightShaderModule = device.createShaderModule({
            label: "lightShaderModule",
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_LIGHT_CODE}
`,
        });
        let shadowShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_SHADOW_CODE}
`,
        });
        let cameraDepthShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_CAMERA_DEPTH_CODE}
`,
        });
        let cameraShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_CAMERA_CODE}
`,
        });
        let traceDepthShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_TRACE_DEPTH_CODE}
`,
        });
        let traceShaderModule = device.createShaderModule({
            code: `
${renderer.configWGSL}
${LIGHT_MODEL_TRACE_CODE}
`,
        });

        this.modelInfoBuffer = device.createBuffer({
            label: "modelInfoBuffer",
            size: this.modelInfo.use_size(),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        this.lightInfoBuffer = device.createBuffer({
            label: "lightInfoBuffer",
            size: this.lightInfo.use_size(),
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        });
        let lightBindGroup0Layout = device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"},
            }],
        });
        let bindGroup1Layout = device.createBindGroupLayout({
            entries: [{
                binding: 0,
                visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                buffer: {type: "uniform"},
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
        }];

        this.lightPipeline = device.createRenderPipeline({
            label: "lightPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    lightBindGroup0Layout,
                    bindGroup1Layout,
                ],
            }),
            vertex: {
                module: lightShaderModule,
                entryPoint: "vertex_main",
            },
            fragment: {
                module: lightShaderModule,
                entryPoint: "fragment_main",
                targets: [
                    {format: "rgba8unorm"},
                ],
            },
        });
        this.shadowPipeline = device.createRenderPipeline({
            label: "shadowPipeline",
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    renderer.shadowBindGroup0Layout,
                    bindGroup1Layout,
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
                    bindGroup1Layout,
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
                    bindGroup1Layout,
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
                    {format: "rgba16float"},
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
                    bindGroup1Layout,
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
                    bindGroup1Layout,
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

        this.lightBindGroup0 = device.createBindGroup({
            label: "lightBindGroup0",
            layout: lightBindGroup0Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.lightInfoBuffer,
                },
            }],
        });
        this.bindGroup1 = device.createBindGroup({
            label: "bindGroup1",
            layout: bindGroup1Layout,
            entries: [{
                binding: 0,
                resource: {
                    buffer: this.modelInfoBuffer,
                },
            }],
        });
        this.setData(new Float32Array([]), new Float32Array([]), new Float32Array([]));
        mat4.copy(this.modelInfo.model.buffer, mat4.create());
        mat4.copy(this.modelInfo.normalModel.buffer, mat4.create());
        vec4.copy(this.modelInfo.emit.buffer, [1, 1, 1, 1]);
    }

    lightPipeline;
    shadowPipeline;
    cameraDepthPipeline;
    cameraPipeline;
    traceDepthPipeline;
    tracePipeline;

    /**
     * @type {LightModelInfo}
     */
    modelInfo;

    /**
     * @type {GPUBuffer}
     */
    modelInfoBuffer;

    /**
     * @type {LightInfo}
     */
    lightInfo;

    /**
     * @type {GPUBuffer}
     */
    lightInfoBuffer;

    /**
     * @type {GPUBindGroup}
     */
    lightBindGroup0;

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
     * @type {number}
     */
    vertexCount;

    position;

    normal;

    area;

    areaSum;

    lightPower = 0;

    /**
     * @param {Float32Array} position
     * @param {Float32Array} normal
     * @param {Float32Array} area
     */
    setData(position, normal, area) {
        let count = (position.length / 3) | 0;
        if (position.length !== count * 3 || normal.length !== count * 3 || area.length * 3 !== count) {
            throw new Error("");
        }
        this.position = position = new Float32Array(position);
        this.normal = normal = new Float32Array(normal);
        this.area = new Float32Array(area);
        this.areaSum = area.reduce((a, b) => a + b, 0);
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
        this.vertexCount = count;
        this.renderer.device.queue.writeBuffer(this.positionBuffer, 0, position);
        this.renderer.device.queue.writeBuffer(this.normalBuffer, 0, normal);
    }

    prepare() {
        this.renderer.device.queue.writeBuffer(this.modelInfoBuffer, 0, this.modelInfo.buffer);
        mat4.copy(this.modelInfo.lastModel.buffer, this.modelInfo.model.buffer);
    }

    getLightPower() {
        return this.lightPower;
    }

    sampleLight(device, textures, factor) {
        if (this.vertexCount === 0) {
            return [0, 0, 0, 0];
        }
        let r = Math.random() * this.areaSum;
        let index = 0;
        for (let i = 0; i < this.area.length; i++) {
            r -= this.area[i];
            if (r <= 0) {
                index = i;
                break;
            }
        }

        let r1 = Math.random();
        let r2 = Math.random();
        let sqrtR1 = Math.sqrt(r1);
        let w = 1 - sqrtR1;
        let u = sqrtR1 * (1 - r2);
        let v = sqrtR1 * r2;
        let pos = this.position;
        let position = [
            pos[index * 9] * w + pos[index * 9 + 3] * u + pos[index * 9 + 6] * v,
            pos[index * 9 + 1] * w + pos[index * 9 + 4] * u + pos[index * 9 + 7] * v,
            pos[index * 9 + 2] * w + pos[index * 9 + 5] * u + pos[index * 9 + 8] * v,
        ];
        let no = this.normal;
        let normal = [
            no[index * 9] * w + no[index * 9 + 3] * u + no[index * 9 + 6] * v,
            no[index * 9 + 1] * w + no[index * 9 + 4] * u + no[index * 9 + 7] * v,
            no[index * 9 + 2] * w + no[index * 9 + 5] * u + no[index * 9 + 8] * v,
        ];
        let normalVec4 = [...normal, 0];
        vec4.transformMat4(normalVec4, normalVec4, this.modelInfo.normalModel.buffer);
        vec3.normalize(normal, normalVec4);
        let fa = factor * this.areaSum;
        vec4.copy(this.lightInfo.normalAndFactor.buffer, [normal[0], normal[1], normal[2], fa]);
        for (let i = 0;i < 6;i++) {
            this.lightInfo.lightIndex.buffer[0] = i;
            this.renderer.device.queue.writeBuffer(this.lightInfoBuffer, 0, this.lightInfo.buffer);
            let commandEncoder = device.createCommandEncoder();
            let lightPass = commandEncoder.beginRenderPass({
                label: `light ${i}`,
                colorAttachments: [textures[i]],
            });
            lightPass.setBindGroup(0, this.lightBindGroup0);
            lightPass.setBindGroup(1, this.bindGroup1);
            lightPass.setPipeline(this.lightPipeline);
            lightPass.draw(3);
            lightPass.end();
            device.queue.submit([commandEncoder.finish()]);
        }
        vec4.transformMat4(position, [...position, 1], this.modelInfo.model.buffer);
        position[3] = fa;
        return position;
    }


    shadowPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.shadowPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.draw(this.vertexCount);
    }

    cameraDepthPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.cameraDepthPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.draw(this.vertexCount);
    }

    cameraPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.cameraPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.draw(this.vertexCount);
    }

    traceDepthPass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.traceDepthPipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.draw(this.vertexCount);
    }

    tracePass(pass) {
        pass.setBindGroup(1, this.bindGroup1);
        pass.setPipeline(this.tracePipeline);
        pass.setVertexBuffer(0, this.positionBuffer);
        pass.setVertexBuffer(1, this.normalBuffer);
        pass.draw(this.vertexCount);
    }

}

