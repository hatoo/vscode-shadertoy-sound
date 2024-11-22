import * as THREE from 'three';
import React, { useEffect, useState } from "react";
import { Stack, Checkbox, Slider, FormControlLabel } from '@mui/material';
import { VolumeDown, VolumeUp } from '@mui/icons-material';

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

const renderer = new THREE.WebGLRenderer();
const audioCtx = new window.AudioContext();
const audioBuffer = audioCtx.createBuffer(2, audioCtx.sampleRate * DURATION, audioCtx.sampleRate);
const gain = audioCtx.createGain();

export default function App() {
    const [error, setError] = useState('');
    const numBlocks = (audioCtx.sampleRate * DURATION) / samples;
    const [gainValue, setGainValue] = useState(gain.gain.value);
    const [loaded, setLoaded] = useState(false);
    const [autoPlay, setAutoPlay] = useState(false);

    const play = () => {
        const audioBufferSourceNode = audioCtx.createBufferSource();
        audioBufferSourceNode.buffer = audioBuffer;
        audioBufferSourceNode.connect(gain);
        audioBufferSourceNode.start(0);
        audioCtx.resume();
    };

    gain.connect(audioCtx.destination)

    useEffect(() => {
        gain.gain.value = gainValue;
    }, [gainValue]);

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
        return () => {
            renderer.debug.onShaderError = null;
        };
    }, []);

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

                    if (autoPlay) {
                        play();
                    }

                    break;
            }
        }
        window.addEventListener('message', onMessage);
        vscode.postMessage({ command: 'loaded' });
        return () => {
            window.removeEventListener('message', onMessage);
        };
    });

    return <>
        <h1>Preview</h1>
        <pre>{error}</pre>
        <p>{loaded ? 'Loaded' : 'Loading...'}</p>
        <FormControlLabel control={
            <Checkbox value={autoPlay} onChange={(e) => {
                setAutoPlay(e.target.checked);
            }} />} label="Auto play" />
        <Stack spacing={2} direction="row" sx={{ alignItems: 'center', mb: 1 }}>
            <VolumeDown />
            <Slider aria-label="Volume" min={0.0} max={2.0} step={0.005} marks valueLabelDisplay="on" value={gainValue} onChange={(e, value) => {
                setGainValue(value as number);
            }} />
            <VolumeUp />
        </Stack>
        <button onClick={() => {
            play();
        }}>Play</button>
    </>
}