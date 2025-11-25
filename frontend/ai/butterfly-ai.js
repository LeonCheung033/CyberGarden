/**
 * Butterfly AI System
 * 控制蝴蝶的智能行为（跟随手势、与花朵互动等）
 */

class ButterflyAI {
    constructor(butterfly, flowers = []) {
        this.butterfly = butterfly;
        this.flowers = flowers;
        this.currentBehavior = 'free_fly';
        this.targetFlower = null;
        this.circleRadius = 2;
        this.circleAngle = 0;
        this.landTimer = 0;
        this.landDuration = 3; // 停在花朵上的持续时间（秒）
    }

    update(deltaTime, handPosition, aiBehavior = null) {
        // 如果收到 AI 推荐的行为，使用 AI 行为
        if (aiBehavior) {
            this.applyAIBehavior(aiBehavior, handPosition);
        } else {
            // 否则使用默认行为逻辑
            this.defaultBehavior(handPosition);
        }

        // 执行当前行为
        this.executeBehavior(deltaTime, handPosition);
    }

    applyAIBehavior(aiBehavior, handPosition) {
        this.currentBehavior = aiBehavior.behavior || 'free_fly';
        
        if (aiBehavior.target_position) {
            const target = aiBehavior.target_position;
            this.butterfly.setTargetPosition(target.x, target.y, target.z);
        }
        
        if (aiBehavior.flight_speed !== undefined) {
            this.flightSpeed = aiBehavior.flight_speed;
        }
        
        if (aiBehavior.wing_flap_frequency !== undefined) {
            this.butterfly.setWingFlapSpeed(aiBehavior.wing_flap_frequency);
        }
        
        if (aiBehavior.interaction_target !== null && aiBehavior.interaction_target !== undefined) {
            this.targetFlower = this.flowers[aiBehavior.interaction_target];
        } else {
            this.targetFlower = null;
        }
    }

    defaultBehavior(handPosition) {
        // 如果有手部位置，优先跟随（支持所有手势类型）
        if (handPosition && handPosition.confidence > 0.5) {
            // 检查是否是手势控制（包括所有新手势类型）
            const isGestureControl = handPosition.isPinching || 
                                   handPosition.gestureType === 'hand_up' ||
                                   handPosition.gestureType === 'hand_down' ||
                                   handPosition.gestureType === 'hand_left' ||
                                   handPosition.gestureType === 'hand_right' ||
                                   handPosition.gestureType === 'hand_center' ||
                                   handPosition.gestureType === 'fast_move' ||
                                   (handPosition.gestureType && handPosition.gestureType.startsWith('stable_'));
            
            if (isGestureControl) {
                this.currentBehavior = 'follow_hand';
                this.butterfly.setTargetPosition(
                    handPosition.x,
                    handPosition.y,
                    handPosition.z || 0
                );
                
                // 根据手势类型调整翅膀扇动速度
                if (handPosition.isFast || handPosition.gestureType === 'fast_move') {
                    this.butterfly.setWingFlapSpeed(1.2); // 快速移动时更快
                    this.flightSpeed = 1.0;
                } else if (handPosition.gestureType && handPosition.gestureType.startsWith('stable_')) {
                    this.butterfly.setWingFlapSpeed(0.5); // 静止时慢速
                    this.flightSpeed = 0.5;
                } else {
                    this.butterfly.setWingFlapSpeed(0.8); // 正常跟随
                    this.flightSpeed = 0.8;
                }
                return;
            }
        }

        // 如果没有手势控制，使用默认行为
        // 如果有目标花朵，围绕飞行
        if (this.targetFlower && this.flowers.length > 0) {
            this.currentBehavior = 'circle_flower';
            this.butterfly.setWingFlapSpeed(0.5);
            this.flightSpeed = 0.4;
            return;
        }

        // 默认自由飞行（确保蝴蝶始终有目标位置）
        this.currentBehavior = 'free_fly';
        this.butterfly.setWingFlapSpeed(0.4);
        this.flightSpeed = 0.3;
        
        // 确保有初始目标位置
        const currentPos = this.butterfly.getPosition();
        if (!this.butterfly.targetPosition || 
            currentPos.distanceTo(this.butterfly.targetPosition) < 0.1) {
            // 如果接近目标或没有目标，设置新目标
            const newTarget = {
                x: (Math.random() - 0.5) * 15,
                y: 1 + Math.random() * 4,
                z: (Math.random() - 0.5) * 15
            };
            this.butterfly.setTargetPosition(newTarget.x, newTarget.y, newTarget.z);
        }
    }

    executeBehavior(deltaTime, handPosition) {
        switch (this.currentBehavior) {
            case 'follow_hand':
                this.followHand(handPosition);
                break;
            case 'circle_flower':
                this.circleFlower(deltaTime);
                break;
            case 'land_on_flower':
                this.landOnFlower(deltaTime);
                break;
            case 'free_fly':
            default:
                this.freeFly(deltaTime);
                break;
        }
    }

    followHand(handPosition) {
        if (handPosition && handPosition.confidence > 0.5) {
            // 持续更新目标位置，确保蝴蝶跟随手部
            this.butterfly.setTargetPosition(
                handPosition.x,
                handPosition.y,
                handPosition.z || 0
            );
            
            // 根据手势类型调整行为
            if (handPosition.isFast || handPosition.gestureType === 'fast_move') {
                this.butterfly.setWingFlapSpeed(1.2);
            } else if (handPosition.gestureType && handPosition.gestureType.startsWith('stable_')) {
                this.butterfly.setWingFlapSpeed(0.5);
            } else {
                this.butterfly.setWingFlapSpeed(0.8);
            }
        }
    }

    circleFlower(deltaTime) {
        if (!this.targetFlower) {
            // 如果没有目标花朵，选择一个
            if (this.flowers.length > 0) {
                this.targetFlower = this.flowers[Math.floor(Math.random() * this.flowers.length)];
            } else {
                this.currentBehavior = 'free_fly';
                return;
            }
        }

        const flowerPos = this.targetFlower.group.position;
        this.circleAngle += deltaTime * 0.5;

        const x = flowerPos.x + Math.cos(this.circleAngle) * this.circleRadius;
        const y = flowerPos.y + 1;
        const z = flowerPos.z + Math.sin(this.circleAngle) * this.circleRadius;

        this.butterfly.setTargetPosition(x, y, z);

        // 偶尔停在花朵上
        if (Math.random() < 0.001) {
            this.currentBehavior = 'land_on_flower';
            this.landTimer = 0;
        }
    }

    landOnFlower(deltaTime) {
        if (!this.targetFlower) {
            this.currentBehavior = 'free_fly';
            return;
        }

        const flowerPos = this.targetFlower.group.position;
        this.butterfly.setTargetPosition(flowerPos.x, flowerPos.y + 2.5, flowerPos.z);
        this.butterfly.setWingFlapSpeed(0.2); // 慢速扇动

        this.landTimer += deltaTime;
        if (this.landTimer > this.landDuration) {
            this.currentBehavior = 'circle_flower';
            this.landTimer = 0;
        }
    }

    freeFly(deltaTime) {
        // 随机飞行
        const butterflyPos = this.butterfly.getPosition();
        
        // 如果接近目标，选择新目标
        const distance = butterflyPos.distanceTo(this.butterfly.targetPosition);
        if (distance < 0.5) {
            const newTarget = {
                x: (Math.random() - 0.5) * 15,
                y: 1 + Math.random() * 4,
                z: (Math.random() - 0.5) * 15
            };
            this.butterfly.setTargetPosition(newTarget.x, newTarget.y, newTarget.z);
        }
    }

    setFlowers(flowers) {
        this.flowers = flowers;
    }

    respondToEmotion(emotion, intensity) {
        // 根据情绪改变蝴蝶颜色和行为
        const emotionColors = {
            'happy': 0xffd89b,
            'sad': 0xa8c8ec,
            'angry': 0xff9a9e,
            'surprise': 0xffb3ba,
            'fear': 0xc7a8d8,
            'disgust': 0xbaffc9,
            'neutral': 0xf5f5dc
        };

        const color = emotionColors[emotion] || emotionColors['neutral'];
        this.butterfly.setColor(color);

        // 根据情绪强度调整飞行速度
        const speed = 0.3 + (intensity / 10) * 0.4;
        this.flightSpeed = speed;
    }
}

export { ButterflyAI };

