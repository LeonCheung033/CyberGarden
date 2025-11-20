/**
 * Gesture Recognizer
 * 识别手势并转换为控制命令
 * 重点：识别食指和拇指捏合手势
 */

class GestureRecognizer {
    constructor() {
        this.gestureHistory = [];
        this.historySize = 10;
        this.pinchThreshold = 0.05; // 捏合距离阈值（归一化坐标）
        this.isPinching = false;
        this.pinchStartTime = 0;
    }

    recognize(pose, handPosition) {
        if (!pose || !pose.keypoints || !handPosition) {
            // 如果没有检测到手部，重置捏合状态
            if (this.isPinching) {
                this.isPinching = false;
                return { type: 'pinch_end', handPosition: null };
            }
            return null;
        }

        // 检测捏合手势
        const pinchGesture = this.detectPinchGesture(pose, handPosition);
        
        if (pinchGesture) {
            this.gestureHistory.push({
                gesture: pinchGesture,
                timestamp: Date.now(),
                handPosition: handPosition
            });
            
            if (this.gestureHistory.length > this.historySize) {
                this.gestureHistory.shift();
            }
        }

        return pinchGesture;
    }

    /**
     * 检测食指和拇指捏合手势
     * 使用 MediaPipe Pose 的关键点：
     * - 左手/右手食指：index_finger_tip
     * - 左手/右手拇指：thumb_tip
     */
    detectPinchGesture(pose, handPosition) {
        if (!pose || !pose.keypoints) {
            return null;
        }

        // MediaPipe Pose 不直接提供手部关键点，我们需要使用手腕位置
        // 作为替代方案，我们可以使用 MediaPipe Hands 或简化检测
        
        // 简化方案：使用手腕位置和手部移动来推断捏合
        // 实际应用中应该使用 MediaPipe Hands 来获取精确的手部关键点
        
        // 这里我们使用一个简化的方法：
        // 如果手部位置稳定且置信度高，假设是捏合状态
        const wasPinching = this.isPinching;
        
        // 检查手部位置稳定性（简化版）
        if (this.gestureHistory.length > 0) {
            const last = this.gestureHistory[this.gestureHistory.length - 1];
            if (last.handPosition && last.timestamp) {
                const timeDiff = Date.now() - last.timestamp;
                if (timeDiff < 200) { // 200ms 内的位置
                    const dx = handPosition.x - last.handPosition.x;
                    const dy = handPosition.y - last.handPosition.y;
                    const dz = handPosition.z - last.handPosition.z;
                    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    
                    // 如果手部移动很小且置信度高，认为是捏合状态
                    if (distance < 0.3 && handPosition.confidence > 0.7) {
                        if (!wasPinching) {
                            this.isPinching = true;
                            this.pinchStartTime = Date.now();
                            return { type: 'pinch_start', handPosition: handPosition };
                        } else {
                            // 持续捏合
                            return { type: 'pinch_hold', handPosition: handPosition };
                        }
                    }
                }
            }
        }
        
        // 如果之前是捏合状态，现在检测到移动或置信度降低，结束捏合
        if (wasPinching) {
            if (handPosition.confidence < 0.5) {
                this.isPinching = false;
                return { type: 'pinch_end', handPosition: null };
            }
            
            // 检查是否有明显移动
            if (this.gestureHistory.length > 0) {
                const last = this.gestureHistory[this.gestureHistory.length - 1];
                if (last.handPosition && last.timestamp) {
                    const timeDiff = Date.now() - last.timestamp;
                    if (timeDiff < 200) {
                        const dx = handPosition.x - last.handPosition.x;
                        const dy = handPosition.y - last.handPosition.y;
                        const dz = handPosition.z - last.handPosition.z;
                        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
                        
                        if (distance > 0.5) {
                            this.isPinching = false;
                            return { type: 'pinch_end', handPosition: null };
                        }
                    }
                }
            }
        }
        
        // 默认状态：如果手部存在但未捏合
        if (handPosition && handPosition.confidence > 0.5) {
            return { type: 'hand_detected', handPosition: handPosition };
        }
        
        return null;
    }

    /**
     * 检查是否正在捏合
     */
    isCurrentlyPinching() {
        return this.isPinching;
    }

    /**
     * 获取最近的捏合手势
     */
    getRecentPinchGesture() {
        if (this.gestureHistory.length === 0) return null;
        return this.gestureHistory[this.gestureHistory.length - 1];
    }

    getRecentGestures(count = 3) {
        return this.gestureHistory.slice(-count);
    }
}

export { GestureRecognizer };

