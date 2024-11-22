import * as THREE from 'three';

const fragmentShaderFooter = `

    uniform float iSampleRate;
    uniform float blockOffset;

    void main(void) {
    float t = blockOffset + ((gl_FragCoord.x - 0.5  ) + (gl_FragCoord.y - 0.5 ) * 512.0) / iSampleRate;
    vec2 y = mainSound(t);
    vec2 v  = floor((0.5 + 0.5 * y) * 65536.0);
    vec2 vl = mod(v, 256.0) / 255.0;
    vec2 vh = floor(v / 256.0) / 255.0;
    gl_FragColor = vec4(vl.x, vh.x, vl.y, vh.y);
    }
`;


const renderer = new THREE.WebGLRenderer();

const DURATION = 180 // 再生秒数

const WIDTH = 512 // 描画エリア幅
const HEIGHT = 512 // 描画エリア高

const audioCtx = new window.AudioContext()
const audioBuffer = audioCtx.createBuffer(2, audioCtx.sampleRate * DURATION, audioCtx.sampleRate);

const samples = WIDTH * HEIGHT
const numBlocks = (audioCtx.sampleRate * DURATION) / samples

//

/*
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
camera.position.set(0, 0, 1);
camera.lookAt(scene.position);

const uniforms = {
    iSampleRate: {
        type: 'f',
        value: audioCtx.sampleRate
    },
    blockOffset: {
        type: 'f',
        value: 0
    },
};

const material = new THREE.ShaderMaterial({
    uniforms: uniforms,
    fragmentShader: document.getElementById('fragmentShader')?.textContent + fragmentShaderFooter // fragmentShader,
});
const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
scene.add(mesh);

const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);

const renderCtx = renderer.getContext()

for (let i = 0; i < numBlocks; i++) {
    uniforms.blockOffset.value = i * samples / audioCtx.sampleRate // シェーダーに数値の割り当て
    renderer.setRenderTarget(target) // オフスクリーンレンダリング 
    renderer.render(scene, camera)

    const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
    renderCtx.readPixels(0, 0, WIDTH, HEIGHT, renderCtx.RGBA, renderCtx.UNSIGNED_BYTE, pixels)  // 描画結果を取得

    const outputDataL = audioBuffer.getChannelData(0) // 音声左チャンネル割り当て
    const outputDataR = audioBuffer.getChannelData(1) // 音声右チャンネル割り当て
    for (let j = 0; j < samples; j++) {
        outputDataL[i * samples + j] = (pixels[j * 4 + 0] + 256 * pixels[j * 4 + 1]) / 65535 * 2 - 1
        outputDataR[i * samples + j] = (pixels[j * 4 + 2] + 256 * pixels[j * 4 + 3]) / 65535 * 2 - 1
    }
}

audioBufferSourceNode.buffer = audioBuffer // 音を割り当てて
audioBufferSourceNode.connect(audioCtx.destination) // 出力先を指定
audioBufferSourceNode.start(0) // 再生
*/

window.addEventListener('message', event => {
    const message = event.data; // The JSON data our extension sent
    switch (message.command) {
        case 'setShader':
            const scene = new THREE.Scene();
            const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
            camera.position.set(0, 0, 1);
            camera.lookAt(scene.position);

            const uniforms = {
                iSampleRate: {
                    type: 'f',
                    value: audioCtx.sampleRate
                },
                blockOffset: {
                    type: 'f',
                    value: 0
                },
            };

            const material = new THREE.ShaderMaterial({
                uniforms: uniforms,
                fragmentShader: message.shader + fragmentShaderFooter // fragmentShader,
            });
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
            scene.add(mesh);

            const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);

            const renderCtx = renderer.getContext()

            for (let i = 0; i < numBlocks; i++) {
                uniforms.blockOffset.value = i * samples / audioCtx.sampleRate // シェーダーに数値の割り当て
                renderer.setRenderTarget(target) // オフスクリーンレンダリング 
                renderer.render(scene, camera)

                const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
                renderCtx.readPixels(0, 0, WIDTH, HEIGHT, renderCtx.RGBA, renderCtx.UNSIGNED_BYTE, pixels)  // 描画結果を取得

                const outputDataL = audioBuffer.getChannelData(0) // 音声左チャンネル割り当て
                const outputDataR = audioBuffer.getChannelData(1) // 音声右チャンネル割り当て
                for (let j = 0; j < samples; j++) {
                    outputDataL[i * samples + j] = (pixels[j * 4 + 0] + 256 * pixels[j * 4 + 1]) / 65535 * 2 - 1
                    outputDataR[i * samples + j] = (pixels[j * 4 + 2] + 256 * pixels[j * 4 + 3]) / 65535 * 2 - 1
                }
            }

            const audioBufferSourceNode = audioCtx.createBufferSource()
            audioBufferSourceNode.buffer = audioBuffer // 音を割り当てて
            audioBufferSourceNode.connect(audioCtx.destination) // 出力先を指定
            audioBufferSourceNode.start(0) // 再生
            break;
    }
});

const eventName = typeof document.ontouchend !== 'undefined' ? 'touchend' : 'mouseup';
document.addEventListener(eventName, initAudioContext);
function initAudioContext() {
    document.removeEventListener(eventName, initAudioContext);
    // wake up AudioContext
    audioCtx.resume();
}