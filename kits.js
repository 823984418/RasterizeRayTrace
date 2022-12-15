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
