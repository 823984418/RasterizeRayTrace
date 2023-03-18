import {MaterialFlags, PmxReader, PmxVisitor} from "./PmxVisitor.js";
import {TextureModel} from "./texture_model.js";
import {createRGBA8UNormConstantTextureView} from "./kits.js";

class PmxTextureModelVisitor extends PmxVisitor {
    /**
     * @type {Float32Array}
     */
    positionData;
    /**
     * @type {Float32Array}
     */
    normalData;
    /**
     * @type {Float32Array}
     */
    uvData;

    visitVertexCount(count) {
        this.positionData = new Float32Array(count * 3);
        this.normalData = new Float32Array(count * 3);
        this.uvData = new Float32Array(count * 2);
    }

    visitVertex(index, data, skinInfo, edge) {
        this.positionData[index * 3] = data[0];
        this.positionData[index * 3 + 1] = data[1];
        this.positionData[index * 3 + 2] = data[2];
        this.normalData[index * 3] = data[3];
        this.normalData[index * 3 + 1] = data[4];
        this.normalData[index * 3 + 2] = data[5];
        this.uvData[index * 2] = data[6];
        this.uvData[index * 2 + 1] = data[7];
    }

    /**
     * @type {Uint32Array}
     */
    indexDate;

    visitElementCount(count) {
        this.indexDate = new Uint32Array(count);
    }

    visitElement(index, vertexIndex) {
        this.indexDate[index] = vertexIndex;
    }

    /**
     * @type {{path: string, texture: GPUTexture}[]}
     */
    textures;

    visitTextureCount(count) {
        this.textures = new Array(count);
    }

    visitTexture(index, path) {
        this.textures[index] = {
            path,
        };
    }

    /**
     * @type {{localName:string, diffuse: number[], texture: number, elementCount: number, cullMode: GPUCullMode}[]}
     */
    materials;

    visitMaterialCount(count) {
        this.materials = new Array(count);
    }

    visitMaterial(index, localName, name, diffuse, specular, ambient, flags, edge, texture, envTexture, mix, toonSource, toonTexture, comment, elementCount) {
        this.materials[index] = {
            localName,
            diffuse,
            texture,
            elementCount,
            cullMode: (flags & MaterialFlags.NO_CULL) ? "none" : "back",
        };
    }

}

/**
 *
 * @param {Renderer} renderer
 * @param {URL} url
 * @return {Promise<TextureModel[]>}
 */
export async function loadPmxTextureModel(renderer, url) {
    let device = renderer.device;
    let urlBase = new URL("", url);
    let pmx = await (await fetch(url)).arrayBuffer();
    let visitor = new PmxTextureModelVisitor();
    new PmxReader(pmx).accept(visitor);

    for (let texObj of visitor.textures) {
        let file = await (await fetch(new URL(texObj.path.split(/[\\/]/).map(i=>encodeURI(i)).join("/"), urlBase))).blob();
        let bitmap = (await createImageBitmap(file, {}));
        let texture = device.createTexture({
            label: "loadPmxTextureModel texture",
            size: [bitmap.width, bitmap.height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
        device.queue.copyExternalImageToTexture({source: bitmap}, {texture}, [bitmap.width, bitmap.height, 1]);
        texObj.texture = texture;
    }

    let positionBuffer = device.createBuffer({
        size: visitor.positionData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    let normalBuffer = device.createBuffer({
        size: visitor.normalData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    let uvBuffer = device.createBuffer({
        size: visitor.uvData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    let indexBuffer = device.createBuffer({
        size: visitor.indexDate.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(positionBuffer, 0, visitor.positionData);
    device.queue.writeBuffer(normalBuffer, 0, visitor.normalData);
    device.queue.writeBuffer(uvBuffer, 0, visitor.uvData);
    device.queue.writeBuffer(indexBuffer, 0, visitor.indexDate);

    let models = [];
    let sum = 0;
    let zeroTexture = createRGBA8UNormConstantTextureView(device, [0, 0, 0, 255]);
    for (let material of visitor.materials) {
        let model = new TextureModel(renderer);
        model.positionBuffer = positionBuffer;
        model.normalBuffer = normalBuffer;
        model.uvBuffer = uvBuffer;
        model.indexBuffer = indexBuffer;
        model.firstIndex = sum;
        model.indexCount = material.elementCount;

        let diffuseTexture = visitor.textures[material.texture].texture.createView({
            label: "loadPmxTextureModel texture view",
        });
        // console.log(material.localName);
        model.setTexture(diffuseTexture, zeroTexture);
        models.push(model);
        sum += material.elementCount;
        renderer.models.push(model);
    }
    return models;
}