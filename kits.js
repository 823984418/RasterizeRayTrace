import {vec3} from "./gl-matrix/index.js";

export function array(length, init) {
    let a = new Array(length);
    for (let i = 0; i < length; i++) {
        a[i] = init(i);
    }
    return a;
}

export function arrayCycleIndex(array, index, from, size) {
    from ??= 0;
    size ??= array.length - from;
    return array[from + (index % size)];
}

export function getNormal(position) {
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

export function getArea(position) {
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
 * @param {GPUDevice} device
 * @param {number[]} value
 */
export function createRGBA8UNormConstantTextureView(device, value) {
    let texture = device.createTexture({
        label: "color texture",
        size: [1, 1, 1],
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        format: "rgba8unorm",
        dimension: "2d",
    });
    device.queue.writeTexture({texture: texture}, new Uint8Array(value), {}, [1, 1, 1]);
    return texture.createView();
}

export function mat4FromMat3(m3) {
    return [
        m3[0], m3[1], m3[2], 0,
        m3[3], m3[4], m3[5], 0,
        m3[6], m3[7], m3[8], 0,
        0, 0, 0, 1,
    ];
}
/**
 * @param {GPUDevice} device
 * @param {GPUBuffer} buffer
 * @return {ArrayBuffer}
 */
export async function readBuffer(device, buffer) {
    let copy = device.createBuffer({
        size: buffer.size,
        usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST,
    });
    let encoder = device.createCommandEncoder();
    encoder.copyBufferToBuffer(buffer, 0, copy, 0, buffer.size);
    device.queue.submit([encoder.finish()]);
    await device.queue.onSubmittedWorkDone();
    await copy.mapAsync(GPUMapMode.READ);
    return copy.getMappedRange();
}
