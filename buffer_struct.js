import {array, arrayCycleIndex} from "./kits.js";

export class BufferValue {

    alignment = 1;
    size = 0;

    allocate(arrayBuffer, offset) {
    }

}

export class BufferUint32 extends BufferValue {

    alignment = 4;
    size = 4;

    buffer;

    allocate(arrayBuffer, offset) {
        this.buffer = new Uint32Array(arrayBuffer, offset, 1);
    }

}

export class BufferFloat32 extends BufferValue {

    alignment = 4;
    size = 4;

    buffer;

    allocate(arrayBuffer, offset) {
        this.buffer = new Float32Array(arrayBuffer, offset, 1);
    }

}

export class BufferVec4F32 extends BufferValue {
    alignment = 16;
    size = 16;

    buffer;

    allocate(arrayBuffer, offset) {
        this.buffer = new Float32Array(arrayBuffer, offset, 4);
    }

}

export class BufferMat4x4F32 extends BufferValue {
    alignment = 16;
    size = 64;

    buffer;

    allocate(arrayBuffer, offset) {
        this.buffer = new Float32Array(arrayBuffer, offset, 16);
    }

}

export class BufferStruct extends BufferValue {

    /**
     * @param {BufferValue[]} members
     * @param {number} structAlignment
     */
    setStruct(members, structAlignment = 1) {
        this.#members = members;
        this.alignment = Math.max(structAlignment, ...members.map(member => member.alignment));
        let offset = 0;
        for (let member of members) {
            let alignment = member.alignment | 0;
            let size = member.size | 0;
            offset = ((((offset + alignment - 1) / alignment) | 0) * alignment) | 0;
            offset += size;
        }
        this.size = offset;
        return this;
    }


    /**
     * @type {BufferValue[]}
     */
    #members = [];

    /**
     * @type {number}
     */
    offset = undefined;

    allocate(arrayBuffer, offset) {
        let alignment = this.alignment | 0;
        offset = (((offset / alignment) | 0) * alignment) | 0;
        this.offset = offset;
        for (let member of this.#members) {
            let alignment = member.alignment | 0;
            let size = member.size | 0;
            offset = ((((offset + alignment - 1) / alignment) | 0) * alignment) | 0;
            member.allocate(arrayBuffer, offset);
            offset += size;
        }
    }

    use_size() {
        return (((this.size + 15) / 16) | 0) * 16;
    }
}

export class BufferArray extends BufferStruct {
    constructor(type, length, arrayAlignment = 1) {
        super();
        this.array = array(length, _ => new type());
        this.setStruct(this.array, arrayAlignment);
    }

    array;

    /**
     * @type {number}
     */
    offset = undefined;


}