/**
 * Gesture Recognizer
 * 识别手势并转换为控制命令
 * 基于 MediaPipe Pose 检测的手腕位置，识别简单易用的手势
 * 
 * 推荐手势（识别成功率高）：
 * 1. 举手 - 手腕在屏幕上方区域（控制蝴蝶向上）
 * 2. 手在中间 - 手腕在屏幕中间区域（控制蝴蝶在中间）
 * 3. 手在下方 - 手腕在屏幕下方区域（控制蝴蝶向下）
 * 4. 手在左侧 - 手腕在屏幕左侧区域（控制蝴蝶向左）
 * 5. 手在右侧 - 手腕在屏幕右侧区域（控制蝴蝶向右）
 * 6. 快速移动 - 手部快速移动（触发特殊效果）
 * 7. 静止 - 手部保持静止（稳定控制）
 */

class GestureRecognizer {
    constructor() {
        this.gestureHistory = [];
        this.historySize = 20; // 增加历史记录以更好地检测移动
        this.movementThreshold = 0.02; // 移动阈值（归一化坐标）
        this.fastMovementThreshold = 0.05; // 快速移动阈值
        this.stableThreshold = 0.01; // 静止阈值
        this.stableTime = 300; // 静止时间（毫秒）
        
        // 屏幕区域划分（归一化坐标）
        this.regions = {
            top: { minY: 0, maxY: 0.4 },
            middle: { minY: 0.4, maxY: 0.6 },
            bottom: { minY: 0.6, maxY: 1.0 },
            left: { minX: 0, maxX: 0.4 },
            center: { minX: 0.4, maxX: 0.6 },
            right: { minX: 0.6, maxX: 1.0 }
        };
        
        this.lastStablePosition = null;
        this.lastStableTime = 0;
    }

    recognize(pose, handPosition) {
        if (!pose || !pose.keypoints || !handPosition) {
            return null;
        }

        // 检查手部置信度
        if (handPosition.confidence < 0.5) {
            return null;
        }

        // 检测手势
        const gesture = this.detectGesture(pose, handPosition);
        
        if (gesture) {
            this.gestureHistory.push({
                gesture: gesture,
                timestamp: Date.now(),
                handPosition: handPosition
            });
            
            if (this.gestureHistory.length > this.historySize) {
                this.gestureHistory.shift();
            }
        }

        return gesture;
    }

    /**
     * 检测手势
     * 基于手腕位置和移动模式
     */
    detectGesture(pose, handPosition) {
        const now = Date.now();
        
        // 1. 检测手部在屏幕的哪个区域
        const region = this.getHandRegion(handPosition);
        
        // 2. 检测移动模式
        const movement = this.detectMovement(handPosition);
        
        // 3. 检测是否静止
        const isStable = this.isStable(handPosition, now);
        
        // 组合手势信息
        const gesture = {
            type: this.determineGestureType(region, movement, isStable),
            region: region,
            movement: movement,
            isStable: isStable,
            handPosition: handPosition,
            timestamp: now
        };
        
        return gesture;
    }

    /**
     * 获取手部所在的屏幕区域
     */
    getHandRegion(handPosition) {
        // 使用归一化坐标（如果可用），否则使用3D坐标转换
        const x = handPosition.normalizedX !== undefined ? handPosition.normalizedX : (handPosition.x / 20 + 0.5);
        const y = handPosition.normalizedY !== undefined ? handPosition.normalizedY : (0.5 - handPosition.y / 15);
        
        let verticalRegion = 'middle';
        let horizontalRegion = 'center';
        
        // 垂直区域
        if (y < this.regions.top.maxY) {
            verticalRegion = 'top';
        } else if (y > this.regions.bottom.minY) {
            verticalRegion = 'bottom';
        }
        
        // 水平区域
        if (x < this.regions.left.maxX) {
            horizontalRegion = 'left';
        } else if (x > this.regions.right.minX) {
            horizontalRegion = 'right';
        }
        
        return {
            vertical: verticalRegion,
            horizontal: horizontalRegion,
            combined: `${verticalRegion}_${horizontalRegion}`
        };
    }

    /**
     * 检测手部移动
     */
    detectMovement(handPosition) {
        if (this.gestureHistory.length < 2) {
            return { speed: 0, direction: 'none', distance: 0 };
        }
        
        // 获取最近的两个位置
        const recent = this.gestureHistory.slice(-5); // 使用最近5个位置
        if (recent.length < 2) {
            return { speed: 0, direction: 'none', distance: 0 };
        }
        
        const last = recent[recent.length - 1];
        const prev = recent[0];
        
        if (!last.handPosition || !prev.handPosition) {
            return { speed: 0, direction: 'none', distance: 0 };
        }
        
        const dx = handPosition.x - prev.handPosition.x;
        const dy = handPosition.y - prev.handPosition.y;
        const dz = handPosition.z - (prev.handPosition.z || 0);
        
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const timeDiff = last.timestamp - prev.timestamp;
        const speed = timeDiff > 0 ? distance / (timeDiff / 1000) : 0; // 单位：归一化坐标/秒
        
        // 计算方向
        let direction = 'none';
        if (distance > this.movementThreshold) {
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            if (Math.abs(dx) > Math.abs(dy)) {
                // 主要是水平移动
                direction = dx > 0 ? 'right' : 'left';
            } else {
                // 主要是垂直移动
                direction = dy > 0 ? 'down' : 'up';
            }
        }
        
        return {
            speed: speed,
            direction: direction,
            distance: distance,
            isFast: speed > this.fastMovementThreshold,
            isMoving: distance > this.movementThreshold
        };
    }

    /**
     * 检测手部是否静止
     */
    isStable(handPosition, now) {
        if (!this.lastStablePosition) {
            this.lastStablePosition = handPosition;
            this.lastStableTime = now;
            return false;
        }
        
        const dx = handPosition.x - this.lastStablePosition.x;
        const dy = handPosition.y - this.lastStablePosition.y;
        const dz = (handPosition.z || 0) - (this.lastStablePosition.z || 0);
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        if (distance < this.stableThreshold) {
            // 位置稳定
            if (now - this.lastStableTime > this.stableTime) {
                return true;
            }
        } else {
            // 位置变化，重置
            this.lastStablePosition = handPosition;
            this.lastStableTime = now;
        }
        
        return false;
    }

    /**
     * 确定手势类型
     */
    determineGestureType(region, movement, isStable) {
        // 快速移动 - 特殊手势
        if (movement.isFast) {
            return 'fast_move';
        }
        
        // 静止状态 - 稳定控制
        if (isStable) {
            return `stable_${region.vertical}`;
        }
        
        // 根据区域确定手势类型
        if (region.vertical === 'top') {
            return 'hand_up';
        } else if (region.vertical === 'bottom') {
            return 'hand_down';
        } else if (region.horizontal === 'left') {
            return 'hand_left';
        } else if (region.horizontal === 'right') {
            return 'hand_right';
        } else {
            return 'hand_center';
        }
    }

    /**
     * 获取最近的手势
     */
    getRecentPinchGesture() {
        if (this.gestureHistory.length === 0) return null;
        return this.gestureHistory[this.gestureHistory.length - 1];
    }

    getRecentGestures(count = 3) {
        return this.gestureHistory.slice(-count);
    }
    
    /**
     * 检查是否正在做某个手势（兼容旧代码）
     */
    isCurrentlyPinching() {
        const recent = this.getRecentPinchGesture();
        if (!recent || !recent.gesture) return false;
        
        // 如果手部在中心区域且静止，认为是"捏合"状态（用于控制蝴蝶）
        return recent.gesture.type === 'hand_center' || 
               recent.gesture.type.startsWith('stable_');
    }
}

export { GestureRecognizer };
