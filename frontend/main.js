import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { PoseDetector } from './ml/pose-detection.js';
import { GestureRecognizer } from './ml/gesture-recognizer.js';
import { Butterfly } from './models/butterfly.js';
import { ButterflyAI } from './ai/butterfly-ai.js';
import { PhysicsWorld } from './physics/physics-world.js';
import { FlowerShader } from './shaders/flower-shader.js';
import { GPUParticleSystem } from './particles/gpu-particles.js';

// --- 日式低饱和度配色工具函数 ---
function desaturateColor(hex, saturation = 0.4) {
    const color = new THREE.Color(hex);
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.s *= saturation; // 降低饱和度
    hsl.l = Math.min(hsl.l * 1.1, 0.9); // 稍微提亮
    return new THREE.Color().setHSL(hsl.h, hsl.s, hsl.l);
}

// --- Three.js 场景设置 ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000); // 黑色深空背景

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// 调整相机位置，清晰展示小行星和花朵
camera.position.set(0, 4, 10);
camera.lookAt(0, -4, 0); // 看向小行星中心（调整以适应新位置）

// 检查canvas元素
const canvas = document.getElementById('c');
if (!canvas) {
    console.error('❌ Canvas元素未找到！请确保HTML中有 <canvas id="c"></canvas>');
    throw new Error('Canvas element not found');
}
console.log('✓ Canvas元素找到:', canvas);

const renderer = new THREE.WebGLRenderer({ 
    canvas: canvas,
    antialias: true,
    powerPreference: "high-performance",
    stencil: false,
    depth: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // 限制像素比以提高性能
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // 降低曝光度
renderer.outputColorSpace = THREE.SRGBColorSpace; // 使用 sRGB 色彩空间

console.log('✓ Renderer初始化完成:', {
    width: window.innerWidth,
    height: window.innerHeight,
    pixelRatio: renderer.getPixelRatio()
});

// --- 优化的光源设置（清晰、简洁） ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// 主方向光（从上方照亮）
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(0, 10, 5);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
scene.add(directionalLight);

// 点光源照亮小行星和花朵
const planetLight = new THREE.PointLight(0xffffff, 1.0, 30);
planetLight.position.set(0, 1, 0); // 调整以适应新的星球位置
scene.add(planetLight);

// --- 小行星/星球土壤（圆形土堆效果） ---
// 创建一个圆形的小行星，像图片中的土堆
const planetRadius = 4; // 小行星半径（减小，避免遮挡花朵）
const planetSegments = 64; // 高精度，让表面更平滑

// 创建球体几何体
const planetGeometry = new THREE.SphereGeometry(planetRadius, planetSegments, planetSegments);

// 添加表面细节（使用噪声修改顶点位置，让表面更有机）
const planetPositions = planetGeometry.attributes.position;
for (let i = 0; i < planetPositions.count; i++) {
    const x = planetPositions.getX(i);
    const y = planetPositions.getY(i);
    const z = planetPositions.getZ(i);
    
    // 计算到中心的距离
    const distance = Math.sqrt(x * x + y * y + z * z);
    const normalizedX = x / distance;
    const normalizedY = y / distance;
    const normalizedZ = z / distance;
    
    // 添加噪声让表面更有机（小幅度随机变化）
    const noise = (Math.sin(x * 2) + Math.cos(y * 2) + Math.sin(z * 2)) * 0.15;
    const newRadius = planetRadius + noise;
    
    planetPositions.setX(i, normalizedX * newRadius);
    planetPositions.setY(i, normalizedY * newRadius);
    planetPositions.setZ(i, normalizedZ * newRadius);
}
planetGeometry.attributes.position.needsUpdate = true;
planetGeometry.computeVertexNormals();

// 创建土壤材质（清晰的棕色星球表面）
const planetMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513, // 经典的棕色（SaddleBrown）
    roughness: 0.9,
    metalness: 0.0
});

const planet = new THREE.Mesh(planetGeometry, planetMaterial);
planet.position.y = -6; // 往下移，放在屏幕下侧
planet.position.z = 0; // 居中
planet.receiveShadow = true;
planet.castShadow = true;
scene.add(planet);
console.log('✓ 小行星添加到场景');

// 简化纹理 - 移除噪声纹理，使用纯色材质让土壤更清晰
// 不再使用噪声纹理，保持简洁的棕色表面

// 移除白色小点细节，保持简洁

// --- 创建花朵函数（小王子风格和彩虹风格） ---
function createFlower(color = 0xffffff, position = { x: 0, y: 0, z: 0 }, style = 'littleprince') {
    const flowerGroup = new THREE.Group();
    
    // 花茎（从小行星表面生长）
    const stemHeight = style === 'littleprince' ? 1.2 : 1.8;
    const stemGeometry = new THREE.CylinderGeometry(0.05, 0.07, stemHeight, 16);
    const stemMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5016, // 深绿色
        roughness: 0.9,
        metalness: 0.0
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = stemHeight / 2; // 从表面开始
    stem.castShadow = true;
    flowerGroup.add(stem);
    
    // 叶子（小王子风格有3片叶子）
    if (style === 'littleprince') {
        for (let i = 0; i < 3; i++) {
            const leafGeometry = new THREE.ConeGeometry(0.1, 0.3, 8);
            const leafMaterial = new THREE.MeshStandardMaterial({
                color: 0x3d6b2a, // 深绿色叶子
                roughness: 0.9,
                metalness: 0.0
            });
            const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            const leafY = 0.2 + i * 0.4;
            const leafAngle = (i / 3) * Math.PI * 2;
            leaf.position.y = leafY;
            leaf.position.x = Math.cos(leafAngle) * 0.12;
            leaf.position.z = Math.sin(leafAngle) * 0.12;
            leaf.rotation.z = Math.cos(leafAngle) * 0.3;
            leaf.rotation.x = 0.2;
            leaf.castShadow = true;
            flowerGroup.add(leaf);
        }
    }
    
    // 花瓣组 - 创建简洁的球状花朵
    const petalGroup = new THREE.Group();
    const flowerHeight = stemHeight + 0.4; // 花朵在花茎顶部
    
    // 彩虹渐变色数组
    const rainbowColors = [
        0x9b59b6, 0xe74c3c, 0xff6b9d, 0xff8c94,
        0xffa07a, 0xffb347, 0xffd700, 0xffeb3b
    ];
    
    // 小王子风格：简洁的黄色球状花苞（参考图片中的球状花朵）
    if (style === 'littleprince') {
        // 主花苞：黄色球体（稍微拉长，更像花苞）
        const flowerGeometry = new THREE.SphereGeometry(0.35, 24, 24);
        // 稍微拉长，让它看起来更像花苞
        flowerGeometry.scale(1.0, 1.2, 1.0);
        
        const flowerMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700, // 金黄色（参考图片中的黄色花朵）
            roughness: 0.6,
            metalness: 0.1,
            emissive: 0xffd700,
            emissiveIntensity: 0.15 // 轻微发光
        });
        
        const flowerBud = new THREE.Mesh(flowerGeometry, flowerMaterial);
        flowerBud.position.y = flowerHeight;
        flowerBud.castShadow = true;
        flowerBud.receiveShadow = true;
        petalGroup.add(flowerBud);
        
        // 添加几片简单的花瓣围绕花苞（可选，让花朵更自然）
        // 只添加4-5片大花瓣，不要太多
        const petalColor = new THREE.Color(0xffeb3b); // 浅黄色花瓣
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            // 创建简单的圆形花瓣
            const petalGeometry = new THREE.CircleGeometry(0.25, 16);
            const petalMaterial = new THREE.MeshStandardMaterial({
                color: petalColor,
                side: THREE.DoubleSide,
                roughness: 0.7,
                metalness: 0.0,
                transparent: true,
                opacity: 0.8
            });
            const petal = new THREE.Mesh(petalGeometry, petalMaterial);
            
            // 花瓣围绕花苞，稍微向外倾斜
            const radius = 0.4;
            petal.position.x = Math.cos(angle) * radius;
            petal.position.z = Math.sin(angle) * radius;
            petal.position.y = flowerHeight - 0.1;
            
            // 让花瓣朝向中心
            petal.lookAt(0, flowerHeight, 0);
            petal.rotateX(-Math.PI / 3); // 稍微向下倾斜
            
            petal.castShadow = true;
            petal.receiveShadow = true;
            petalGroup.add(petal);
        }
    } else {
        // 彩虹风格：彩色球状花朵
        const petalCount = 6;
        for (let i = 0; i < petalCount; i++) {
            const angle = (i / petalCount) * Math.PI * 2;
            const petalColor = new THREE.Color(rainbowColors[i % rainbowColors.length]);
            
            // 创建圆形花瓣
            const petalGeometry = new THREE.CircleGeometry(0.3, 16);
            const petalMaterial = new THREE.MeshStandardMaterial({
                color: petalColor,
                side: THREE.DoubleSide,
                roughness: 0.7,
                metalness: 0.0,
                transparent: true,
                opacity: 0.85
            });
            const petal = new THREE.Mesh(petalGeometry, petalMaterial);
            
            const radius = 0.5;
            petal.position.x = Math.cos(angle) * radius;
            petal.position.z = Math.sin(angle) * radius;
            petal.position.y = flowerHeight;
            
            petal.lookAt(0, flowerHeight, 0);
            petal.rotateX(-Math.PI / 4);
            
            petal.castShadow = true;
            petal.receiveShadow = true;
            petalGroup.add(petal);
        }
        
        // 彩虹风格的中心
        const centerGeometry = new THREE.SphereGeometry(0.2, 20, 20);
        const centerMaterial = new THREE.MeshStandardMaterial({
            color: 0xffd700,
            roughness: 0.4,
            metalness: 0.2,
            emissive: 0xffd700,
            emissiveIntensity: 0.2
        });
        const center = new THREE.Mesh(centerGeometry, centerMaterial);
        center.position.y = flowerHeight;
        center.castShadow = true;
        petalGroup.add(center);
    }
    
    flowerGroup.add(petalGroup);
    // 花朵位置：计算在小行星表面的位置
    // 使用全局 planetRadius (已在第102行声明)
    const planetCenterY = -6; // 与星球位置一致
    const planetCenterZ = 0;
    
    // 计算在小行星表面的位置（球面坐标）
    const distanceFromCenter = Math.sqrt(position.x * position.x + (position.z - planetCenterZ) * (position.z - planetCenterZ));
    const angle = Math.atan2(position.z - planetCenterZ, position.x);
    
    // 如果距离太远，限制在行星表面
    const maxDistance = planetRadius * 0.9; // 限制在行星表面90%范围内
    const clampedDistance = Math.min(distanceFromCenter, maxDistance);
    
    // 计算在小行星表面的y位置（球面）
    const surfaceX = Math.cos(angle) * clampedDistance;
    const surfaceZ = Math.sin(angle) * clampedDistance;
    let surfaceY = Math.sqrt(Math.max(0, planetRadius * planetRadius - clampedDistance * clampedDistance));
    
    // 确保花朵只在小行星的上半部分（y > 0），避免被遮挡
    // 如果计算出的y值太小（在下半部分），强制放在上半部分
    if (surfaceY < planetRadius * 0.3) {
        surfaceY = planetRadius * 0.5; // 强制放在上半部分
    }
    
    // 花朵从小行星表面生长
    flowerGroup.position.set(surfaceX, planetCenterY + surfaceY, surfaceZ);
    
    // 让花朵垂直于小行星表面（朝向法线方向）
    const normal = new THREE.Vector3(surfaceX, surfaceY, surfaceZ).normalize();
    flowerGroup.lookAt(
        flowerGroup.position.x + normal.x,
        flowerGroup.position.y + normal.y,
        flowerGroup.position.z + normal.z
    );
    
    // 确保花朵始终可见
    flowerGroup.visible = true;
    petalGroup.visible = true;
    stem.visible = true;
    
    // 找到中心元素（如果有）
    const center = petalGroup.children.find(child => 
        child.geometry && child.geometry.type === 'SphereGeometry'
    ) || petalGroup.children[0];
    
    return {
        group: flowerGroup,
        petals: petalGroup,
        center: center,
        stem: stem,
        petalMeshes: petalGroup.children.filter(c => c !== center),
        style: style,
        flowerHeight: flowerHeight
    };
}

// --- 创建多个花朵（小王子风格和彩虹风格） ---
const flowers = [];
// 花朵位置（x和z坐标，y会在创建时根据小行星表面计算）
// 位置在小行星表面，分布在一个圆形区域内
// 使用全局 planetRadius (已在第102行声明)
const flowerPositions = [
    { x: -3, z: -2 },
    { x: -2, z: -3 },
    { x: 0, z: -3.5 },
    { x: 2, z: -3 },
    { x: 3, z: -2 },
    { x: -2.5, z: 0 },
    { x: 0, z: 0.5 },
    { x: 2.5, z: 0 },
    { x: -3.5, z: -1 },
    { x: 3.5, z: -1 },
    { x: 0, z: -1 }, // 中心花朵 - 小王子玫瑰（在小行星顶部）
];

// 花朵风格配置（移除cyberpunk，只保留小王子和彩虹）
const flowerStyles = [
    'rainbow',      // 彩虹渐变
    'littleprince', // 小王子玫瑰
    'rainbow',      // 彩虹渐变
    'littleprince', // 小王子玫瑰
    'rainbow',      // 彩虹渐变
    'littleprince', // 小王子玫瑰
    'rainbow',      // 彩虹渐变
    'littleprince', // 小王子玫瑰
    'rainbow',      // 彩虹渐变
    'littleprince', // 小王子玫瑰
    'littleprince'  // 中心花朵：小王子玫瑰
];

flowerPositions.forEach((pos, index) => {
    const style = flowerStyles[index] || 'littleprince';
    const flower = createFlower(0xffffff, { x: pos.x, y: 0, z: pos.z }, style);
    scene.add(flower.group);
    flowers.push({
        ...flower,
        targetScale: 1.0,
        targetRotation: 0.0,
        currentScale: 1.0,
        currentRotation: 0.0,
        baseColor: 0xffffff,
        style: style,
        basePosition: { x: pos.x, z: pos.z } // 保存基础位置用于更新
    });
});

// 主花朵（中心的花朵，响应数据）
const mainFlower = flowers[flowers.length - 1];

// --- 两阶段系统 ---
let currentPhase = 'voice_interaction'; // 'voice_interaction' 或 'gesture_interaction'
let voiceInteractionComplete = false;
let flowerParamsFixed = false; // 花朵参数是否已固定

// 语音交互阶段：通过语音生成花朵
function startVoiceInteractionPhase() {
    currentPhase = 'voice_interaction';
    voiceInteractionComplete = false;
    flowerParamsFixed = false;
    
    // 显示语音交互界面
    const voiceInteraction = document.getElementById('voice-interaction');
    if (voiceInteraction) {
        voiceInteraction.classList.add('active');
    }
    
    // 隐藏其他花朵，只显示主花朵（中心花朵）
    flowers.forEach((flower, index) => {
        if (flower && flower.group) {
            if (index === flowers.length - 1) {
                // 主花朵可见
                flower.group.visible = true;
                flower.group.scale.set(0.5, 0.5, 0.5);
            } else {
                // 其他花朵隐藏
                flower.group.visible = false;
            }
        }
    });
    
    // 隐藏蝴蝶（第二阶段才显示）
    if (butterfly) {
        const butterflyGroup = butterfly.getGroup();
        if (butterflyGroup) {
            butterflyGroup.visible = false;
        }
    }
    
    console.log('开始语音交互阶段：等待用户语音输入...');
}

// 完成语音交互，进入手势交互阶段
function completeVoiceInteraction() {
    voiceInteractionComplete = true;
    currentPhase = 'gesture_interaction';
    
    // 隐藏语音交互界面
    const voiceInteraction = document.getElementById('voice-interaction');
    if (voiceInteraction) {
        voiceInteraction.classList.remove('active');
    }
    
    // 固定花朵参数
    flowerParamsFixed = true;
    
    // 显示所有花朵和蝴蝶
    flowers.forEach((flower) => {
        if (flower && flower.group) {
            flower.group.visible = true;
            // 确保花朵有正常的大小
            if (flower.group.scale.x < 0.8) {
                flower.group.scale.set(1.0, 1.0, 1.0);
            }
        }
    });
    
    if (butterfly) {
        const butterflyGroup = butterfly.getGroup();
        if (butterflyGroup) {
            butterflyGroup.visible = true;
            butterfly.setTargetPosition(0, 3, 0);
        }
    }
    
    console.log('语音交互完成：进入手势交互阶段');
    
    // 确保姿态检测正在运行
    if (poseDetector) {
        console.log('检查姿态检测状态...');
        // 如果姿态检测未运行，重新启动
        if (typeof poseDetector.isDetectingActive === 'function' && !poseDetector.isDetectingActive()) {
            console.log('姿态检测未运行，重新启动...');
            initPoseDetection().catch(err => {
                console.error('重新启动姿态检测失败:', err);
            });
        } else {
            console.log('姿态检测正在运行');
        }
    } else {
        console.log('姿态检测器未初始化，尝试初始化...');
        initPoseDetection().catch(err => {
            console.error('初始化姿态检测失败:', err);
        });
    }
    
    // 更新状态显示
    const statusElement = document.getElementById('status');
    if (statusElement) {
        statusElement.textContent = '交互模式：使用食指和拇指捏合手势控制蝴蝶';
    }
}

// --- 语音录制功能 ---
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream, {
            mimeType: 'audio/webm;codecs=opus'
        });
        
        audioChunks = [];
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };
        
        mediaRecorder.onstop = async () => {
            const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            await processAudio(audioBlob);
            
            // 停止所有音频轨道
            stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        isRecording = true;
        
        const voiceButton = document.getElementById('voice-button');
        const voiceStatus = document.getElementById('voice-status');
        if (voiceButton) {
            voiceButton.textContent = '⏹ Stop Recording';
            voiceButton.classList.add('recording');
        }
        if (voiceStatus) {
            voiceStatus.textContent = '🎤 Recording... Speak now!';
        }
        
        console.log('开始录音...');
    } catch (error) {
        console.error('无法访问麦克风:', error);
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = '❌ 无法访问麦克风，请检查权限设置';
        }
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton) {
            voiceButton.textContent = '🎤 Start Recording';
            voiceButton.classList.remove('recording');
        }
        
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = '⏳ Processing...';
        }
        
        console.log('停止录音，处理中...');
    }
}

async function processAudio(audioBlob) {
    try {
        // 发送音频到后端进行转写
        const formData = new FormData();
        formData.append('audio', audioBlob, 'recording.webm');
        
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = '🔄 Transcribing...';
        }
        
        const transcribeResponse = await fetch('http://localhost:8000/api/transcribe', {
            method: 'POST',
            body: formData
        });
        
        const transcribeResult = await transcribeResponse.json();
        
        if (!transcribeResult.success) {
            throw new Error(transcribeResult.error || 'Transcription failed');
        }
        
        const text = transcribeResult.text;
        console.log('转写结果:', text);
        
        if (voiceStatus) {
            voiceStatus.textContent = `📝 You said: "${text}"`;
        }
        
        // 生成花朵参数
        if (voiceStatus) {
            voiceStatus.textContent = '🌺 Generating flower...';
        }
        
        const paramsResponse = await fetch('http://localhost:8000/api/generate-flower-params', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text: text })
        });
        
        const paramsResult = await paramsResponse.json();
        
        if (!paramsResult.success) {
            throw new Error(paramsResult.error || 'Failed to generate flower params');
        }
        
        const flowerParams = paramsResult.params;
        console.log('花朵参数:', flowerParams);
        
        // 应用花朵参数到主花朵
        applyFlowerParams(mainFlower, flowerParams);
        
        // 完成语音交互，进入手势交互阶段
        setTimeout(() => {
            completeVoiceInteraction();
        }, 2000);
        
    } catch (error) {
        console.error('处理音频时出错:', error);
        const voiceStatus = document.getElementById('voice-status');
        if (voiceStatus) {
            voiceStatus.textContent = `❌ Error: ${error.message}`;
        }
        
        // 重置按钮
        const voiceButton = document.getElementById('voice-button');
        if (voiceButton) {
            voiceButton.textContent = '🎤 Start Recording';
            voiceButton.classList.remove('recording');
        }
    }
}

function applyFlowerParams(flower, params) {
    if (!flower || !flower.group) return;
    
    // 应用大小
    const size = params.size || 1.0;
    flower.group.scale.set(size, size, size);
    
    // 应用颜色
    const color = new THREE.Color(params.color || '#FFD700');
    if (flower.petalMeshes && flower.petalMeshes.length > 0) {
        flower.petalMeshes.forEach(petal => {
            if (petal.material) {
                petal.material.color.copy(color);
            }
        });
    }
    
    // 应用亮度
    const brightness = params.brightness || 0.8;
    if (flower.center && flower.center.material) {
        flower.center.material.emissiveIntensity = brightness * 0.2;
    }
    
    console.log('花朵参数已应用:', { size, color: params.color, brightness });
}

// 初始化语音交互按钮
document.addEventListener('DOMContentLoaded', () => {
    const voiceButton = document.getElementById('voice-button');
    if (voiceButton) {
        voiceButton.addEventListener('click', () => {
            if (!isRecording) {
                startRecording();
            } else {
                stopRecording();
            }
        });
    }
});

// --- 姿态检测和手势识别 ---
const poseDetector = new PoseDetector();
let gestureRecognizer = null;
try {
    gestureRecognizer = new GestureRecognizer();
    console.log('手势识别器初始化成功');
} catch (error) {
    console.warn('手势识别器初始化失败:', error);
    // 创建一个空的手势识别器对象，避免后续错误
    gestureRecognizer = {
        recognize: () => null,
        getRecentPinchGesture: () => null,
        isCurrentlyPinching: () => false
    };
}
let handPosition = null;

// --- 蝴蝶系统 ---
const butterfly = new Butterfly(0xf5f5dc, { x: 0, y: 3, z: 0 });
scene.add(butterfly.getGroup());
const butterflyAI = new ButterflyAI(butterfly, flowers);
let aiButterflyBehavior = null;

// --- GPU 粒子系统 ---
// 根据设备性能调整粒子数量
const particleCount = window.devicePixelRatio > 1.5 ? 10000 : 5000;
const gpuParticles = new GPUParticleSystem(particleCount, scene);

// --- 日式情绪颜色映射（低饱和度） ---
const emotionColors = {
    'happy': desaturateColor(0xffd89b, 0.4).getHex(),      // 柔和的黄色
    'sad': desaturateColor(0xa8c8ec, 0.4).getHex(),        // 柔和的蓝色
    'angry': desaturateColor(0xff9a9e, 0.4).getHex(),     // 柔和的红色
    'surprise': desaturateColor(0xffb3ba, 0.4).getHex(),  // 柔和的粉红色
    'fear': desaturateColor(0xc7a8d8, 0.4).getHex(),      // 柔和的紫色
    'disgust': desaturateColor(0xbaffc9, 0.4).getHex(),   // 柔和的绿色
    'neutral': desaturateColor(0xf5f5dc, 0.3).getHex()   // 米色
};

// --- Post-processing 设置 ---
let composer = null;
try {
    composer = new EffectComposer(renderer);
    console.log('✓ EffectComposer创建成功');
} catch (error) {
    console.error('❌ EffectComposer创建失败:', error);
    composer = null;
}

const renderPass = new RenderPass(scene, camera);
if (composer) {
    composer.addPass(renderPass);
    console.log('✓ RenderPass添加到composer');
}

// SSAO (屏幕空间环境光遮蔽) - 增强深度感
let ssaoPass = null;
if (composer) {
    try {
        ssaoPass = new SSAOPass(
            scene,
            camera,
            window.innerWidth,
            window.innerHeight
        );
        ssaoPass.kernelRadius = 16;
        ssaoPass.kernelSize = 32;
        ssaoPass.noiseTexture = ssaoPass.generateNoiseTexture();
        ssaoPass.minDistance = 0.005;
        ssaoPass.maxDistance = 0.1;
        composer.addPass(ssaoPass);
        console.log('✓ SSAOPass添加到composer');
    } catch (e) {
        console.warn('SSAO not available:', e);
    }
}

// Bloom 效果（柔和的发光）
let bloomPass = null;
if (composer) {
    try {
        bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            0.5,  // 强度
            0.4,  // 半径
            0.85  // 阈值
        );
        composer.addPass(bloomPass);
        console.log('✓ BloomPass添加到composer');
    } catch (error) {
        console.warn('BloomPass创建失败:', error);
    }
}

// Film Grain（胶片颗粒感）
let filmPass = null;
if (composer) {
    try {
        filmPass = new FilmPass(
            0.15,  // 噪声强度
            0.025, // 扫描线强度
            648,   // 扫描线数量
            false  // 灰度
        );
        composer.addPass(filmPass);
        console.log('✓ FilmPass添加到composer');
    } catch (error) {
        console.warn('FilmPass创建失败:', error);
    }
}

// Output Pass（色调映射）
let outputPass = null;
if (composer) {
    try {
        outputPass = new OutputPass();
        composer.addPass(outputPass);
        console.log('✓ OutputPass添加到composer');
    } catch (error) {
        console.warn('OutputPass创建失败:', error);
    }
}

// --- 全局变量用于平滑动画 ---
let targetScale = 1.0;
let targetRotation = 0.0;
let currentEmotion = 'neutral';
let targetColor = new THREE.Color(emotionColors['neutral']);
let currentColor = new THREE.Color(emotionColors['neutral']);

// --- map 辅助函数 ---
function map(value, inMin, inMax, outMin, outMax) {
    return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

// --- WebSocket 连接 ---
let ws = null;
let reconnectAttempts = 0;
let reconnectTimer = null;
let isConnecting = false;
const MAX_RECONNECT_ATTEMPTS = 10;
const INITIAL_RECONNECT_DELAY = 1000; // 1秒
const MAX_RECONNECT_DELAY = 30000; // 30秒

const statusElement = document.getElementById('status');
const emotionDisplay = document.getElementById('emotion-display');
const emotionEffect = document.getElementById('emotion-effect');
const loudnessValue = document.getElementById('loudness-value');
const loudnessBar = document.getElementById('loudness-bar');
const loudnessEffect = document.getElementById('loudness-effect');
const pitchValue = document.getElementById('pitch-value');
const pitchBar = document.getElementById('pitch-bar');
const pitchEffect = document.getElementById('pitch-effect');
const fpsCounter = document.getElementById('fps-counter');
const gestureStatus = document.getElementById('gesture-status');
const gestureDetail = document.getElementById('gesture-detail');
const gestureDirection = document.getElementById('gesture-direction');

// 手势移动方向追踪
let lastHandPosition = null;
let handMovementHistory = [];
const MAX_HISTORY = 5;

// WebSocket 连接函数
function connectWebSocket() {
    // 如果正在连接或已连接，不重复连接
    if (isConnecting || (ws && ws.readyState === WebSocket.OPEN)) {
        return;
    }
    
    // 如果超过最大重连次数，停止重连
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        console.error('Max reconnect attempts reached');
        if (statusElement) {
            statusElement.textContent = '✗ 连接失败 - 请检查后端服务';
            statusElement.style.color = '#ff9a9e';
        }
        return;
    }
    
    isConnecting = true;
    
    try {
        // 关闭旧连接（如果存在）
        if (ws) {
            ws.onerror = null;
            ws.onclose = null;
            ws.close();
        }
        
        const wsUrl = 'ws://localhost:8000/ws/data';
        console.log('正在尝试连接到:', wsUrl);
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
            console.log('✓ WebSocket connected successfully');
            isConnecting = false;
            reconnectAttempts = 0; // 重置重连计数
            
            // 清除重连定时器
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            
            if (statusElement) {
                statusElement.textContent = '✓ 已连接到后端';
                statusElement.style.color = '#90c695';
            }
            
            // 设置消息处理
            ws.onmessage = handleWebSocketMessage;
            
            // 发送心跳测试
            try {
                ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
            } catch (e) {
                console.warn('Failed to send ping:', e);
            }
        };

        ws.onerror = (error) => {
            console.error('✗ WebSocket error:', error);
            console.error('Error event details:', {
                type: error.type,
                target: error.target,
                readyState: ws ? ws.readyState : 'N/A',
                url: ws ? ws.url : 'N/A'
            });
            console.error('请确保后端服务正在运行: cd backend && uv run python main.py');
            console.error('检查步骤:');
            console.error('1. 确认后端在8000端口运行: lsof -i :8000');
            console.error('2. 测试HTTP连接: curl http://localhost:8000/health');
            isConnecting = false;
            
            if (statusElement) {
                statusElement.textContent = '✗ 连接错误 - 请检查后端是否运行';
                statusElement.style.color = '#ff9a9e';
            }
            // 不在这里重连，让 onclose 处理
        };

        ws.onclose = (event) => {
            console.log('WebSocket disconnected', event.code, event.reason);
            isConnecting = false;
            
            // 如果连接已经建立过，才显示断开消息
            if (reconnectAttempts > 0) {
                if (statusElement) {
                    statusElement.textContent = '✗ 已断开 - 正在重连...';
                    statusElement.style.color = '#ff9a9e';
                }
            }
            
            // 使用指数退避策略重连
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
                reconnectAttempts++;
                const delay = Math.min(
                    INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
                    MAX_RECONNECT_DELAY
                );
                
                console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
                
                // 清除之前的定时器
                if (reconnectTimer) {
                    clearTimeout(reconnectTimer);
                }
                
                reconnectTimer = setTimeout(() => {
                    connectWebSocket();
                }, delay);
            } else {
                if (statusElement) {
                    statusElement.textContent = '✗ 连接失败 - 请刷新页面重试';
                    statusElement.style.color = '#ff9a9e';
                }
            }
        };
    } catch (error) {
        console.error('Failed to create WebSocket:', error);
        isConnecting = false;
        
        if (statusElement) {
            statusElement.textContent = '✗ WebSocket 创建失败';
            statusElement.style.color = '#ff9a9e';
        }
        
        // 使用指数退避重试
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = Math.min(
                INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts - 1),
                MAX_RECONNECT_DELAY
            );
            
            reconnectTimer = setTimeout(() => {
                connectWebSocket();
            }, delay);
        }
    }
}

// 初始化连接
console.log('正在连接到后端 WebSocket: ws://localhost:8000/ws/data');
if (statusElement) {
    statusElement.textContent = '连接中...';
    statusElement.style.color = '#b8d4e3';
}
connectWebSocket();

// 添加连接状态检查（每5秒检查一次）
setInterval(() => {
    if (ws) {
        if (ws.readyState === WebSocket.OPEN) {
            // 连接正常
            if (statusElement && statusElement.textContent.includes('连接中')) {
                statusElement.textContent = '✓ 已连接到后端';
                statusElement.style.color = '#90c695';
            }
        } else if (ws.readyState === WebSocket.CLOSED && !isConnecting) {
            // 连接已关闭且不在重连中
            console.warn('WebSocket 已断开，尝试重连...');
            if (statusElement) {
                statusElement.textContent = '✗ 连接断开 - 正在重连...';
                statusElement.style.color = '#ff9a9e';
            }
            connectWebSocket();
        }
    } else {
        // WebSocket 不存在，尝试创建
        console.warn('WebSocket 不存在，尝试创建...');
        connectWebSocket();
    }
}, 5000);

// --- 初始化姿态检测 ---
async function initPoseDetection() {
    try {
        console.log('开始初始化姿态检测...');
        
        // 获取摄像头流
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 }
        });
        console.log('✓ 摄像头权限已获取');
        
        // 创建隐藏的 video 元素用于姿态检测
        const video = document.createElement('video');
        video.srcObject = stream;
        video.autoplay = true;
        video.playsInline = true;
        video.style.display = 'none';
        document.body.appendChild(video);
        
        // 等待视频就绪
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('视频加载超时'));
            }, 10000);
            
            video.onloadedmetadata = () => {
                clearTimeout(timeout);
                video.width = video.videoWidth;
                video.height = video.videoHeight;
                console.log(`✓ 视频已就绪: ${video.width}x${video.height}`);
                resolve();
            };
            
            video.onerror = (err) => {
                clearTimeout(timeout);
                reject(err);
            };
        });
        
        // 确保视频正在播放
        try {
            await video.play();
            console.log('✓ 视频开始播放');
        } catch (playError) {
            console.warn('视频自动播放失败，尝试手动播放:', playError);
        }
        
        // 启动姿态检测
        console.log('尝试启动姿态检测...');
        const started = await poseDetector.startDetection(video);
        if (started) {
            console.log('✓ 姿态检测已启动');
            
            // 注册姿态检测回调
            poseDetector.onPoseDetected((pose, handPos) => {
                handPosition = handPos;
                
                // 识别手势
                let currentGesture = null;
                if (pose && gestureRecognizer) {
                    currentGesture = gestureRecognizer.recognize(pose, handPos);
                }
                
                // 更新手势显示（即使没有手势也显示手部检测状态）
                updateGestureDisplay(currentGesture, handPos);
                
                // 追踪手部移动方向
                if (handPos) {
                    trackHandMovement(handPos);
                }
                
                // 发送姿态数据到后端（可选）
                if (ws && ws.readyState === WebSocket.OPEN && handPos) {
                    ws.send(JSON.stringify({
                        type: 'pose',
                        hand_position: handPos
                    }));
                }
            });
            
            // 添加错误处理
            if (typeof poseDetector.onError === 'function') {
                poseDetector.onError((error) => {
                    console.error('Pose detection error:', error);
                    if (gestureStatus) {
                        gestureStatus.textContent = '⚠️ 检测错误';
                        gestureStatus.style.color = '#ff9a9e';
                    }
                });
            }
            
            // 更新状态显示
            if (gestureStatus) {
                gestureStatus.textContent = '🔍 正在检测...';
                gestureStatus.style.color = '#a8c8ec';
            }
        } else {
            console.error('✗ 姿态检测启动失败 - startDetection 返回 false');
            if (gestureStatus) {
                gestureStatus.textContent = '⚠️ 检测启动失败 - 请检查控制台';
                gestureStatus.style.color = '#ff9a9e';
            }
            if (gestureDetail) {
                gestureDetail.textContent = '可能原因：模型加载失败或摄像头问题';
            }
        }
    } catch (error) {
        console.error('Error initializing pose detection:', error);
        if (gestureStatus) {
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                gestureStatus.textContent = '⚠️ 需要摄像头权限';
                gestureStatus.style.color = '#ff9a9e';
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                gestureStatus.textContent = '⚠️ 未找到摄像头';
                gestureStatus.style.color = '#ff9a9e';
            } else {
                gestureStatus.textContent = '⚠️ 检测初始化失败';
                gestureStatus.style.color = '#ff9a9e';
            }
        }
        console.log('Continuing without pose detection...');
    }
}

// 更新手势显示
function updateGestureDisplay(gesture, handPos) {
    if (!gestureStatus || !gestureDetail || !gestureDirection) {
        console.warn('手势显示元素未找到');
        return;
    }
    
    // 即使没有手势，如果有手部位置也显示（降低置信度阈值）
    if (handPos && handPos.confidence > 0.2) {
        if (!gesture) {
            gestureStatus.textContent = '✋ 手部检测到';
            gestureStatus.style.color = '#a8c8ec';
            const confidence = Math.round(handPos.confidence * 100);
            gestureDetail.textContent = `置信度: ${confidence}% | 位置: (${handPos.x.toFixed(1)}, ${handPos.y.toFixed(1)})`;
            return;
        }
    } else if (!handPos) {
        // 没有检测到手部，但姿态检测正在运行
        gestureStatus.textContent = '🔍 等待检测手部...';
        gestureStatus.style.color = '#b8d4e3';
        gestureDetail.textContent = '请将手放在摄像头前，确保手部清晰可见';
        gestureDirection.textContent = '-';
        return;
    }
    
    if (!gesture) {
        return;
    }
    
    // 显示手势状态
    const gestureType = gesture.type || 'unknown';
    let statusText = '';
    let statusColor = '#b8d4e3';
    
    switch (gestureType) {
        // 新手势类型（基于位置）
        case 'hand_up':
            statusText = '👆 举手（控制向上）';
            statusColor = '#90c695';
            break;
        case 'hand_down':
            statusText = '👇 手在下方（控制向下）';
            statusColor = '#90c695';
            break;
        case 'hand_left':
            statusText = '👈 手在左侧（控制向左）';
            statusColor = '#90c695';
            break;
        case 'hand_right':
            statusText = '👉 手在右侧（控制向右）';
            statusColor = '#90c695';
            break;
        case 'hand_center':
            statusText = '✋ 手在中间（稳定控制）';
            statusColor = '#a8c8ec';
            break;
        case 'fast_move':
            statusText = '⚡ 快速移动（特殊效果）';
            statusColor = '#ffaa00';
            break;
        case 'stable_top':
            statusText = '🔒 静止在上方';
            statusColor = '#90c695';
            break;
        case 'stable_middle':
            statusText = '🔒 静止在中间';
            statusColor = '#90c695';
            break;
        case 'stable_bottom':
            statusText = '🔒 静止在下方';
            statusColor = '#90c695';
            break;
        // 旧手势类型（兼容）
        case 'pinch_start':
            statusText = '✌️ 捏合开始';
            statusColor = '#90c695';
            break;
        case 'pinch_hold':
            statusText = '✌️ 保持捏合';
            statusColor = '#90c695';
            break;
        case 'pinch_end':
            statusText = '👋 捏合结束';
            statusColor = '#ffaa00';
            break;
        case 'hand_detected':
            statusText = '✋ 手部检测到';
            statusColor = '#a8c8ec';
            break;
        default:
            statusText = `🤚 ${gestureType}`;
            statusColor = '#b8d4e3';
    }
    
    gestureStatus.textContent = statusText;
    gestureStatus.style.color = statusColor;
    
    // 显示手部位置信息和区域
    if (handPos) {
        const confidence = Math.round(handPos.confidence * 100);
        let detailText = `置信度: ${confidence}% | 位置: (${handPos.x.toFixed(1)}, ${handPos.y.toFixed(1)})`;
        
        // 显示区域信息
        if (gesture.region) {
            const region = gesture.region;
            detailText += ` | 区域: ${region.vertical === 'top' ? '上' : region.vertical === 'bottom' ? '下' : '中'}${region.horizontal === 'left' ? '左' : region.horizontal === 'right' ? '右' : '中'}`;
        }
        
        // 显示移动信息
        if (gesture.movement) {
            const mov = gesture.movement;
            if (mov.isMoving) {
                detailText += ` | 移动: ${mov.direction} (${mov.speed.toFixed(2)})`;
            } else {
                detailText += ' | 静止';
            }
        }
        
        gestureDetail.textContent = detailText;
    } else {
        gestureDetail.textContent = '-';
    }
}

// 追踪手部移动方向
function trackHandMovement(currentPos) {
    if (!currentPos) return;
    
    const now = Date.now();
    
    // 添加到历史记录
    handMovementHistory.push({
        x: currentPos.x,
        y: currentPos.y,
        z: currentPos.z,
        timestamp: now
    });
    
    // 保持历史记录在合理范围内
    if (handMovementHistory.length > MAX_HISTORY) {
        handMovementHistory.shift();
    }
    
    // 计算移动方向（使用最近的两个点）
    if (handMovementHistory.length >= 2) {
        const recent = handMovementHistory[handMovementHistory.length - 1];
        const previous = handMovementHistory[handMovementHistory.length - 2];
        
        const dx = recent.x - previous.x;
        const dy = recent.y - previous.y;
        const dz = recent.z - previous.z;
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const timeDiff = (recent.timestamp - previous.timestamp) / 1000; // 秒
        const speed = distance / timeDiff;
        
        if (distance > 0.1 && speed > 0.1) { // 只显示明显的移动
            // 计算方向角度（度）
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // 确定方向名称
            let directionName = '';
            let directionEmoji = '';
            
            if (Math.abs(dx) > Math.abs(dy)) {
                if (dx > 0) {
                    directionName = '右';
                    directionEmoji = '→';
                } else {
                    directionName = '左';
                    directionEmoji = '←';
                }
            } else {
                if (dy > 0) {
                    directionName = '上';
                    directionEmoji = '↑';
                } else {
                    directionName = '下';
                    directionEmoji = '↓';
                }
            }
            
            // 组合方向（如果有明显的Z轴移动）
            if (Math.abs(dz) > 0.2) {
                if (dz > 0) {
                    directionName += ' 前';
                    directionEmoji += ' ↗';
                } else {
                    directionName += ' 后';
                    directionEmoji += ' ↘';
                }
            }
            
            const speedText = speed > 1.0 ? '快速' : speed > 0.5 ? '中速' : '慢速';
            gestureDirection.textContent = `${directionEmoji} 移动方向: ${directionName} | 速度: ${speedText} (${speed.toFixed(2)} m/s)`;
            gestureDirection.style.color = speed > 1.0 ? '#ffaa00' : '#90c695';
        } else {
            gestureDirection.textContent = '⏸️ 静止';
            gestureDirection.style.color = '#b8d4e3';
        }
    } else {
        gestureDirection.textContent = '-';
    }
}

// 页面加载检查
window.addEventListener('load', async () => {
    console.log('Page loaded');
    console.log('Canvas element:', document.getElementById('c'));
    console.log('Status element:', statusElement);
    
    // 检查是否通过 HTTP 服务器运行
    if (window.location.protocol === 'file:') {
        console.warn('⚠️ 警告: 使用 file:// 协议可能无法正常工作');
        console.warn('建议使用 HTTP 服务器运行: python -m http.server 8080');
        if (statusElement) {
            statusElement.textContent = '⚠️ 请使用 HTTP 服务器运行';
            statusElement.style.color = '#ffaa00';
        }
    }
    
    // 初始化姿态检测
    await initPoseDetection();
});

// --- WebSocket 消息处理函数 ---
function handleWebSocketMessage(event) {
    try {
        const data = JSON.parse(event.data);
        
        // 处理连接确认消息
        if (data.type === 'connected') {
            console.log('✓ WebSocket连接已建立:', data.message);
            if (statusElement) {
                statusElement.textContent = '✓ 已连接到后端';
                statusElement.style.color = '#90c695';
            }
            return;
        }
        
        // 处理心跳消息
        if (data.type === 'ping') {
            console.log('收到后端心跳');
            if (statusElement && statusElement.textContent.includes('连接中')) {
                statusElement.textContent = '✓ 已连接到后端';
                statusElement.style.color = '#90c695';
            }
            return;
        }
        
        // 处理pong响应
        if (data.type === 'pong') {
            console.log('收到后端pong响应');
            return;
        }
        
        // 确认收到数据，更新连接状态
        if (statusElement) {
            if (statusElement.textContent.includes('连接中') || statusElement.textContent.includes('断开')) {
                statusElement.textContent = '✓ 已连接 - 数据接收中';
                statusElement.style.color = '#90c695';
            }
        }
        
        currentEmotion = data.emotion;
        
        // 更新状态显示（显示当前情绪）
        const emotionNames = {
            'happy': '😊 开心',
            'sad': '😢 悲伤',
            'angry': '😠 愤怒',
            'surprise': '😲 惊讶',
            'fear': '😨 恐惧',
            'disgust': '🤢 厌恶',
            'neutral': '😐 中性'
        };
        
        // 只在有情绪数据时才更新状态文本
        if (data.emotion) {
            // 不覆盖连接状态，而是显示在UI的其他位置
            // statusElement.textContent = `✓ ${emotionNames[data.emotion] || '😐 中性'}`;
        }
        
        // --- 更新表情特征显示 ---
        const emotionDisplayNames = {
            'happy': '😊 开心',
            'sad': '😢 悲伤',
            'angry': '😠 愤怒',
            'surprise': '😲 惊讶',
            'fear': '😨 恐惧',
            'disgust': '🤢 厌恶',
            'neutral': '😐 中性'
        };
        emotionDisplay.textContent = emotionDisplayNames[data.emotion] || '😐 中性';
        emotionEffect.textContent = `→ 花朵颜色变为柔和的${emotionDisplayNames[data.emotion]?.split(' ')[1] || '中性'}色调`;
        
        // 获取情绪颜色（低饱和度）- 只在参数未固定时更新
        if (!flowerParamsFixed || currentPhase === 'voice_interaction') {
            const emotionColorHex = emotionColors[data.emotion] || emotionColors['neutral'];
            targetColor.setHex(emotionColorHex);
        }
        
        // --- 更新响度显示 ---
        const loudnessPercent = Math.round(data.loudness * 100);
        loudnessValue.textContent = `${loudnessPercent}%`;
        loudnessBar.style.width = `${loudnessPercent}%`;
        
        // 根据响度影响所有花朵
        const baseScale = map(data.loudness, 0, 0.5, 0.9, 1.3);
        targetScale = baseScale;
        const scalePercent = Math.round((baseScale - 0.9) / (1.3 - 0.9) * 100);
        
        if (loudnessPercent < 20) {
            loudnessEffect.textContent = `→ 花朵大小: ${scalePercent}% (安静，花朵较小)`;
        } else if (loudnessPercent < 50) {
            loudnessEffect.textContent = `→ 花朵大小: ${scalePercent}% (中等，正常大小)`;
        } else if (loudnessPercent < 80) {
            loudnessEffect.textContent = `→ 花朵大小: ${scalePercent}% (较大，花朵放大)`;
        } else {
            loudnessEffect.textContent = `→ 花朵大小: ${scalePercent}% (很大，花朵显著放大)`;
        }
        
        // 根据响度创建涟漪效果
        flowers.forEach((flower, index) => {
            if (flower !== mainFlower) {
                const distance = Math.sqrt(
                    Math.pow(flower.group.position.x, 2) + 
                    Math.pow(flower.group.position.z, 2)
                );
                const rippleEffect = Math.sin(distance * 1.5 - Date.now() * 0.005) * 0.1 + 1;
                flower.targetScale = baseScale * rippleEffect;
            }
        });
        
        // --- 更新音高显示 ---
        const pitch = Math.round(data.pitch);
        pitchValue.textContent = `${pitch} Hz`;
        const pitchNormalized = (data.pitch - 50) / 350;
        const pitchPercent = Math.round(pitchNormalized * 100);
        pitchBar.style.width = `${pitchPercent}%`;
        
        // 映射音高到旋转
        targetRotation = map(data.pitch, 50, 400, -0.25, 0.25);
        const rotationDeg = Math.round(targetRotation * 180 / Math.PI);
        
        if (pitch < 150) {
            pitchEffect.textContent = `→ 花朵旋转: ${rotationDeg}° (低音，向左倾斜)`;
        } else if (pitch < 250) {
            pitchEffect.textContent = `→ 花朵旋转: ${rotationDeg}° (中音，轻微倾斜)`;
        } else if (pitch < 350) {
            pitchEffect.textContent = `→ 花朵旋转: ${rotationDeg}° (高音，向右倾斜)`;
        } else {
            pitchEffect.textContent = `→ 花朵旋转: ${rotationDeg}° (很高音，明显倾斜)`;
        }
        
        // 根据音高影响主光源
        planetLight.intensity = 0.8 + pitchNormalized * 0.4;
        
        // --- 处理 AI 推荐数据 ---
        if (data.ai) {
            // 更新蝴蝶 AI 行为
            if (data.ai.butterfly) {
                aiButterflyBehavior = data.ai.butterfly;
            }
            
            // 应用视觉推荐（如果有）
            if (data.ai.visual) {
                const visual = data.ai.visual;
                if (visual.color) {
                    const color = new THREE.Color(visual.color.r, visual.color.g, visual.color.b);
                    targetColor.lerp(color, 0.1);
                }
                if (visual.bloom_intensity !== undefined && bloomPass) {
                    bloomPass.strength = visual.bloom_intensity;
                }
            }
            
            // 应用环境推荐（如果有）
            if (data.ai.environment) {
                const env = data.ai.environment;
                if (env.background_color) {
                    const bgColor = new THREE.Color(
                        env.background_color.r,
                        env.background_color.g,
                        env.background_color.b
                    );
                    scene.background.lerp(bgColor, 0.05);
                }
                if (env.fog && env.fog.enabled) {
                    if (!scene.fog) {
                        scene.fog = new THREE.FogExp2(0x1a1a1f, 0.02);
                    }
                    const fogColor = new THREE.Color(
                        env.fog.color.r,
                        env.fog.color.g,
                        env.fog.color.b
                    );
                    scene.fog.color.lerp(fogColor, 0.05);
                    scene.fog.density = env.fog.density;
                }
            }
        }
        
        // 更新蝴蝶响应情绪
        butterflyAI.respondToEmotion(data.emotion, data.emotion_intensity || 5);
        
    } catch (error) {
        console.error('Error parsing WebSocket data:', error);
    }
}

// --- 性能监控 ---
let animationFrameCount = 0;
let lastFpsTime = performance.now();
let fps = 60;

// --- 动画循环 ---
let time = 0;
let lastTime = performance.now();
function animate() {
    requestAnimationFrame(animate);
    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.1); // 限制最大 deltaTime
    lastTime = currentTime;
    time += 0.006;
    
    // FPS 计算（每60帧更新一次）
    animationFrameCount++;
    if (animationFrameCount % 60 === 0) {
        const elapsed = (currentTime - lastFpsTime) / 1000;
        fps = Math.round(60 / elapsed);
        lastFpsTime = currentTime;
        
        // 更新 FPS 显示
        if (fpsCounter) {
            fpsCounter.textContent = `FPS: ${fps}`;
            fpsCounter.style.color = fps >= 50 ? '#90c695' : fps >= 30 ? '#ffaa00' : '#ff9a9e';
        }
        
        // 可以根据 FPS 动态调整效果质量
        if (fps < 30) {
            // 降低粒子数量或效果质量
            console.warn('Low FPS detected:', fps);
        }
    }
    
    // 平滑颜色过渡（只在语音交互阶段或参数未固定时更新）
    if (!flowerParamsFixed || currentPhase === 'voice_interaction') {
        currentColor.lerp(targetColor, 0.04);
        
        // 更新主花朵颜色（平滑过渡）
        mainFlower.petalMeshes.forEach(petal => {
            if (petal.material) {
                petal.material.color.lerp(currentColor, 0.08);
            }
        });
    }
    
    // --- 两阶段系统更新 ---
    // 语音交互阶段不需要自动完成检查，需要等待用户完成录音
    
    // 确保所有花朵始终在场景中且可见
    flowers.forEach((flower, index) => {
        if (!flower || !flower.group) {
            console.warn(`Flower ${index} is missing!`);
            return;
        }
        
        // 确保花朵在场景中
        if (!scene.children.includes(flower.group)) {
            console.warn(`Flower ${index} was removed from scene, re-adding...`);
            scene.add(flower.group);
        }
        
        // 强制可见
        flower.group.visible = true;
        if (flower.petals) flower.petals.visible = true;
        if (flower.stem) flower.stem.visible = true;
        if (flower.center) flower.center.visible = true;
        
        // 确保scale不会变成0
        const currentScale = flower.group.scale.x;
        if (currentScale < 0.01) {
            console.warn(`Flower ${index} scale too small: ${currentScale}, resetting...`);
            flower.group.scale.set(0.5, 0.5, 0.5);
        }
    });
    
    // 语音交互阶段：主花朵保持可见
    if (currentPhase === 'voice_interaction') {
        // 主花朵保持可见，等待用户语音输入
        if (mainFlower && mainFlower.group) {
            mainFlower.group.visible = true;
        }
    }
    
    // 手势交互阶段：确保姿态检测正在运行
    if (currentPhase === 'gesture_interaction') {
        // 确保姿态检测已启动
        if (poseDetector && typeof poseDetector.isDetectingActive === 'function' && !poseDetector.isDetectingActive()) {
            console.log('姿态检测未运行，重新启动...');
            initPoseDetection().catch(err => {
                console.error('重新启动姿态检测失败:', err);
            });
        }
        
        // 在手势交互阶段，所有花朵应该已经可见并正常显示
        flowers.forEach((flower, index) => {
            if (flower && flower.group) {
                // 确保花朵可见
                flower.group.visible = true;
                
                // 更新花朵在小行星表面的位置
                if (flower.basePosition) {
                    // 使用全局 planetRadius (已在第102行声明)
                    const planetCenterY = -6; // 与星球位置一致
                    const planetCenterZ = 0;
                    
                    const distanceFromCenter = Math.sqrt(
                        flower.basePosition.x * flower.basePosition.x + 
                        (flower.basePosition.z - planetCenterZ) * (flower.basePosition.z - planetCenterZ)
                    );
                    const angle = Math.atan2(flower.basePosition.z - planetCenterZ, flower.basePosition.x);
                    
                    const maxDistance = planetRadius * 0.9;
                    const clampedDistance = Math.min(distanceFromCenter, maxDistance);
                    
                    const surfaceX = Math.cos(angle) * clampedDistance;
                    const surfaceZ = Math.sin(angle) * clampedDistance;
                    let surfaceY = Math.sqrt(Math.max(0, planetRadius * planetRadius - clampedDistance * clampedDistance));
                    
                    // 确保花朵只在小行星的上半部分
                    if (surfaceY < planetRadius * 0.3) {
                        surfaceY = planetRadius * 0.5;
                    }
                    
                    flower.group.position.set(surfaceX, planetCenterY + surfaceY, surfaceZ);
                    
                    // 让花朵垂直于小行星表面
                    const normal = new THREE.Vector3(surfaceX, surfaceY, surfaceZ).normalize();
                    flower.group.lookAt(
                        flower.group.position.x + normal.x,
                        flower.group.position.y + normal.y,
                        flower.group.position.z + normal.z
                    );
                }
                
                // 保持正常大小，如果太小则逐渐放大
                if (flower.group.scale.x < 0.8) {
                    flower.group.scale.lerp(new THREE.Vector3(1.0, 1.0, 1.0), 0.05);
                }
                
                // 轻微旋转动画
                flower.group.rotation.y = Math.sin(time * 0.5 + index * 0.5) * 0.03;
            }
        });
    } else {
        // 交互阶段：正常更新
            // 更新主花朵
            const targetScaleValue = Math.max(0.3, targetScale); // 确保最小scale
            const targetScaleVec = new THREE.Vector3(targetScaleValue, targetScaleValue, targetScaleValue);
            if (mainFlower && mainFlower.group) {
                mainFlower.group.visible = true; // 确保始终可见
                
                // 更新主花朵在小行星表面的位置
                if (mainFlower.basePosition) {
                    // 使用全局 planetRadius (已在第102行声明)
                    const planetCenterY = -6; // 与星球位置一致
                    const planetCenterZ = 0;
                    
                    const distanceFromCenter = Math.sqrt(
                        mainFlower.basePosition.x * mainFlower.basePosition.x + 
                        (mainFlower.basePosition.z - planetCenterZ) * (mainFlower.basePosition.z - planetCenterZ)
                    );
                    const angle = Math.atan2(mainFlower.basePosition.z - planetCenterZ, mainFlower.basePosition.x);
                    
                    const maxDistance = planetRadius * 0.9;
                    const clampedDistance = Math.min(distanceFromCenter, maxDistance);
                    
                    const surfaceX = Math.cos(angle) * clampedDistance;
                    const surfaceZ = Math.sin(angle) * clampedDistance;
                    let surfaceY = Math.sqrt(Math.max(0, planetRadius * planetRadius - clampedDistance * clampedDistance));
                    
                    // 确保花朵只在小行星的上半部分
                    if (surfaceY < planetRadius * 0.3) {
                        surfaceY = planetRadius * 0.5;
                    }
                    
                    mainFlower.group.position.set(surfaceX, planetCenterY + surfaceY, surfaceZ);
                    
                    // 让花朵垂直于小行星表面
                    const normal = new THREE.Vector3(surfaceX, surfaceY, surfaceZ).normalize();
                    mainFlower.group.lookAt(
                        mainFlower.group.position.x + normal.x,
                        mainFlower.group.position.y + normal.y,
                        mainFlower.group.position.z + normal.z
                    );
                }
                
                mainFlower.group.scale.lerp(targetScaleVec, 0.06);
                
                // 确保scale不会太小
                if (mainFlower.group.scale.x < 0.1) {
                    mainFlower.group.scale.set(0.5, 0.5, 0.5);
                }
                
                mainFlower.group.rotation.z = THREE.MathUtils.lerp(
                    mainFlower.group.rotation.z,
                    targetRotation,
                    0.06
                );
            
            // 花瓣自然摆动
            if (mainFlower.petals) {
                mainFlower.petals.visible = true;
                mainFlower.petals.rotation.y = Math.sin(time * 1.2) * 0.06;
                mainFlower.petals.rotation.x = Math.cos(time * 1.0) * 0.04;
            }
            
            // 花心脉动（小王子风格不脉动，保持闭合状态）
            if (mainFlower.center && mainFlower.style !== 'littleprince') {
                mainFlower.center.visible = true;
                const pulse = Math.sin(time * 1.8) * 0.08 + 1;
                mainFlower.center.scale.set(pulse, pulse, pulse);
            } else if (mainFlower.center) {
                mainFlower.center.visible = true;
            }
        }
        
        // 更新其他花朵
        flowers.forEach((flower, index) => {
            if (flower && flower.group && flower !== mainFlower) {
                // 确保花朵始终可见
                flower.group.visible = true;
                
                // 更新花朵在小行星表面的位置
                if (flower.basePosition) {
                    // 使用全局 planetRadius (已在第102行声明)
                    const planetCenterY = -6; // 与星球位置一致
                    const planetCenterZ = 0;
                    
                    const distanceFromCenter = Math.sqrt(
                        flower.basePosition.x * flower.basePosition.x + 
                        (flower.basePosition.z - planetCenterZ) * (flower.basePosition.z - planetCenterZ)
                    );
                    const angle = Math.atan2(flower.basePosition.z - planetCenterZ, flower.basePosition.x);
                    
                    const maxDistance = planetRadius * 0.9;
                    const clampedDistance = Math.min(distanceFromCenter, maxDistance);
                    
                    const surfaceX = Math.cos(angle) * clampedDistance;
                    const surfaceZ = Math.sin(angle) * clampedDistance;
                    const surfaceY = Math.sqrt(Math.max(0, planetRadius * planetRadius - clampedDistance * clampedDistance));
                    
                    flower.group.position.set(surfaceX, planetCenterY + surfaceY, surfaceZ);
                    
                    // 让花朵垂直于小行星表面
                    const normal = new THREE.Vector3(surfaceX, surfaceY, surfaceZ).normalize();
                    flower.group.lookAt(
                        flower.group.position.x + normal.x,
                        flower.group.position.y + normal.y,
                        flower.group.position.z + normal.z
                    );
                }
                
                // 确保targetScale有效
                const safeTargetScale = Math.max(0.5, flower.targetScale || 1.0);
                flower.group.scale.lerp(
                    new THREE.Vector3(safeTargetScale, safeTargetScale, safeTargetScale),
                    0.03
                );
                
                // 确保scale不会太小
                if (flower.group.scale.x < 0.1) {
                    flower.group.scale.set(0.5, 0.5, 0.5);
                }
                
                flower.group.rotation.y = Math.sin(time * 1.0 + index * 0.5) * 0.06;
                
                if (flower.petals) {
                    flower.petals.visible = true;
                    flower.petals.rotation.y = Math.sin(time * 1.2 + index * 0.7) * 0.08;
                }
                
                if (flower.center) {
                    flower.center.visible = true;
                    if (flower.style !== 'littleprince') {
                        const pulse = Math.sin(time * 1.8 + index) * 0.06 + 1;
                        flower.center.scale.set(pulse, pulse, pulse);
                    }
                }
            }
        });
    }
    
    // 更新 GPU 粒子系统（始终更新，保持活动）
    const emotionColorHex = emotionColors[currentEmotion] || emotionColors['neutral'];
    if (gpuParticles) {
        gpuParticles.update(deltaTime, emotionColorHex);
    }
    
    // 添加蝴蝶轨迹粒子（降低频率以提高性能）
    if (butterfly && animationFrameCount % 3 === 0) {
        const butterflyPos = butterfly.getPosition();
        gpuParticles.addButterflyTrail(butterflyPos, butterfly.color);
    }
    
    // 旋转点光源位置（围绕小行星）
    // 移除旋转的点光源，保持简洁
    
    // 主光源保持在小行星上方
    planetLight.position.y = 1 + Math.sin(time * 0.1) * 0.3;
    
    // 轻微旋转相机（围绕小行星缓慢旋转）
    const cameraX = Math.sin(time * 0.05) * 1.5;
    const cameraY = 4 + Math.sin(time * 0.03) * 0.5;
    const cameraZ = 10 + Math.cos(time * 0.05) * 1.5;
    
    // 确保相机位置有效
    if (!isNaN(cameraX) && !isNaN(cameraY) && !isNaN(cameraZ)) {
        camera.position.set(cameraX, cameraY, cameraZ);
        camera.lookAt(0, -4, 0); // 看向小行星中心（调整以适应新位置）
    } else {
        // 如果相机位置无效，重置
        console.warn('Camera position invalid, resetting...');
        camera.position.set(0, 4, 10);
        camera.lookAt(0, -4, 0);
    }
    
    // --- 确保蝴蝶始终可见 ---
    if (butterfly) {
        const butterflyGroup = butterfly.getGroup();
        if (butterflyGroup) {
            // 确保蝴蝶在场景中
            if (!scene.children.includes(butterflyGroup)) {
                console.warn('Butterfly was removed from scene, re-adding...');
                scene.add(butterflyGroup);
            }
            
            // 强制可见
            butterflyGroup.visible = true;
            butterflyGroup.traverse((child) => {
                if (child.isMesh) {
                    child.visible = true;
                }
            });
            
            // 确保蝴蝶位置合理
            const butterflyPos = butterfly.getPosition();
            if (!butterflyPos || 
                isNaN(butterflyPos.x) || isNaN(butterflyPos.y) || isNaN(butterflyPos.z) ||
                Math.abs(butterflyPos.x) > 100 || Math.abs(butterflyPos.y) > 100 || Math.abs(butterflyPos.z) > 100) {
                console.warn('Butterfly position invalid, resetting...');
                butterfly.setTargetPosition(0, 3, 0);
            }
        }
    }
    
    // --- 更新蝴蝶 ---
    // 只在交互阶段更新蝴蝶
    if (currentPhase === 'gesture_interaction' && flowerParamsFixed) {
        // 检测捏合手势（添加安全检查）
        let effectiveHandPosition = null;
        let shouldFollowHand = false;
        
        if (gestureRecognizer && typeof gestureRecognizer.getRecentPinchGesture === 'function') {
            const currentGesture = gestureRecognizer.getRecentPinchGesture();
            
            if (currentGesture && currentGesture.gesture) {
                const gestureType = currentGesture.gesture.type;
                const gesture = currentGesture.gesture;
                
                // 新手势类型：基于位置的手势都可以控制蝴蝶
                if (gestureType === 'hand_up' || 
                    gestureType === 'hand_down' || 
                    gestureType === 'hand_left' || 
                    gestureType === 'hand_right' || 
                    gestureType === 'hand_center' ||
                    gestureType.startsWith('stable_')) {
                    // 这些手势都可以控制蝴蝶
                    if (gesture.handPosition) {
                        effectiveHandPosition = {
                            ...gesture.handPosition,
                            gestureType: gestureType,
                            region: gesture.region
                        };
                        shouldFollowHand = true;
                    }
                } 
                // 快速移动：触发特殊效果
                else if (gestureType === 'fast_move') {
                    // 快速移动时，蝴蝶快速跟随
                    if (gesture.handPosition) {
                        effectiveHandPosition = {
                            ...gesture.handPosition,
                            gestureType: gestureType,
                            isFast: true
                        };
                        shouldFollowHand = true;
                    }
                }
                // 旧手势类型（兼容）
                else if (gestureType === 'pinch_start' || gestureType === 'pinch_hold') {
                    if (gesture.handPosition) {
                        effectiveHandPosition = {
                            ...gesture.handPosition,
                            isPinching: true
                        };
                        shouldFollowHand = true;
                    }
                } else if (gestureType === 'pinch_end') {
                    // 捏合结束，停止跟随
                    effectiveHandPosition = null;
                    shouldFollowHand = false;
                }
            }
        } else {
            // 如果手势识别器不可用，使用手部位置（如果有）
            if (handPosition && handPosition.confidence > 0.5) {
                effectiveHandPosition = handPosition;
                shouldFollowHand = true;
            }
        }
        
        // 根据手势类型控制蝴蝶
        const flightSpeed = aiButterflyBehavior?.flight_speed || 0.5;
        if (effectiveHandPosition && shouldFollowHand) {
            // 根据手势类型调整飞行速度
            let adjustedSpeed = flightSpeed;
            if (effectiveHandPosition.isFast) {
                adjustedSpeed = flightSpeed * 2.0; // 快速移动时加速
            } else if (effectiveHandPosition.gestureType && effectiveHandPosition.gestureType.startsWith('stable_')) {
                adjustedSpeed = flightSpeed * 0.7; // 静止时减速，更精确控制
            }
            
            // 手势控制：蝴蝶跟随手部位置
            // 确保传递手部位置给蝴蝶AI（传递 null 作为 aiBehavior 以使用 defaultBehavior）
            butterflyAI.update(deltaTime, effectiveHandPosition, null);
            butterfly.update(deltaTime, adjustedSpeed);
        } else {
            // 无手势控制：使用AI行为或默认行为（自由飞行）
            // 确保传递 null 作为 handPosition，让 AI 使用默认行为
            butterflyAI.update(deltaTime, null, aiButterflyBehavior);
            // 确保蝴蝶始终在更新
            butterfly.update(deltaTime, flightSpeed);
        }
    } else {
        // 初始化阶段：蝴蝶也可见，但位置固定
        if (butterfly) {
            butterfly.setTargetPosition(0, 3, 0);
            butterfly.update(deltaTime, 0.3);
        }
    }
    
    // 检查蝴蝶与花朵的互动
    flowers.forEach((flower, index) => {
        const flowerPos = flower.group.position;
        const butterflyPos = butterfly.getPosition();
        const distance = flowerPos.distanceTo(butterflyPos);
        
        // 如果蝴蝶靠近花朵，触发互动效果
        if (distance < 1.5) {
            // 花朵轻微发光
            if (flower.petalMeshes) {
                flower.petalMeshes.forEach(petal => {
                    if (petal.material) {
                        petal.material.emissiveIntensity = Math.min(
                            petal.material.emissiveIntensity + 0.02,
                            0.4
                        );
                    }
                });
            }
            
            // 在花朵周围添加粒子效果
            if (Math.random() < 0.1) {
                gpuParticles.addButterflyTrail(flowerPos, flower.baseColor || 0xffffff);
            }
        } else {
            // 远离时逐渐恢复
            if (flower.petalMeshes) {
                flower.petalMeshes.forEach(petal => {
                    if (petal.material) {
                        petal.material.emissiveIntensity = Math.max(
                            petal.material.emissiveIntensity - 0.005,
                            0.1
                        );
                    }
                });
            }
        }
    });
    
    // 手势控制蝴蝶（如果检测到手部）
    if (handPosition && handPosition.confidence > 0.5) {
        // 手部位置已经通过 butterflyAI 处理
        // 可以添加额外的交互效果
    }
    
    // 使用 composer 渲染（带后处理效果）
    try {
        if (composer) {
            composer.render();
        } else {
            // 如果composer未初始化，直接使用renderer
            renderer.render(scene, camera);
        }
    } catch (error) {
        console.error('❌ 渲染错误:', error);
        // 如果composer失败，尝试直接使用renderer
        try {
            renderer.render(scene, camera);
        } catch (renderError) {
            console.error('❌ Renderer渲染也失败:', renderError);
        }
    }
    
    // 每60帧检查一次场景状态（调试用）
    if (animationFrameCount % 60 === 0) {
        if (scene.children.length === 0) {
            console.warn('⚠️ 警告：场景中没有对象！');
        }
    }
}

// 处理窗口大小变化
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    if (composer) {
        composer.setSize(window.innerWidth, window.innerHeight);
    }
    if (ssaoPass) {
        ssaoPass.setSize(window.innerWidth, window.innerHeight);
    }
});

// 启动语音交互阶段
startVoiceInteractionPhase();

// 检查场景内容
console.log('✓ 场景初始化完成:', {
    children: scene.children.length,
    flowers: flowers.length,
    hasPlanet: scene.children.includes(planet),
    hasButterfly: scene.children.includes(butterfly.getGroup())
});

// 启动动画循环
console.log('✓ 启动动画循环');
animate();
