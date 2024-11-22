import * as THREE from 'three';
import React, { useEffect, useState } from "react";

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

const DURATION = 180

const WIDTH = 512
const HEIGHT = 512
const samples = WIDTH * HEIGHT

const vscode = acquireVsCodeApi();

export default function App() {
    const [error, setError] = useState('');
    const [renderer, _setRenderer] = useState(() => new THREE.WebGLRenderer());
    const [audioCtx, _setAudioCtx] = useState(() => new window.AudioContext());
    const numBlocks = (audioCtx.sampleRate * DURATION) / samples;
    const [audioBuffer, _setAudioBuffer] = useState(() => audioCtx.createBuffer(2, audioCtx.sampleRate * DURATION, audioCtx.sampleRate));
    const [gain, _setGain] = useState(() => audioCtx.createGain());
    const [loaded, setLoaded] = useState(false);

    gain.connect(audioCtx.destination)

    useEffect(() => {
        const onShaderError = (
            gl: WebGLRenderingContext,
            program: WebGLProgram,
            glVertexShader: WebGLShader,
            glFragmentShader: WebGLShader,
        ) => {
            let info = gl.getShaderInfoLog(glFragmentShader)?.trim() ?? '';
            console.log(info);
            setError(info);
        };
        renderer.debug.onShaderError = onShaderError;
        () => {
            renderer.debug.onShaderError = null;
        }
    }, [renderer]);

    useEffect(() => {
        const onMessage = (event: MessageEvent<any>) => {
            console.log(event.data);
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'setShader':
                    // Codes are heavily inspired from https://design.dena.com/engineering/soundshader
                    setError('');
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
                        fragmentShader: '#line 1 1\n' + message.shader + fragmentShaderFooter
                    });
                    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
                    scene.add(mesh);

                    const target = new THREE.WebGLRenderTarget(WIDTH, HEIGHT);

                    const renderCtx = renderer.getContext()

                    for (let i = 0; i < numBlocks; i++) {
                        uniforms.blockOffset.value = i * samples / audioCtx.sampleRate
                        renderer.setRenderTarget(target)
                        renderer.render(scene, camera)

                        const pixels = new Uint8Array(WIDTH * HEIGHT * 4)
                        renderCtx.readPixels(0, 0, WIDTH, HEIGHT, renderCtx.RGBA, renderCtx.UNSIGNED_BYTE, pixels)

                        const outputDataL = audioBuffer.getChannelData(0)
                        const outputDataR = audioBuffer.getChannelData(1)
                        for (let j = 0; j < samples; j++) {
                            outputDataL[i * samples + j] = (pixels[j * 4 + 0] + 256 * pixels[j * 4 + 1]) / 65535 * 2 - 1
                            outputDataR[i * samples + j] = (pixels[j * 4 + 2] + 256 * pixels[j * 4 + 3]) / 65535 * 2 - 1
                        }
                    }

                    setLoaded(true);

                    break;
            }
        }
        window.addEventListener('message', onMessage);
        vscode.postMessage({ command: 'loaded' });
        () => {
            window.removeEventListener('message', onMessage);
        }
    });

    return <>
        <h1>Preview</h1>
        <pre>{error}</pre>
        <p>{loaded ? 'Loaded' : 'Loading...'}</p>
        <button onClick={() => {
            const audioBufferSourceNode = audioCtx.createBufferSource();
            audioBufferSourceNode.buffer = audioBuffer;
            audioBufferSourceNode.connect(gain);
            audioBufferSourceNode.start(0);
            audioCtx.resume();
        }}>Play</button>
    </>
}