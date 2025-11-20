/**
 * Butterfly 3D Model
 * 创建蝴蝶 3D 模型和动画
 */

import * as THREE from 'three';

class Butterfly {
    constructor(color = 0xffd89b, position = { x: 0, y: 2, z: 0 }) {
        this.group = new THREE.Group();
        this.color = color;
        this.position = position;
        this.wingFlapSpeed = 0.5;
        this.wingFlapAngle = 0;
        this.targetPosition = new THREE.Vector3(position.x, position.y, position.z);
        this.currentPosition = new THREE.Vector3(position.x, position.y, position.z);
        this.velocity = new THREE.Vector3(0, 0, 0);
        
        this.createButterfly();
        this.group.position.set(position.x, position.y, position.z);
    }

    createButterfly() {
        // 增大整体尺寸 - 使用2.5倍缩放
        const scale = 2.5;
        
        // 身体（细长的椭球体，更大更明显）
        const bodyGeometry = new THREE.CylinderGeometry(0.05 * scale, 0.08 * scale, 0.6 * scale, 12);
        const bodyMaterial = new THREE.MeshStandardMaterial({
            color: 0x4a4a4a,
            roughness: 0.3,
            metalness: 0.2,
            emissive: 0x2a2a2a,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        body.rotation.z = Math.PI / 2;
        body.position.y = 0.3 * scale;
        body.castShadow = true;
        this.group.add(body);
        this.body = body;

        // 头部（更大）
        const headGeometry = new THREE.SphereGeometry(0.08 * scale, 12, 12);
        const headMaterial = new THREE.MeshStandardMaterial({
            color: 0x2a2a2a,
            roughness: 0.2,
            emissive: 0x1a1a1a,
            emissiveIntensity: 0.1
        });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.set(0.3 * scale, 0.3 * scale, 0);
        head.castShadow = true;
        this.group.add(head);

        // 触角（更明显）
        const antennaGeometry = new THREE.CylinderGeometry(0.01 * scale, 0.01 * scale, 0.2 * scale, 6);
        const antennaMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x1a1a1a,
            emissive: 0x0a0a0a,
            emissiveIntensity: 0.1
        });
        
        const leftAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        leftAntenna.position.set(0.25 * scale, 0.4 * scale, -0.04 * scale);
        leftAntenna.rotation.z = -0.3;
        this.group.add(leftAntenna);
        
        const rightAntenna = new THREE.Mesh(antennaGeometry, antennaMaterial);
        rightAntenna.position.set(0.25 * scale, 0.4 * scale, 0.04 * scale);
        rightAntenna.rotation.z = 0.3;
        this.group.add(rightAntenna);

        // 翅膀组
        const wingsGroup = new THREE.Group();
        
        // 上翅膀（更大更明显）
        const upperWingGeometry = new THREE.EllipseCurve(0, 0, 0.4 * scale, 0.5 * scale, 0, Math.PI * 2, false, 0);
        const upperWingPoints = upperWingGeometry.getPoints(48);
        const upperWingShape = new THREE.Shape(upperWingPoints);
        const upperWingGeometry3D = new THREE.ShapeGeometry(upperWingShape);
        
        const upperWingMaterial = new THREE.MeshStandardMaterial({
            color: this.color,
            transparent: true,
            opacity: 0.85,
            side: THREE.DoubleSide,
            roughness: 0.1,
            metalness: 0.2,
            emissive: this.color,
            emissiveIntensity: 0.3
        });

        // 左上翅膀
        const leftUpperWing = new THREE.Mesh(upperWingGeometry3D, upperWingMaterial.clone());
        leftUpperWing.position.set(-0.1 * scale, 0.3 * scale, 0.02 * scale);
        leftUpperWing.rotation.y = -0.2;
        leftUpperWing.castShadow = true;
        wingsGroup.add(leftUpperWing);
        this.leftUpperWing = leftUpperWing;

        // 右上翅膀
        const rightUpperWing = new THREE.Mesh(upperWingGeometry3D, upperWingMaterial.clone());
        rightUpperWing.position.set(-0.1 * scale, 0.3 * scale, -0.02 * scale);
        rightUpperWing.rotation.y = 0.2;
        rightUpperWing.castShadow = true;
        wingsGroup.add(rightUpperWing);
        this.rightUpperWing = rightUpperWing;

        // 下翅膀（稍小但更大）
        const lowerWingGeometry = new THREE.EllipseCurve(0, 0, 0.25 * scale, 0.35 * scale, 0, Math.PI * 2, false, 0);
        const lowerWingPoints = lowerWingGeometry.getPoints(40);
        const lowerWingShape = new THREE.Shape(lowerWingPoints);
        const lowerWingGeometry3D = new THREE.ShapeGeometry(lowerWingShape);
        
        const lowerWingMaterial = upperWingMaterial.clone();
        lowerWingMaterial.opacity = 0.75;

        // 左下翅膀
        const leftLowerWing = new THREE.Mesh(lowerWingGeometry3D, lowerWingMaterial.clone());
        leftLowerWing.position.set(-0.15 * scale, 0.2 * scale, 0.02 * scale);
        leftLowerWing.rotation.y = -0.3;
        leftLowerWing.castShadow = true;
        wingsGroup.add(leftLowerWing);
        this.leftLowerWing = leftLowerWing;

        // 右下翅膀
        const rightLowerWing = new THREE.Mesh(lowerWingGeometry3D, lowerWingMaterial.clone());
        rightLowerWing.position.set(-0.15 * scale, 0.2 * scale, -0.02 * scale);
        rightLowerWing.rotation.y = 0.3;
        rightLowerWing.castShadow = true;
        wingsGroup.add(rightLowerWing);
        this.rightLowerWing = rightLowerWing;

        // 翅膀图案（装饰，更大更明显）
        this.addWingPattern(leftUpperWing, scale);
        this.addWingPattern(rightUpperWing, scale);
        this.addWingPattern(leftLowerWing, scale * 0.7);
        this.addWingPattern(rightLowerWing, scale * 0.7);

        this.group.add(wingsGroup);
        this.wingsGroup = wingsGroup;
    }

    addWingPattern(wing, scale = 1.0) {
        // 添加更明显的翅膀图案
        const patternGeometry = new THREE.CircleGeometry(0.08 * scale, 12);
        const patternMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
        });
        const pattern = new THREE.Mesh(patternGeometry, patternMaterial);
        pattern.position.set(0.1 * scale, 0.1 * scale, 0.001);
        wing.add(pattern);
        
        // 添加小点装饰
        for (let i = 0; i < 3; i++) {
            const dotGeometry = new THREE.CircleGeometry(0.02 * scale, 6);
            const dotMaterial = new THREE.MeshBasicMaterial({
                color: 0xffffaa,
                transparent: true,
                opacity: 0.5
            });
            const dot = new THREE.Mesh(dotGeometry, dotMaterial);
            const angle = (i / 3) * Math.PI * 2;
            dot.position.set(
                0.15 * scale * Math.cos(angle),
                0.15 * scale * Math.sin(angle),
                0.001
            );
            wing.add(dot);
        }
    }

    updateWings(deltaTime) {
        // 翅膀扇动动画
        this.wingFlapAngle += this.wingFlapSpeed * deltaTime * 10;
        const flapAmount = Math.sin(this.wingFlapAngle) * 0.5;

        if (this.leftUpperWing) {
            this.leftUpperWing.rotation.x = flapAmount;
        }
        if (this.rightUpperWing) {
            this.rightUpperWing.rotation.x = -flapAmount;
        }
        if (this.leftLowerWing) {
            this.leftLowerWing.rotation.x = flapAmount * 0.7;
        }
        if (this.rightLowerWing) {
            this.rightLowerWing.rotation.x = -flapAmount * 0.7;
        }
    }

    setTargetPosition(x, y, z) {
        this.targetPosition.set(x, y, z);
    }

    updatePosition(deltaTime, flightSpeed = 0.5) {
        // 平滑移动到目标位置
        const direction = new THREE.Vector3()
            .subVectors(this.targetPosition, this.currentPosition);
        
        const distance = direction.length();
        
        if (distance > 0.01) {
            direction.normalize();
            const moveDistance = flightSpeed * deltaTime * 2;
            
            if (distance < moveDistance) {
                this.currentPosition.copy(this.targetPosition);
            } else {
                this.currentPosition.add(direction.multiplyScalar(moveDistance));
            }
            
            // 更新组位置
            this.group.position.lerp(this.currentPosition, 0.1);
            
            // 朝向移动方向
            if (distance > 0.1) {
                this.group.lookAt(this.targetPosition);
            }
        }
    }

    setWingFlapSpeed(speed) {
        this.wingFlapSpeed = Math.max(0.3, Math.min(1.5, speed));
    }

    setColor(color) {
        this.color = color;
        const colorObj = new THREE.Color(color);
        
        if (this.leftUpperWing) this.leftUpperWing.material.color = colorObj;
        if (this.rightUpperWing) this.rightUpperWing.material.color = colorObj;
        if (this.leftLowerWing) this.leftLowerWing.material.color = colorObj;
        if (this.rightLowerWing) this.rightLowerWing.material.color = colorObj;
    }

    update(deltaTime, flightSpeed = 0.5) {
        this.updateWings(deltaTime);
        this.updatePosition(deltaTime, flightSpeed);
    }

    getPosition() {
        return this.group.position;
    }

    getGroup() {
        return this.group;
    }
}

export { Butterfly };

