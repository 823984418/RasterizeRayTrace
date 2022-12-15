export class GlobalDataIndex {
    static ENCODING = 0;
    static VERTEX_EXT_VEC4_COUNT = 1;
    static VERTEX_INDEX_SIZE = 2;
    static TEXTURE_INDEX_SIZE = 3;
    static MATERIAL_INDEX_SIZE = 4;
    static BONE_INDEX_SIZE = 5;
    static MORPH_INDEX_SIZE = 6;
    static RIGID_BODY_INDEX_SIZE = 7;

}

export class MaterialFlags {
    static NO_CULL = 0x01;
    static GROUND_SHADOW = 0x02;
    static DRAW_SHADOW = 0x04;
    static RECEIVE_SHADOW = 0x08;
    static HAS_EDGE = 0x10;
    static VERTEX_COLOR = 0x20;
    static POINT_DRAWING = 0x40;
    static LINE_DRAWING = 0x80;
}

export class BoneFlags {
    static CONNECT = 0x0001;
    static ROTATABLE = 0x0002;
    static MOVABLE = 0x0004;
    static VISIBLE = 0x0008;
    static ENABLE = 0x0010;
    static IK = 0x0020;

    static INHERIT_ROTATE = 0x0100;
    static INHERIT_MOVE = 0x0200;
    static FIXED_AXIS = 0x0400;
    static LOCAL_AXIS = 0x0800;
    static DELAY_PHYSICS = 0x1000;
    static OUTSIDE = 0x2000;

}

export class ShapeTypes {
    static SPHERE = 0;
    static BOX = 1;
    static CAPSULE = 2;
}

export class PmxReader {

    /**
     * @type {DataView}
     */
    #dataView;
    /**
     * @type {number}
     */
    #offset;

    /**
     * @return {number}
     */
    #int8() {
        let value = this.#dataView.getInt8(this.#offset);
        this.#offset += 1;
        return value;
    }

    /**
     * @return {number}
     */
    #int16() {
        let value = this.#dataView.getInt16(this.#offset, true);
        this.#offset += 2;
        return value;
    }

    /**
     * @return {number}
     */
    #int32() {
        let value = this.#dataView.getInt32(this.#offset, true);
        this.#offset += 4;
        return value;
    }

    /**
     * @return {number}
     */
    #uint8() {
        let value = this.#dataView.getUint8(this.#offset);
        this.#offset += 1;
        return value;
    }

    /**
     * @return {number}
     */
    #uint16() {
        let value = this.#dataView.getUint16(this.#offset, true);
        this.#offset += 2;
        return value;
    }

    /**
     * @return {number}
     */
    #uint32() {
        let value = this.#dataView.getUint32(this.#offset, true);
        this.#offset += 4;
        return value;
    }

    /**
     * @return {number}
     */
    #float32() {
        let value = this.#dataView.getFloat32(this.#offset, true);
        this.#offset += 4;
        return value;
    }

    /**
     * @type {TextDecoder}
     */
    #decoder;

    /**
     * @return {string}
     */
    #text() {
        let length = this.#uint32();
        let string = this.#decoder.decode(new Uint8Array(this.#dataView.buffer, this.#offset, length));
        this.#offset += length;
        return string;
    };

    #indexUintN = {1: this.#uint8, 2: this.#uint16, 4: this.#uint32};
    #indexIntN = {1: this.#int8, 2: this.#int16, 4: this.#int32};
    /**
     * @type {function(): number}
     */
    #vertexIndex;
    /**
     * @type {function(): number}
     */
    #textureIndex;
    /**
     * @type {function(): number}
     */
    #materialIndex;
    /**
     * @type {function(): number}
     */
    #boneIndex;
    /**
     * @type {function(): number}
     */
    #morphIndex;
    /**
     * @type {function(): number}
     */
    #rigidBodyIndex;

    /**
     * @param {ArrayBuffer} arrayBuffer
     */
    constructor(arrayBuffer) {
        this.#dataView = new DataView(arrayBuffer);
    }

    /**
     * @param {PmxVisitor} visitor
     */
    accept(visitor) {
        this.#offset = 0;
        let magic = this.#uint32();
        if (magic !== 0x20584D50) {
            throw new Error();
        }
        let version = this.#float32();
        let globalDataLength = this.#uint8();
        let globalData = new Array(globalDataLength);
        for (let i = 0; i < globalDataLength; i++) {
            globalData[i] = this.#uint8();
        }

        let encoding = globalData[GlobalDataIndex.ENCODING];
        let vertexExtVec4Count = globalData[GlobalDataIndex.VERTEX_EXT_VEC4_COUNT];
        let vertexIndexSize = globalData[GlobalDataIndex.VERTEX_INDEX_SIZE];
        let textureIndexSize = globalData[GlobalDataIndex.TEXTURE_INDEX_SIZE];
        let materialIndexSize = globalData[GlobalDataIndex.MATERIAL_INDEX_SIZE];
        let boneIndexSize = globalData[GlobalDataIndex.BONE_INDEX_SIZE];
        let morphIndexSize = globalData[GlobalDataIndex.MORPH_INDEX_SIZE];
        let rigidBodyIndexSize = globalData[GlobalDataIndex.RIGID_BODY_INDEX_SIZE];

        this.#decoder = new TextDecoder(["UTF-16LE", "UTF-8"][encoding]);
        this.#vertexIndex = this.#indexUintN[vertexIndexSize];
        this.#textureIndex = this.#indexIntN[textureIndexSize];
        this.#materialIndex = this.#indexIntN[materialIndexSize];
        this.#boneIndex = this.#indexIntN[boneIndexSize];
        this.#morphIndex = this.#indexIntN[morphIndexSize];
        this.#rigidBodyIndex = this.#indexIntN[rigidBodyIndexSize];

        visitor.visitHeader(version, globalData, this.#text(), this.#text(), this.#text(), this.#text());

        let vertexCount = this.#uint32();
        visitor.visitVertexCount(vertexCount);
        let vertexDataSize = 3 + 3 + 2 + vertexExtVec4Count * 4;
        for (let i = 0; i < vertexCount; i++) {
            let data = new Array(vertexDataSize);
            for (let i = 0; i < vertexDataSize; i++) {
                data[i] = this.#float32();
            }

            let skinType = this.#uint8();
            let skinInfo = {type: skinType};
            switch (skinType) {
                case 0:
                    skinInfo.bones = [this.#boneIndex()];
                    skinInfo.weights = [];
                    break;
                case 1:
                    skinInfo.bones = [this.#boneIndex(), this.#boneIndex()];
                    skinInfo.weights = [this.#float32()];
                    break;
                case 2:
                    skinInfo.bones = [this.#boneIndex(), this.#boneIndex(), this.#boneIndex(), this.#boneIndex()];
                    skinInfo.weights = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                    break;
                case 3:
                    skinInfo.bones = [this.#boneIndex(), this.#boneIndex()];
                    skinInfo.weights = [this.#float32()];
                    skinInfo.c = [this.#float32(), this.#float32(), this.#float32()];
                    skinInfo.r0 = [this.#float32(), this.#float32(), this.#float32()];
                    skinInfo.r1 = [this.#float32(), this.#float32(), this.#float32()];
                    break;
                default:
                    throw new Error(`Unknown skin type ${skinType}`);
            }

            let edge = this.#float32();
            visitor.visitVertex(i, data, skinInfo, edge);
        }

        let elementCount = this.#uint32();
        visitor.visitElementCount(elementCount);
        for (let i = 0; i < elementCount; i++) {
            visitor.visitElement(i, this.#vertexIndex());
        }

        let textureCount = this.#uint32();
        visitor.visitTextureCount(textureCount);
        for (let i = 0; i < textureCount; i++) {
            visitor.visitTexture(i, this.#text());
        }

        let materialCount = this.#uint32();
        visitor.visitMaterialCount(materialCount);
        for (let i = 0; i < materialCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let diffuse = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
            let specular = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
            let ambient = [this.#float32(), this.#float32(), this.#float32()];
            let flags = this.#uint8();
            let edge = [this.#float32(), this.#float32(), this.#float32(), this.#float32(), this.#float32()];
            let texture = this.#textureIndex();
            let envTexture = this.#textureIndex();
            let mix = this.#uint8();
            let toonSource = this.#uint8();
            let toonTexture = [this.#textureIndex, this.#uint8][toonSource].call(this);
            let comment = this.#text();
            let elementCount = this.#uint32();
            visitor.visitMaterial(i, localName, name, diffuse, specular, ambient, flags, edge, texture, envTexture, mix, toonSource, toonTexture, comment, elementCount);
        }

        let boneCount = this.#uint32();
        visitor.visitBoneCount(boneCount);
        for (let i = 0; i < boneCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let position = [this.#float32(), this.#float32(), this.#float32()];
            let parentBone = this.#boneIndex();
            let priority = this.#int32();
            let flags = this.#uint16();
            let connect;
            if ((flags & BoneFlags.CONNECT) !== 0) {
                connect = this.#boneIndex();
            } else {
                connect = [this.#float32(), this.#float32(), this.#float32()];
            }
            let inherit = null;
            if ((flags & (BoneFlags.INHERIT_ROTATE | BoneFlags.INHERIT_MOVE)) !== 0) {
                inherit = {
                    bone: this.#boneIndex(),
                    weight: this.#float32(),
                };
            }
            let fixAxis = null;
            if ((flags & BoneFlags.FIXED_AXIS) !== 0) {
                fixAxis = [this.#float32(), this.#float32(), this.#float32()];
            }
            let localAxis = null;
            if ((flags & BoneFlags.LOCAL_AXIS) !== 0) {
                localAxis = {
                    localXAxis: [this.#float32(), this.#float32(), this.#float32()],
                    localZAxis: [this.#float32(), this.#float32(), this.#float32()],
                };
            }
            let key = null;
            if ((flags & BoneFlags.OUTSIDE) !== 0) {
                key = this.#boneIndex();
            }
            let ik = null;
            if ((flags & BoneFlags.IK) !== 0) {
                let effector = this.#boneIndex();
                let iteration = this.#uint32();
                let maxAngle = this.#float32();
                let linkCount = this.#uint32();
                let iks = new Array(linkCount);
                for (let j = 0; j < linkCount; j++) {
                    let bone = this.#boneIndex();
                    let angleLimitation = this.#uint8();
                    let minAngle = null;
                    let maxAngle = null;
                    if (angleLimitation !== 0) {
                        minAngle = [this.#float32(), this.#float32(), this.#float32()];
                        maxAngle = [this.#float32(), this.#float32(), this.#float32()];
                    }
                    iks[i] = {
                        bone: bone,
                        angleLimitation: angleLimitation,
                        minAngle: minAngle,
                        maxAngle: maxAngle,
                    };
                }
                ik = {
                    effector: effector,
                    iteration: iteration,
                    maxAngle: maxAngle,
                    iks: iks,
                }
            }
            visitor.visitBone(i, localName, name, position, parentBone, priority, flags, connect, inherit, fixAxis, localAxis, key, ik);
        }

        let morphsCount = this.#uint32();
        visitor.visitMorphsCount(morphsCount);
        for (let i = 0; i < morphsCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let panel = this.#uint8();
            let type = this.#uint8();
            let count = this.#uint32();
            /**
             * @type {{index?: number, factor?: number, position?: number[], rotation?: number[], uv?: number[], type?: number, diffuse?: number[], specular?: number[], ambient?: number[], edge?: number[], texture?: number[], envTexture?: number[], toonTexture?: number[]}[]}
             */
            let array = new Array(count);
            for (let i = 0; i < count; i++) {
                /**
                 * @type {{index?: number, factor?: number, position?: number[], rotation?: number[], uv?: number[], type?: number, diffuse?: number[], specular?: number[], ambient?: number[], edge?: number[], texture?: number[], envTexture?: number[], toonTexture?: number[]}}
                 */
                let item = array[i] = {};
                switch (type) {
                    case 0:
                        item.index = this.#morphIndex();
                        item.factor = this.#float32();
                        break;
                    case 1:
                        item.index = this.#vertexIndex();
                        item.position = [this.#float32(), this.#float32(), this.#float32()];
                        break;
                    case 2:
                        item.index = this.#boneIndex();
                        item.position = [this.#float32(), this.#float32(), this.#float32()];
                        item.rotation = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        break;
                    case 3:
                    case 4:
                    case 5:
                    case 6:
                    case 7:
                        item.index = this.#vertexIndex();
                        item.uv = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        break;
                    case 8:
                        item.index = this.#materialIndex();
                        item.type = this.#uint8();
                        item.diffuse = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        item.specular = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        item.ambient = [this.#float32(), this.#float32(), this.#float32()];
                        item.edge = [this.#float32(), this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        item.texture = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        item.envTexture = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        item.toonTexture = [this.#float32(), this.#float32(), this.#float32(), this.#float32()];
                        break;
                    default:
                        throw new Error();
                }
            }
            visitor.visitMorphs(i, localName, name, panel, type, array);
        }

        let displayFrameCount = this.#uint32();
        visitor.visitDisplayFrameCount(displayFrameCount);
        for (let i = 0; i < displayFrameCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let special = this.#uint8();
            let count = this.#uint32();
            let array = new Array(count);
            for (let i = 0; i < count; i++) {
                let type = this.#uint8();
                let index = [this.#boneIndex, this.#morphIndex][type].call(this);
                array[i] = {
                    type: type,
                    index: index,
                };
            }
            visitor.visitDisplayFrame(i, localName, name, special, array);
        }

        let rigidBodyCount = this.#uint32();
        visitor.visitRigidBodyCount(rigidBodyCount);
        for (let i = 0; i < rigidBodyCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let bone = this.#boneIndex();
            let groupIndex = this.#uint8();
            let groupTarget = this.#uint16();
            let shapeType = this.#uint8();
            let size = [this.#float32(), this.#float32(), this.#float32()];
            let position = [this.#float32(), this.#float32(), this.#float32()];
            let rotation = [this.#float32(), this.#float32(), this.#float32()];
            let weight = this.#float32();
            let positionDamping = this.#float32();
            let rotationDamping = this.#float32();
            let restitution = this.#float32();
            let friction = this.#float32();
            let type = this.#uint8();
            visitor.visitRigidBody(i, localName, name, bone, groupIndex, groupTarget, shapeType, size, position, rotation, weight, positionDamping, rotationDamping, restitution, friction, type);
        }

        let jointCount = this.#uint32();
        visitor.visitJointCount(jointCount);
        for (let i = 0; i < jointCount; i++) {
            let localName = this.#text();
            let name = this.#text();
            let type = this.#uint8();
            let rigidBody1 = this.#rigidBodyIndex();
            let rigidBody2 = this.#rigidBodyIndex();
            let position = [this.#float32(), this.#float32(), this.#float32()];
            let rotation = [this.#float32(), this.#float32(), this.#float32()];
            let minTranslation = [this.#float32(), this.#float32(), this.#float32()];
            let maxTranslation = [this.#float32(), this.#float32(), this.#float32()];
            let minRotation = [this.#float32(), this.#float32(), this.#float32()];
            let maxRotation = [this.#float32(), this.#float32(), this.#float32()];
            let springPosition = [this.#float32(), this.#float32(), this.#float32()];
            let springRotation = [this.#float32(), this.#float32(), this.#float32()];
            visitor.visitJoint(i, localName, name, type, rigidBody1, rigidBody2, position, rotation, minTranslation, maxTranslation, minRotation, maxRotation, springPosition, springRotation);
        }

    }

}

export class PmxVisitor {

    /**
     * @param {number} version
     * @param {number[]} globalData
     * @param {string} localName
     * @param {string} name
     * @param {string} localComment
     * @param {string} comment
     */
    visitHeader(version, globalData, localName, name, localComment, comment) {
    }

    /**
     * @param {number} count
     */
    visitVertexCount(count) {
    }

    /**
     * @param {number} index
     * @param {number[]} data
     * @param {{type: number, bones?: number[], weights?: number[], c?: number[], r0?: number[], r1?: number[]}} skinInfo
     * @param {number} edge
     */
    visitVertex(index, data, skinInfo, edge) {
    }

    /**
     * @param {number} count
     */
    visitElementCount(count) {
    }

    /**
     * @param {number} index
     * @param {number} vertexIndex
     */
    visitElement(index, vertexIndex) {
    }

    /**
     * @param {number} count
     */
    visitTextureCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} path
     */
    visitTexture(index, path) {
    }

    /**
     * @param {number} count
     */
    visitMaterialCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number[]} diffuse
     * @param {number[]} specular
     * @param {number[]} ambient
     * @param {number} flags
     * @param {number[]} edge
     * @param {number} texture
     * @param {number} envTexture
     * @param {number} mix
     * @param {number} toonSource
     * @param {number} toonTexture
     * @param {string} comment
     * @param {number} elementCount
     */
    visitMaterial(index, localName, name,
                  diffuse, specular, ambient,
                  flags, edge, texture, envTexture, mix,
                  toonSource, toonTexture, comment, elementCount) {

    }

    /**
     * @param {number} count
     */
    visitBoneCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number[]} position
     * @param {number} parentBone
     * @param {number} priority
     * @param {number} flags
     * @param {number} connect
     * @param {{bone: number, weight: number} | null} inherit
     * @param {number[] | null} fixAxis
     * @param {{localXAxis: number[], localZAxis: number[]} | null} localAxis
     * @param {number | null} key
     * @param {{effector: number, iteration: number, maxAngle: number, iks: {bone: number, angleLimitation: number, minAngle: number, maxAngle: number}[]} | null} ik
     */
    visitBone(index, localName, name, position, parentBone, priority, flags, connect, inherit, fixAxis, localAxis, key, ik) {

    }

    /**
     * @param {number} count
     */
    visitMorphsCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number} panel
     * @param {number} type
     * @param {{index?: number, factor?: number, position?: number[], rotation?: number[], uv?: number[], type?: number, diffuse?: number[], specular?: number[], ambient?: number[], edge?: number[], texture?: number[], envTexture?: number[], toonTexture?: number[]}[]} array
     */
    visitMorphs(index, localName, name, panel, type, array) {
    }

    /**
     * @param {number} count
     */
    visitDisplayFrameCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number} type
     * @param {{type: number, index: number}[]} array
     */
    visitDisplayFrame(index, localName, name, type, array) {
    }

    /**
     * @param {number} rigidBodyCount
     */
    visitRigidBodyCount(rigidBodyCount) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number} bone
     * @param {number} groupIndex
     * @param {number} groupTarget
     * @param {number} shapeType
     * @param {number[]} size
     * @param {number[]} position
     * @param {number[]} rotation
     * @param {number} weight
     * @param {number} positionDamping
     * @param {number} rotationDamping
     * @param {number} restitution
     * @param {number} friction
     * @param {number} type
     */
    visitRigidBody(index, localName, name, bone, groupIndex, groupTarget, shapeType, size, position, rotation, weight, positionDamping, rotationDamping, restitution, friction, type) {

    }

    /**
     * @param {number} count
     */
    visitJointCount(count) {
    }

    /**
     * @param {number} index
     * @param {string} localName
     * @param {string} name
     * @param {number} type
     * @param {number} rigidBody1
     * @param {number} rigidBody2
     * @param {number[]} position
     * @param {number[]} rotation
     * @param {number[]} minTranslation
     * @param {number[]} maxTranslation
     * @param {number[]} minRotation
     * @param {number[]} maxRotation
     * @param {number[]} springPosition
     * @param {number[]} springRotation
     */
    visitJoint(index, localName, name, type, rigidBody1, rigidBody2, position, rotation, minTranslation, maxTranslation, minRotation, maxRotation, springPosition, springRotation) {
    }

}