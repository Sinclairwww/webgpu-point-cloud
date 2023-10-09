// import basicVert from './shaders/basic.vert.wgsl?raw'
// import positionFrag from './shaders/position.frag.wgsl?raw'

// import * as rabbit from './util/rabbit'
import { getMvpMatrix } from './util/math'
const NUM = 50

// initialize webgpu device & config canvas context
async function initWebGPU(canvas: HTMLCanvasElement) {
    if (!navigator.gpu)
        throw new Error('Not Support WebGPU')
    const adapter = await navigator.gpu.requestAdapter()
    if (!adapter)
        throw new Error('No Adapter Found')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu') as GPUCanvasContext
    const format = navigator.gpu.getPreferredCanvasFormat()

    context.configure({
        device, format,
        // prevent chrome warning after v102
        alphaMode: 'opaque'
    })

    const devicePixelRatio = window.devicePixelRatio || 1
    canvas.width = canvas.clientWidth * devicePixelRatio
    canvas.height = canvas.clientHeight * devicePixelRatio
    const size = { width: canvas.width, height: canvas.height }
    return { device, context, format, size }
}

// create pipiline & buffers
async function initPipeline(
    device: GPUDevice,
    format: GPUTextureFormat,
    size: { width: number, height: number },
    vertex: Float32Array
) {
    const pipeline = await device.createRenderPipelineAsync({
        label: 'Basic Pipline',
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({
                code:
                    /* wgsl */ `
                @binding(0) @group(0) var<storage,read> mvpMatrix : array<mat4x4<f32>>;

                struct VertexOutput {
                    @builtin(position) Position : vec4<f32>,
                    @location(0) fragPosition: vec4<f32>
                };

                @vertex
                fn main(
                    @builtin(instance_index) index :u32,
                    @location(0) position : vec4<f32>,
                ) -> VertexOutput {
                    var output : VertexOutput;
                    output.Position = mvpMatrix[index] * position;
                    output.fragPosition = 0.5 * (position + vec4<f32>(0.1, 0.1, 0.1, 2.0));
                    return output;
                }`,
            }),
            entryPoint: 'main',
            buffers: [{
                arrayStride: 3 * 4, // 3 position 2 uv,
                attributes: [
                    {
                        // position
                        shaderLocation: 0,
                        offset: 0,
                        format: 'float32x3',
                    }
                ]
            }]
        },
        fragment: {
            module: device.createShaderModule({
                code: /*wgsl*/`
                @fragment
                fn main(
                    @location(0) fragPosition: vec4<f32>,
                ) -> @location(0) vec4<f32> {
                    return fragPosition;
                    // return f32(index) * vec4(0.02,0.02,0.02,1);
                }
                `,
            }),
            entryPoint: 'main',
            targets: [
                {
                    format: format
                }
            ]
        },
        primitive: {
            topology: 'point-list',
            // Culling backfaces pointing away from the camera
            cullMode: 'back',
            frontFace: 'ccw'
        },
        /*
            cullMode（裁剪模式）：它确定了在渲染过程中是否剔除（裁剪）朝向相机背面的面。在这里，设置为 'back' 表示裁剪朝向相机背面的面。
            frontFace（正面方向）：它指定了确定图元正面的方式。在这里，设置为 'ccw' 表示通过逆时针方向（Counter-Clockwise）的顶点顺序来确定正面。
        */
        // Enable depth testing since we have z-level positions
        // Fragment closest to the camera is rendered in front
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        }
    } as GPURenderPipelineDescriptor)

    // create depthTexture for renderPass
    const depthTexture = device.createTexture({
        size, format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    })
    const depthView = depthTexture.createView()

    // create vertex buffer
    const vertexBuffer = device.createBuffer({
        label: 'GPUBuffer store vertex',
        size: 3 * vertex.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    })
    device.queue.writeBuffer(vertexBuffer, 0, vertex)

    // create a mvp matrix buffer
    const mvpBuffer = device.createBuffer({
        label: 'GPUBuffer store 4x4 matrix',
        size: 4 * 4 * 4 * NUM, // 4 x 4 x float32
        usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    })

    // create a uniform group for Matrix
    const group = device.createBindGroup({
        label: 'Big Group with Matrix',
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            {
                binding: 0,
                resource: {
                    buffer: mvpBuffer
                }
            }
        ]
    })
    // return all vars
    return { pipeline, vertexBuffer, mvpBuffer, group, depthTexture, depthView }
}

// create & submit device commands
function draw(
    device: GPUDevice,
    context: GPUCanvasContext,
    pipelineObj: {
        pipeline: GPURenderPipeline
        vertexBuffer: GPUBuffer
        mvpBuffer: GPUBuffer
        group: GPUBindGroup
        depthView: GPUTextureView
    },
    vertexCount: number
) {
    // start encoder
    const commandEncoder = device.createCommandEncoder()
    const renderPassDescriptor: GPURenderPassDescriptor = {
        colorAttachments: [
            {
                view: context.getCurrentTexture().createView(),
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
                loadOp: 'clear',
                storeOp: 'store'
            }
        ],
        depthStencilAttachment: {
            view: pipelineObj.depthView,
            depthClearValue: 1.0,
            depthLoadOp: 'clear',
            depthStoreOp: 'store',
        }
    }
    const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor)
    passEncoder.setPipeline(pipelineObj.pipeline)
    // set vertex
    passEncoder.setVertexBuffer(0, pipelineObj.vertexBuffer)
    // set uniformGroup
    passEncoder.setBindGroup(0, pipelineObj.group)
    // draw vertex count of cube
    passEncoder.draw(vertexCount, NUM)
    passEncoder.end()
    // webgpu run in a separate process, all the commands will be executed after submit
    device.queue.submit([commandEncoder.finish()])
}

function readTextFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e: ProgressEvent<FileReader>) => {
        const content = e.target!.result as string;
        const lines = content.split(/\r?\n/); // 将内容按行分割

        let data: Array<Number> = []

        for (const line of lines) {
            const values = line.split(/[ ,]/).map(Number); // 将行内容按空格或逗号分割
            values.forEach(element => {
                data.push(element)
            });
        }
        vertex = Float32Array.from(data, num =>
            num.valueOf()
        )
        run()
    };

    reader.readAsText(file);
}


async function run() {

    const canvas = document.querySelector('canvas')
    if (!canvas)
        throw new Error('No Canvas')
    const { device, context, format, size } = await initWebGPU(canvas)
    const pipelineObj = await initPipeline(device, format, size, vertex)

    const scene: any[] = []
    // default state
    let aspect = size.width / size.height
    for (let i = 0; i < NUM; i++) {
        const position = { x: Math.random() * 4 - 2, y: -2 + Math.random() * 4, z: -6 + 4 * Math.random() }
        const scale = { x: 8, y: 8, z: 8 }
        const rotation = { x: 0, y: 0, z: 0 }
        scene.push({ position, rotation, scale })
    }

    // start loop
    const mvpBuffer = new Float32Array(NUM * 4 * 4)
    function frame() {
        for (let i = 0; i < scene.length - 1; i++) {
            const obj = scene[i]
            const now = Date.now() / 1000
            obj.rotation.x = Math.sin(now + i)
            obj.rotation.y = Math.cos(now + i)
            const mvpMatrix = getMvpMatrix(aspect, obj.position, obj.rotation, obj.scale)
            // update buffer based on offset
            // device.queue.writeBuffer(
            //     pipelineObj.mvpBuffer,
            //     i * 4 * 4 * 4, // offset for each object, no need to 256-byte aligned
            //     mvpMatrix
            // )
            // or save to mvpBuffer first
            mvpBuffer.set(mvpMatrix, i * 4 * 4)
        }

        device.queue.writeBuffer(pipelineObj.mvpBuffer, 0, mvpBuffer)
        // then draw
        if (vertex)
            draw(device, context, pipelineObj, vertex.byteLength / 4)
        requestAnimationFrame(frame)
    }
    frame()

    // re-configure context on resize
    window.addEventListener('resize', () => {
        size.width = canvas.width = canvas.clientWidth * devicePixelRatio
        size.height = canvas.height = canvas.clientHeight * devicePixelRatio
        // don't need to recall context.configure() after v104
        // re-create depth texture
        pipelineObj.depthTexture.destroy()
        pipelineObj.depthTexture = device.createTexture({
            size, format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        })
        pipelineObj.depthView = pipelineObj.depthTexture.createView()
        // update aspect
        aspect = size.width / size.height
    })
}


let vertex: Float32Array

document.getElementById('fileInput')!.addEventListener('change', (e: Event) => {
    const target = e.target as HTMLInputElement;
    const file = target.files![0];
    readTextFile(file);
});
