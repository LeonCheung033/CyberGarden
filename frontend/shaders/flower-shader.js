/**
 * Flower Shader
 * 自定义 Shader Material 用于花瓣效果
 */

import * as THREE from 'three';

class FlowerShader {
    static getVertexShader() {
        return `
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            
            void main() {
                vPosition = position;
                vNormal = normal;
                vUv = uv;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `;
    }

    static getFragmentShader() {
        return `
            uniform float time;
            uniform vec3 emotionColor;
            uniform float emotionIntensity;
            uniform float bloomIntensity;
            
            varying vec3 vPosition;
            varying vec3 vNormal;
            varying vec2 vUv;
            
            void main() {
                // 基础颜色
                vec3 baseColor = emotionColor;
                
                // 渐变效果（从中心到边缘）
                float gradient = length(vUv - vec2(0.5));
                vec3 color = mix(baseColor, baseColor * 1.2, 1.0 - gradient);
                
                // 边缘发光（Fresnel 效果）
                vec3 viewDirection = normalize(cameraPosition - vPosition);
                float fresnel = pow(1.0 - dot(normalize(vNormal), viewDirection), 2.0);
                vec3 glowColor = emotionColor * bloomIntensity;
                color += fresnel * glowColor * 0.5;
                
                // 脉动效果
                float pulse = sin(time * 2.0 + vPosition.y * 2.0) * 0.1 + 1.0;
                color *= pulse;
                
                // 情绪强度影响
                color = mix(color, color * 1.3, emotionIntensity);
                
                gl_FragColor = vec4(color, 0.95);
            }
        `;
    }

    static createMaterial(emotionColor, emotionIntensity = 0.5) {
        const color = new THREE.Color(emotionColor);
        
        return new THREE.ShaderMaterial({
            vertexShader: this.getVertexShader(),
            fragmentShader: this.getFragmentShader(),
            uniforms: {
                time: { value: 0 },
                emotionColor: { value: new THREE.Vector3(color.r, color.g, color.b) },
                emotionIntensity: { value: emotionIntensity },
                bloomIntensity: { value: 0.3 },
                cameraPosition: { value: new THREE.Vector3() }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
    }

    static updateMaterial(material, time, emotionColor, emotionIntensity, bloomIntensity) {
        if (!material.uniforms) return;
        
        const color = new THREE.Color(emotionColor);
        material.uniforms.time.value = time;
        material.uniforms.emotionColor.value.set(color.r, color.g, color.b);
        material.uniforms.emotionIntensity.value = emotionIntensity;
        material.uniforms.bloomIntensity.value = bloomIntensity;
    }
}

export { FlowerShader };

