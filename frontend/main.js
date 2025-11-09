import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

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
scene.background = new THREE.Color(0x1a1a1f); // 柔和的深灰背景

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 6, 18);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ 
    canvas: document.getElementById('c'),
    antialias: true,
    powerPreference: "high-performance"
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.8; // 降低曝光度

// --- 柔和的光源设置 ---
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xfff8e1, 0.6);
directionalLight.position.set(10, 12, 8);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -15;
directionalLight.shadow.camera.right = 15;
directionalLight.shadow.camera.top = 15;
directionalLight.shadow.camera.bottom = -15;
scene.add(directionalLight);

// 柔和的氛围点光源（日式配色）
const pointLight1 = new THREE.PointLight(0xb8d4e3, 0.4, 30);
pointLight1.position.set(-6, 4, 6);
scene.add(pointLight1);

const pointLight2 = new THREE.PointLight(0xe8c5d8, 0.4, 30);
pointLight2.position.set(6, 4, -6);
scene.add(pointLight2);

// --- 柔和的地面 ---
const groundGeometry = new THREE.PlaneGeometry(40, 40, 30, 30);
const groundMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a2a35,
    wireframe: true,
    opacity: 0.15,
    transparent: true,
    emissive: 0x1a1a25,
    emissiveIntensity: 0.2
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -2.5;
ground.receiveShadow = true;
scene.add(ground);

// --- 优化的花朵创建函数（日式风格） ---
function createFlower(color = 0xffffff, position = { x: 0, y: 0, z: 0 }) {
    const flowerGroup = new THREE.Group();
    
    // 花茎（柔和的绿色）
    const stemGeometry = new THREE.CylinderGeometry(0.08, 0.1, 2.5, 12);
    const stemColor = desaturateColor(0x7fb069, 0.5);
    const stemMaterial = new THREE.MeshStandardMaterial({ 
        color: stemColor,
        roughness: 0.8,
        metalness: 0.0
    });
    const stem = new THREE.Mesh(stemGeometry, stemMaterial);
    stem.position.y = 1.25;
    stem.castShadow = true;
    flowerGroup.add(stem);
    
    // 花瓣组
    const petalGroup = new THREE.Group();
    const petalCount = 12;
    const petalGeometry = new THREE.SphereGeometry(0.4, 16, 16);
    
    // 降低颜色饱和度
    const desaturatedColor = desaturateColor(color, 0.5);
    
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const radius = 0.8;
        
        const petal = new THREE.Mesh(
            petalGeometry,
            new THREE.MeshStandardMaterial({ 
                color: desaturatedColor,
                roughness: 0.7,
                metalness: 0.1,
                transparent: true,
                opacity: 0.92
            })
        );
        
        petal.position.x = Math.cos(angle) * radius;
        petal.position.z = Math.sin(angle) * radius;
        petal.position.y = 2.5;
        petal.lookAt(0, 2.5, 0);
        petal.scale.set(1, 1.8, 0.6);
        petal.castShadow = true;
        petalGroup.add(petal);
    }
    
    // 花心（柔和的黄色）
    const centerGeometry = new THREE.SphereGeometry(0.25, 24, 24);
    const centerColor = desaturateColor(0xffd89b, 0.6);
    const centerMaterial = new THREE.MeshStandardMaterial({ 
        color: centerColor,
        roughness: 0.5,
        metalness: 0.2
    });
    const center = new THREE.Mesh(centerGeometry, centerMaterial);
    center.position.y = 2.5;
    center.castShadow = true;
    petalGroup.add(center);
    
    flowerGroup.add(petalGroup);
    flowerGroup.position.set(position.x, position.y, position.z);
    
    return {
        group: flowerGroup,
        petals: petalGroup,
        center: center,
        stem: stem,
        petalMeshes: petalGroup.children.filter(c => c !== center)
    };
}

// --- 创建多个花朵（日式配色） ---
const flowers = [];
const flowerPositions = [
    { x: -4, y: 0, z: -3 },
    { x: -2, y: 0, z: -4 },
    { x: 0, y: 0, z: -4 },
    { x: 2, y: 0, z: -3 },
    { x: 4, y: 0, z: -2 },
    { x: -3, y: 0, z: 2 },
    { x: 0, y: 0, z: 3 },
    { x: 3, y: 0, z: 2 },
    { x: -5, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 }, // 中心花朵
];

// 日式低饱和度配色（pastel 色调）
const baseColors = [
    0xffb3ba, // 粉红
    0xbae1ff, // 淡蓝
    0xbaffc9, // 淡绿
    0xffffba, // 淡黄
    0xffdfba, // 淡橙
    0xe0bbff, // 淡紫
    0xffcccb, // 淡红
    0xc7ceea, // 淡紫蓝
    0xf0e68c, // 卡其
    0xdda0dd, // 梅色
    0xf5f5dc  // 米色（中心花朵）
];

flowerPositions.forEach((pos, index) => {
    const color = baseColors[index % baseColors.length];
    const flower = createFlower(color, pos);
    scene.add(flower.group);
    flowers.push({
        ...flower,
        targetScale: 1.0,
        targetRotation: 0.0,
        currentScale: 1.0,
        currentRotation: 0.0,
        baseColor: color
    });
});

// 主花朵（中心的花朵，响应数据）
const mainFlower = flowers[flowers.length - 1];

// --- 柔和的粒子系统 ---
const particleGeometry = new THREE.BufferGeometry();
const particleCount = 600;
const positions = new Float32Array(particleCount * 3);
const colors = new Float32Array(particleCount * 3);

for (let i = 0; i < particleCount * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 40;
    positions[i + 1] = Math.random() * 12;
    positions[i + 2] = (Math.random() - 0.5) * 40;
    
    // 柔和的颜色
    colors[i] = 0.7;
    colors[i + 1] = 0.75;
    colors[i + 2] = 0.85;
}

particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

const particleMaterial = new THREE.PointsMaterial({
    size: 0.12,
    transparent: true,
    opacity: 0.5,
    vertexColors: true,
    blending: THREE.AdditiveBlending
});

const particles = new THREE.Points(particleGeometry, particleMaterial);
scene.add(particles);

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
const composer = new EffectComposer(renderer);

const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

// Bloom 效果（柔和的发光）
const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.5,  // 强度
    0.4,  // 半径
    0.85  // 阈值
);
composer.addPass(bloomPass);

// Film Grain（胶片颗粒感）
const filmPass = new FilmPass(
    0.15,  // 噪声强度
    0.025, // 扫描线强度
    648,   // 扫描线数量
    false  // 灰度
);
composer.addPass(filmPass);

// Output Pass（色调映射）
const outputPass = new OutputPass();
composer.addPass(outputPass);

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
const ws = new WebSocket('ws://localhost:8000/ws/data');
const statusElement = document.getElementById('status');
const emotionDisplay = document.getElementById('emotion-display');
const emotionEffect = document.getElementById('emotion-effect');
const loudnessValue = document.getElementById('loudness-value');
const loudnessBar = document.getElementById('loudness-bar');
const loudnessEffect = document.getElementById('loudness-effect');
const pitchValue = document.getElementById('pitch-value');
const pitchBar = document.getElementById('pitch-bar');
const pitchEffect = document.getElementById('pitch-effect');

ws.onopen = () => {
    console.log('WebSocket connected');
    statusElement.textContent = '✓ 已连接';
    statusElement.style.color = '#90c695';
};

ws.onerror = (error) => {
    console.error('WebSocket error:', error);
    statusElement.textContent = '✗ 连接错误';
    statusElement.style.color = '#ff9a9e';
};

ws.onclose = () => {
    console.log('WebSocket disconnected');
    statusElement.textContent = '✗ 已断开';
    statusElement.style.color = '#ff9a9e';
};

// --- WebSocket onmessage 回调 ---
ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        currentEmotion = data.emotion;
        
        // 更新状态显示
        const emotionNames = {
            'happy': '😊 开心',
            'sad': '😢 悲伤',
            'angry': '😠 愤怒',
            'surprise': '😲 惊讶',
            'fear': '😨 恐惧',
            'disgust': '🤢 厌恶',
            'neutral': '😐 中性'
        };
        statusElement.textContent = `✓ ${emotionNames[data.emotion] || '😐 中性'}`;
        
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
        
        // 获取情绪颜色（低饱和度）
        const emotionColorHex = emotionColors[data.emotion] || emotionColors['neutral'];
        targetColor.setHex(emotionColorHex);
        
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
        
        // 根据音高影响点光源
        pointLight1.intensity = 0.3 + pitchNormalized * 0.3;
        pointLight2.intensity = 0.3 + (1 - pitchNormalized) * 0.3;
        
    } catch (error) {
        console.error('Error parsing WebSocket data:', error);
    }
};

// --- 动画循环 ---
let time = 0;
function animate() {
    requestAnimationFrame(animate);
    time += 0.006;
    
    // 平滑颜色过渡
    currentColor.lerp(targetColor, 0.04);
    
    // 更新主花朵颜色（平滑过渡）
    mainFlower.petalMeshes.forEach(petal => {
        if (petal.material) {
            petal.material.color.lerp(currentColor, 0.08);
        }
    });
    
    // 更新主花朵
    const targetScaleVec = new THREE.Vector3(targetScale, targetScale, targetScale);
    mainFlower.group.scale.lerp(targetScaleVec, 0.06);
    mainFlower.group.rotation.z = THREE.MathUtils.lerp(
        mainFlower.group.rotation.z,
        targetRotation,
        0.06
    );
    
    // 花瓣自然摆动
    mainFlower.petals.rotation.y = Math.sin(time * 1.2) * 0.06;
    mainFlower.petals.rotation.x = Math.cos(time * 1.0) * 0.04;
    
    // 花心脉动
    const pulse = Math.sin(time * 1.8) * 0.08 + 1;
    mainFlower.center.scale.set(pulse, pulse, pulse);
    
    // 更新其他花朵
    flowers.forEach((flower, index) => {
        if (flower !== mainFlower) {
            flower.group.scale.lerp(
                new THREE.Vector3(flower.targetScale, flower.targetScale, flower.targetScale),
                0.03
            );
            flower.group.rotation.y = Math.sin(time * 1.0 + index * 0.5) * 0.06;
            flower.petals.rotation.y = Math.sin(time * 1.2 + index * 0.7) * 0.08;
            
            const pulse = Math.sin(time * 1.8 + index) * 0.06 + 1;
            flower.center.scale.set(pulse, pulse, pulse);
        }
    });
    
    // 旋转粒子
    particles.rotation.y += 0.0003;
    
    // 旋转点光源位置
    pointLight1.position.x = Math.cos(time * 0.25) * 6;
    pointLight1.position.z = Math.sin(time * 0.25) * 6;
    pointLight2.position.x = Math.cos(time * 0.25 + Math.PI) * 6;
    pointLight2.position.z = Math.sin(time * 0.25 + Math.PI) * 6;
    
    // 轻微旋转相机
    camera.position.x = Math.sin(time * 0.06) * 1.2;
    camera.position.y = 6 + Math.sin(time * 0.04) * 0.4;
    camera.lookAt(0, 0, 0);
    
    // 使用 composer 渲染（带后处理效果）
    composer.render();
}

// 处理窗口大小变化
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// 启动动画循环
animate();
