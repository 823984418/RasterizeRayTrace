import {CameraInfoStruct, ShadowInfoStruct, TraceInfoStruct} from "./renderer.js";

export let LIGHT_DEFINE = `// WGSL

struct FragmentOutput {
    @location(0)
    color: vec4<f32>,
}

`;

export let SHADOW_DEFINE = `// WGSL
${ShadowInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> shadowInfo: ShadowInfo;

`;

export let CAMERA_DEPTH_DEFINE = `// WGSL
${CameraInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> cameraInfo: CameraInfo;

`;

export let CAMERA_DEFINE = `// WGSL
${CameraInfoStruct.WGSL}


@group(0) @binding(0)
var<uniform> cameraInfo: CameraInfo;

@group(0) @binding(1)
var lightTexture: texture_cube_array<f32>;

@group(0) @binding(2)
var shadowTexture: texture_depth_cube_array;

@group(0) @binding(3)
var factorTextureOutput: texture_storage_2d_array<rgba16float, write>;

@group(0) @binding(4)
var depth: texture_depth_2d;

@group(0) @binding(5)
var lightSampler: sampler;

@group(0) @binding(6)
var shadowSampler: sampler;

@group(0) @binding(7)
var lastPositionTextureOutput: texture_storage_2d<rgba32float, write>;

fn lastPosition(pos: vec2<i32>, position: vec3<f32>, facing: bool) {
    if (debug_taa) {
        textureStore(lastPositionTextureOutput, pos, vec4<f32>(position, f32(facing) * 2 - 1));
    }
}

fn getShadow(light: i32, position: vec3<f32>) -> vec3<f32> {
    let lightPositionAndFactor = cameraInfo.lightArray[light];
    if (lightPositionAndFactor.w == 0) {
        return vec3<f32>(0);
    }
    let direction = position - lightPositionAndFactor.xyz;
    let div = dot(direction, direction);
    let shadowDepth: f32 = textureSampleLevel(shadowTexture, shadowSampler, -direction, light, 0);
    
    let absDirection = abs(direction);
    let z = max(max(absDirection.x, absDirection.y), absDirection.z);
    
    if (z < shadowNearDistance) {
        return vec3<f32>(0);
    }
    if (shadowDepth != 1) {
        let depth = shadowFarDistance / (shadowFarDistance - shadowNearDistance) - ((shadowFarDistance * shadowNearDistance) / (shadowFarDistance - shadowNearDistance)) / z;
        if (depth > shadowDepth + shadowDepthBias) {
            return vec3<f32>(0);
        }
    }
    return textureSampleLevel(lightTexture, lightSampler, -direction, light, 0).rgb / div * lightPositionAndFactor.w * light_factor;
}

fn depthTest(pos: vec2<i32>, currentDepth: f32) -> bool {
    let need = textureLoad(depth, pos, 0);
    return currentDepth == need;
}

fn setFactor(pos: vec2<i32>, index: i32, factor: vec3<f32>) {
    textureStore(factorTextureOutput, pos, index, vec4<f32>(factor, 0.0));
}

struct FragmentOutput {
    @location(0)
    color: vec4<f32>,
    
    @location(1)
    position: vec4<f32>,
    
    @location(2)
    appendColor: vec4<f32>,
    
}

`;
export let TRACE_DEPTH_DEFINE = `// WGSL
${TraceInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> traceInfo: TraceInfo;

@group(0) @binding(1)
var<storage, read> mappingBuffer: array<u32>;

@group(0) @binding(2)
var linkTexture: texture_2d<u32>;

@group(0) @binding(3)
var<storage, read_write> depthBuffer: array<atomic<u32>>;

@group(0) @binding(4)
var maxDepthTexture: texture_2d<f32>;

fn submitDepth(pos: vec2<i32>, depth: f32) {
    if (depth < 0 || depth > 1) {
        return;
    }
    let u32Depth: u32 = u32(depth * f32(0xFFFFFFFF));
    let mappingIndex = pos.x + pos.y * i32(traceMappingSize);
    var link = mappingBuffer[mappingIndex];
    while (link != 0) {
        let index = link - 1;
        let fr = vec2<i32>(i32(index % renderWidth), i32(index / renderWidth));
        let maxDepth: f32 = textureLoad(maxDepthTexture, fr, 0).x;
        if (depth < maxDepth - traceDepthBias) {
            atomicMax(&depthBuffer[index], u32Depth);
        }
        link = textureLoad(linkTexture, fr, 0).x;
    }
}

`;
export let TRACE_DEFINE = `// WGSL
${TraceInfoStruct.WGSL}

@group(0) @binding(0)
var<uniform> traceInfo: TraceInfo;

@group(0) @binding(1)
var<storage, read> mappingBuffer: array<u32>;

@group(0) @binding(2)
var linkTexture: texture_2d<u32>;

@group(0) @binding(3)
var<storage, read> depthBuffer: array<u32>;

@group(0) @binding(4)
var lightTexture: texture_cube_array<f32>;

@group(0) @binding(5)
var shadowTexture: texture_depth_cube_array;

@group(0) @binding(6)
var factorTexture: texture_2d<f32>;

@group(0) @binding(7)
var factorTextureOutput: texture_storage_2d<rgba16float, write>;

@group(0) @binding(8)
var positionTextureOutput: texture_storage_2d<rgba32float, write>;

@group(0) @binding(9)
var colorTexture: texture_2d<f32>;

@group(0) @binding(10)
var colorTextureOutput: texture_storage_2d<rgba16float, write>;

@group(0) @binding(11)
var lightSampler: sampler;

@group(0) @binding(12)
var shadowSampler: sampler;

fn getShadow(light: i32, position: vec3<f32>) -> vec3<f32> {
    let lightPositionAndFactor = traceInfo.lightArray[light];
    if (lightPositionAndFactor.w == 0) {
        return vec3<f32>(0);
    }
    let direction = position - lightPositionAndFactor.xyz;
    let div = dot(direction, direction);
    let shadowDepth: f32 = textureSampleLevel(shadowTexture, shadowSampler, -direction, light, 0);
    
    let absDirection = abs(direction);
    let z = max(max(absDirection.x, absDirection.y), absDirection.z);
    
    if (z < shadowNearDistance) {
        return vec3<f32>(0);
    }
    if (shadowDepth != 1) {
        let depth = shadowFarDistance / (shadowFarDistance - shadowNearDistance) - ((shadowFarDistance * shadowNearDistance) / (shadowFarDistance - shadowNearDistance)) / z;
        if (depth > shadowDepth + shadowDepthBias) {
            return vec3<f32>(0);
        }
    }
    return textureSampleLevel(lightTexture, lightSampler, -direction, light, 0).rgb / div * lightPositionAndFactor.w * light_factor;
}

fn getHead(pos: vec2<i32>, depth: f32) -> u32 {
    if (depth < 0 || depth > 1) {
        return 0;
    }
    let mappingIndex = pos.x + pos.y * i32(traceMappingSize);
    return mappingBuffer[mappingIndex];
}

fn submit(head: u32, depth: f32, world: vec4<f32>, color: vec4<f32>, factor: vec4<f32>) {
    if (depth < 0 || depth > 1) {
        return;
    }
    let u32Depth = u32(depth * f32(0xFFFFFFFF));
    var link: u32 = head;
    while (link != 0) {
        let index: u32 = link - 1;
        let fr = vec2<i32>(i32(index % renderWidth), i32(index / renderWidth));
        if (depthBuffer[index] == u32Depth) {
            let lastFactor: vec4<f32> = textureLoad(factorTexture, fr, 0);
            let lastColor: vec4<f32> = textureLoad(colorTexture, fr, 0);
            
            textureStore(positionTextureOutput, fr, world);
            textureStore(factorTextureOutput, fr, vec4<f32>(lastFactor.rgb * factor.rgb, 0.0));
            textureStore(colorTextureOutput, fr, vec4<f32>(lastFactor.rgb * color.rgb + lastColor.rgb, 1));
        }
        link = textureLoad(linkTexture, fr, 0).x;
    }
}

`;
