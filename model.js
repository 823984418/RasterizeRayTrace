export class Model {

    constructor(renderer) {
        this.renderer = renderer;
    }

    /**
     * @type {Renderer}
     */
    renderer;

    prepare() {

    }

    /**
     * 获取模型对光照的贡献
     * 这个值决定模型被调用 `sampleLight` 的概率
     *
     * @return {number} 光照贡献
     */
    getLightPower() {
        return 0;
    }

    /**
     * 采样模型内的一个光源
     *
     * @param {GPUDevice} device
     * @param {GPUTextureView[]} textures 六个立方体纹理面
     * @param {number} factor 光照系数
     * @return {number[]} 光源坐标
     */
    sampleLight(device, textures, factor) {
        return [0, 0, 0, 0];
    }

    /**
     * 绘制相机深度通道
     * 给出深度信息
     *
     * @param {GPURenderPassEncoder} pass 渲染通道
     */
    cameraDepthPass(pass) {
    }

    /**
     * 绘制相机通道
     * 给出:
     * 1. 基础颜色
     * 2. 各个指定方向的 `brdf` 值
     * 3. 位置
     *
     * @param {GPURenderPassEncoder} pass 渲染通道
     */
    cameraPass(pass) {
    }

    /**
     * 绘制阴影深度通道
     *
     * @param {GPURenderPassEncoder} pass
     */
    shadowPass(pass) {
    }

    /**
     * 绘制追踪深度通道
     *
     * @param {GPURenderPassEncoder} pass 渲染通道
     */
    traceDepthPass(pass) {

    }

    /**
     * 绘制追踪通道
     * 更新追踪信息
     *
     * @param {GPURenderPassEncoder} pass
     */
    tracePass(pass) {
    }

}
