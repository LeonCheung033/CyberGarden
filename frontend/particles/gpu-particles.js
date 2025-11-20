/**
 * GPU Particle System
 * 高性能粒子系统（情绪粒子、蝴蝶轨迹等）
 */

import * as THREE from 'three';

class GPUParticleSystem {
    constructor(count = 10000, scene) {
        this.count = count;
        this.scene = scene;
        this.particles = null;
        this.positions = null;
        this.colors = null;
        this.velocities = null;
        this.lifetimes = null;
        this.init();
    }

    init() {
        const geometry = new THREE.BufferGeometry();
        
        // 位置
        const positions = new Float32Array(this.count * 3);
        const colors = new Float32Array(this.count * 3);
        const sizes = new Float32Array(this.count);
        const velocities = new Float32Array(this.count * 3);
        const lifetimes = new Float32Array(this.count);
        
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            
            // 初始位置（随机分布）
            positions[i3] = (Math.random() - 0.5) * 50;
            positions[i3 + 1] = Math.random() * 15;
            positions[i3 + 2] = (Math.random() - 0.5) * 50;
            
            // 初始颜色（柔和）
            colors[i3] = 0.7 + Math.random() * 0.3;
            colors[i3 + 1] = 0.75 + Math.random() * 0.25;
            colors[i3 + 2] = 0.85 + Math.random() * 0.15;
            
            // 大小
            sizes[i] = Math.random() * 0.1 + 0.05;
            
            // 速度
            velocities[i3] = (Math.random() - 0.5) * 0.02;
            velocities[i3 + 1] = Math.random() * 0.01;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
            
            // 生命周期
            lifetimes[i] = Math.random();
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        // 自定义 Shader Material
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                emotionColor: { value: new THREE.Vector3(1, 1, 1) }
            },
            vertexShader: `
                attribute float size;
                varying vec3 vColor;
                uniform float time;
                
                void main() {
                    vColor = color;
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    gl_PointSize = size * (300.0 / -mvPosition.z);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                uniform vec3 emotionColor;
                
                void main() {
                    float distanceToCenter = distance(gl_PointCoord, vec2(0.5));
                    float alpha = 1.0 - smoothstep(0.0, 0.5, distanceToCenter);
                    vec3 finalColor = mix(vColor, emotionColor, 0.3);
                    gl_FragColor = vec4(finalColor, alpha * 0.6);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.positions = positions;
        this.colors = colors;
        this.velocities = velocities;
        this.lifetimes = lifetimes;
        this.material = material;
        this.geometry = geometry;
        
        this.scene.add(this.particles);
    }

    update(deltaTime, emotionColor = null) {
        if (!this.particles) return;
        
        const time = this.material.uniforms.time.value + deltaTime;
        this.material.uniforms.time.value = time;
        
        if (emotionColor) {
            const color = new THREE.Color(emotionColor);
            this.material.uniforms.emotionColor.value.set(color.r, color.g, color.b);
        }
        
        // 更新粒子位置
        for (let i = 0; i < this.count; i++) {
            const i3 = i * 3;
            
            // 更新位置
            this.positions[i3] += this.velocities[i3];
            this.positions[i3 + 1] += this.velocities[i3 + 1];
            this.positions[i3 + 2] += this.velocities[i3 + 2];
            
            // 边界检查（循环）
            if (this.positions[i3] > 25) this.positions[i3] = -25;
            if (this.positions[i3] < -25) this.positions[i3] = 25;
            if (this.positions[i3 + 1] > 15) this.positions[i3 + 1] = 0;
            if (this.positions[i3 + 1] < 0) this.positions[i3 + 1] = 15;
            if (this.positions[i3 + 2] > 25) this.positions[i3 + 2] = -25;
            if (this.positions[i3 + 2] < -25) this.positions[i3 + 2] = 25;
        }
        
        this.geometry.attributes.position.needsUpdate = true;
    }

    addButterflyTrail(butterflyPosition, color) {
        // 在蝴蝶位置添加轨迹粒子
        const colorObj = new THREE.Color(color);
        
        // 找到生命周期最短的粒子替换
        let minLifetime = 1;
        let minIndex = 0;
        for (let i = 0; i < this.count; i++) {
            if (this.lifetimes[i] < minLifetime) {
                minLifetime = this.lifetimes[i];
                minIndex = i;
            }
        }
        
        const i3 = minIndex * 3;
        this.positions[i3] = butterflyPosition.x + (Math.random() - 0.5) * 0.2;
        this.positions[i3 + 1] = butterflyPosition.y + (Math.random() - 0.5) * 0.2;
        this.positions[i3 + 2] = butterflyPosition.z + (Math.random() - 0.5) * 0.2;
        
        this.colors[i3] = colorObj.r;
        this.colors[i3 + 1] = colorObj.g;
        this.colors[i3 + 2] = colorObj.b;
        
        this.lifetimes[minIndex] = 1.0;
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    setEmotionColor(color) {
        const colorObj = new THREE.Color(color);
        this.material.uniforms.emotionColor.value.set(colorObj.r, colorObj.g, colorObj.b);
    }
}

export { GPUParticleSystem };

