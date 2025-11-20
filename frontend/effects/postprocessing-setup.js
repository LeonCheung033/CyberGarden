/**
 * Post-processing Setup
 * 使用 postprocessing 库实现高级后处理效果
 */

import { EffectComposer, RenderPass, EffectPass, BloomEffect, SSAOEffect, ChromaticAberrationEffect, ToneMappingEffect, VignetteEffect } from 'postprocessing';

class PostProcessingManager {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = null;
        this.effects = {};
    }

    init() {
        // 创建 composer
        this.composer = new EffectComposer(this.renderer, {
            multisampling: 4,
            frameBufferType: this.renderer.capabilities.isWebGL2 ? 
                THREE.HalfFloatType : THREE.UnsignedByteType
        });

        // 添加渲染通道
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 添加效果
        this.setupEffects();
        
        return this.composer;
    }

    setupEffects() {
        // SSAO (屏幕空间环境光遮蔽)
        const ssaoEffect = new SSAOEffect(this.camera, this.scene, {
            blendFunction: 1, // NORMAL
            samples: 16,
            rings: 7,
            distanceThreshold: 0.4,
            distanceFalloff: 0.5,
            rangeThreshold: 0.03,
            rangeFalloff: 0.02,
            luminanceInfluence: 0.6,
            radius: 0.5,
            scale: 0.5,
            bias: 0.025,
            intensity: 1.0
        });
        this.effects.ssao = ssaoEffect;

        // Bloom (发光效果)
        const bloomEffect = new BloomEffect({
            blendFunction: 1, // NORMAL
            intensity: 0.5,
            luminanceThreshold: 0.85,
            luminanceSmoothing: 0.9,
            mipmapBlur: true
        });
        this.effects.bloom = bloomEffect;

        // 色差效果
        const chromaticAberrationEffect = new ChromaticAberrationEffect({
            offset: [0.0005, 0.0005]
        });
        this.effects.chromaticAberration = chromaticAberrationEffect;

        // 色调映射
        const toneMappingEffect = new ToneMappingEffect({
            mode: 0, // ACES_FILMIC
            resolution: 256,
            whitePoint: 4.0,
            middleGrey: 0.6,
            minLuminance: 0.01,
            averageLuminance: 1.0,
            adaptationRate: 1.0
        });
        this.effects.toneMapping = toneMappingEffect;

        // 暗角效果
        const vignetteEffect = new VignetteEffect({
            eskil: false,
            offset: 0.5,
            darkness: 0.3
        });
        this.effects.vignette = vignetteEffect;

        // 创建效果通道
        const effectPass = new EffectPass(
            this.camera,
            ssaoEffect,
            bloomEffect,
            chromaticAberrationEffect,
            toneMappingEffect,
            vignetteEffect
        );
        
        this.composer.addPass(effectPass);
        this.effectPass = effectPass;
    }

    updateBloom(intensity) {
        if (this.effects.bloom) {
            this.effects.bloom.intensity = intensity;
        }
    }

    updateSSAO(intensity) {
        if (this.effects.ssao) {
            this.effects.ssao.intensity = intensity;
        }
    }

    render() {
        this.composer.render();
    }

    setSize(width, height) {
        this.composer.setSize(width, height);
    }
}

export { PostProcessingManager };

