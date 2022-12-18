import {StaticModel} from "./static_model.js";
import {getArea, getNormal} from "./kits.js";
import {LightModel} from "./light_model.js";

/**
 *
 * @param {string} code
 * @return {{vArray: number[][], vtArray: number[][], vnArray: number[][], fArray: number[][][]}}
 */
function loadObj(code) {

    let vArray = [];
    let vtArray = [];
    let vnArray = [];
    let fArray = [];

    let lines = code.split(new RegExp("\\r\\n|\\r|\\n"));
    for (let line of lines) {
        let tokens = line.split(" ").filter(token => token !== "");
        switch (tokens[0]) {
            case "v":
                vArray.push([Number.parseFloat(tokens[1]), Number.parseFloat(tokens[2]), Number.parseFloat(tokens[3])]);
                break;
            case "vt":
                vtArray.push([Number.parseFloat(tokens[1]), Number.parseFloat(tokens[2])]);
                break;
            case "vn":
                vnArray.push([Number.parseFloat(tokens[1]), Number.parseFloat(tokens[2]), Number.parseFloat(tokens[3])]);
                break;
            case "f": {
                let face = [];
                for (let v = 0; v < 3; v++) {
                    let p = tokens[v + 1].split("/");
                    face[v] = p.map(i => Number.parseInt(i));
                }
                fArray.push(face);
                break;
            }
            case "o":
            case "s":
            case "#":
            case "mtllib":
            case "usemtl":
            case null:
                break;
            default:
                console.warn("");
        }

    }

    return {
        vArray,
        vtArray,
        vnArray,
        fArray,
    }
}

/**
 *
 * @param {number[][]} vArray
 * @param {number[][][]} fArray
 */
function getObjPositionBuffer(vArray, fArray) {
    let buffer = new Float32Array(fArray.length * 9);
    for (let f = 0; f < fArray.length; f++) {
        for (let v = 0; v < 3; v++) {
            let position = vArray[fArray[f][v][0] - 1];
            for (let i = 0; i < 3; i++) {
                buffer[f * 9 + v * 3 + i] = position[i];
            }
        }
    }
    return buffer;
}

/**
 *
 * @param {number[][]} vnArray
 * @param {number[][][]} fArray
 */
function getObjNormalBuffer(vnArray, fArray) {
    let buffer = new Float32Array(fArray.length * 9);
    for (let f = 0; f < fArray.length; f++) {
        for (let v = 0; v < 3; v++) {
            let position = vnArray[fArray[f][3][1] - 1];
            for (let i = 0; i < 3; i++) {
                buffer[f * 9 + v * 3 + i] = position[i];
            }
        }
    }
    return buffer;
}



export function loadObjStaticModel(renderer, code) {
    let obj = loadObj(code);
    let positions = getObjPositionBuffer(obj.vArray, obj.fArray);
    let normals = getObjNormalBuffer(obj.vnArray, obj.fArray);
    let model = new StaticModel(renderer);
    model.setData(positions, normals);
    return model;
}

export function loadObjStaticModelWithoutNormal(renderer, code) {
    let obj = loadObj(code);
    let positions = getObjPositionBuffer(obj.vArray, obj.fArray);
    let model = new StaticModel(renderer);
    model.setData(positions, getNormal(positions));
    return model;
}

export function loadObjLightModelWithoutNormal(renderer, code) {
    let obj = loadObj(code);
    let positions = getObjPositionBuffer(obj.vArray, obj.fArray);
    let model = new LightModel(renderer);
    model.setData(positions, getNormal(positions), getArea(positions));
    return model;
}



