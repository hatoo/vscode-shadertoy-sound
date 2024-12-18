import * as THREE from 'three';
import React, { useEffect, useRef, useState } from "react";
import { Stack, Checkbox, Slider, FormControlLabel, styled, Typography } from '@mui/material';
import { VolumeDown, VolumeUp } from '@mui/icons-material';

const RealtimeSlider = styled(Slider)(() => ({
    "& .MuiSlider-thumb": {
        transition: 'none'
    },
    "& .MuiSlider-track": {
        transition: 'none'
    },
}));

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
gain.gain.value = 0.5;
gain.connect(audioCtx.destination);

export default function App() {
    const [error, setError] = useState('');
    const numBlocks = (audioCtx.sampleRate * DURATION) / samples;
    const [gainValue, setGainValue] = useState(gain.gain.value);
    const [loaded, setLoaded] = useState(false);
    const [autoPlay, setAutoPlay] = useState(false);
    const [loop, setLoop] = useState(false);
    const [start, setStart] = useState(0);
    const [current, setCurrent] = useState(start);
    const [end, setEnd] = useState(DURATION);
    const [lastTimeStamp, setLastTimeStamp] = useState(audioCtx.currentTime);
    const [seeking, setSeeking] = useState(false);

    const [currentNode, setCurrentNode] = useState<AudioBufferSourceNode | null>(null);

    const stop = () => {
        if (currentNode) {
            currentNode.stop();
            currentNode.disconnect();
            setCurrentNode(null);
        }
    };

    const play = (at: number) => {
        stop();
        const audioBufferSourceNode = audioCtx.createBufferSource();
        audioBufferSourceNode.buffer = audioBuffer;
        audioBufferSourceNode.connect(gain);
        audioBufferSourceNode.start(0, at, end - at);
        audioCtx.resume();
        setCurrentNode(audioBufferSourceNode);
        setLastTimeStamp(audioCtx.currentTime - at);
        // Avoid click noise
        gain.gain.value = 0;
        gain.gain.exponentialRampToValueAtTime(gainValue, audioCtx.currentTime + 0.04);
    };

    const requestId = useRef<ReturnType<typeof requestAnimationFrame>>();

    const animate = () => {
        if (!seeking) {
            const new_current = audioCtx.currentTime - lastTimeStamp;
            if (currentNode && audioCtx.state === 'running') {
                if (loop && new_current > end) {
                    play(start);
                } else if (new_current <= end) {
                    setCurrent(new_current);
                }
            }
        }
        console.log(audioCtx.currentTime, lastTimeStamp);
        requestId.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        requestId.current = requestAnimationFrame(animate);
        return () => {
            if (requestId.current) {
                cancelAnimationFrame(requestId.current);
            }
        };
    }, [currentNode, lastTimeStamp, seeking, current, end, loop]);

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
            const info = gl.getShaderInfoLog(glFragmentShader)?.trim() ?? '';
            console.log(info);
            setError(info);
        };
        renderer.debug.onShaderError = onShaderError;
        return () => {
            renderer.debug.onShaderError = null;
        };
    }, []);

    useEffect(() => {
        const onMessage = (event: MessageEvent<{ command: string; shader?: string }>) => {
            console.log(event.data);
            const message = event.data; // The JSON data our extension sent
            switch (message.command) {
                case 'setShader':
                    // Codes are heavily inspired from https://design.dena.com/engineering/soundshader
                    {
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
                            play(start);
                        }

                        break;
                    }
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
        <FormControlLabel control={
            <Checkbox value={loop} onChange={(e) => {
                setLoop(e.target.checked);
            }} />} label="Loop" />
        <Stack spacing={2} direction="row" sx={{ alignItems: 'center', mb: 1 }}>
            <VolumeDown />
            <Slider aria-label="Volume" min={0.0} max={1.0} step={0.005} valueLabelDisplay="auto" value={gainValue} onChange={(e, value) => {
                setGainValue(value as number);
            }} />
            <VolumeUp />
        </Stack>
        <Stack spacing={2} direction="row" sx={{ alignItems: 'center', mb: 1 }}>
            <Typography>Start: {start.toFixed(2)}</Typography>
            <Slider
                min={0}
                max={DURATION}
                size='small'
                step={0.1}
                valueLabelDisplay="off"
                value={[start, end]}
                onChange={(e, value) => {
                    const [a, b] = value as [number, number];
                    setStart(Math.min(a, b));
                    setEnd(Math.max(a, b));
                }}
            />
            <Typography>End: {end.toFixed(2)}</Typography>
        </Stack>
        <RealtimeSlider
            min={start}
            max={end}
            step={0.01}
            valueLabelDisplay="off"
            valueLabelFormat={(value) => value.toFixed(2)}
            value={current}
            onMouseDown={() => {
                setSeeking(true);
            }}
            onMouseUp={() => {
                setSeeking(false);
            }}
            onMouseLeave={() => {
                setSeeking(false);
            }}
            onChange={(e, value) => {
                setCurrent(value as number);
                if (currentNode) {
                    if (audioCtx.state === 'running') {
                        play(current);
                    }
                }
            }}
        />
        <Typography>{current.toFixed(2)}</Typography>
        <button onClick={() => {
            play(current);
        }}>Play</button>
        <button onClick={() => {
            stop();
        }}>Stop</button>
        <button onClick={() => {
            play(start);
        }}>Restart</button>
    </>
}