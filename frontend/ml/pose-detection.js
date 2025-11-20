/**
 * Pose Detection Module
 * 使用 TensorFlow.js MediaPipe Pose 进行实时姿态检测
 */

class PoseDetector {
    constructor() {
        this.detector = null;
        this.video = null;
        this.isDetecting = false;
        this.currentPose = null;
        this.handPosition = null;
        this.callbacks = [];
    }

    async init() {
        try {
            // 动态导入 TensorFlow.js
            const tf = await import('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js');
            const poseDetection = await import('https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection@2.2.0/dist/pose-detection.min.js');
            
            // 创建检测器
            const model = poseDetection.SupportedModels.MediaPipe;
            const detectorConfig = {
                runtime: 'mediapipe',
                solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
                modelType: 'full',
                enableSmoothing: true,
            };
            
            this.detector = await poseDetection.createDetector(model, detectorConfig);
            console.log('Pose detector initialized');
            return true;
        } catch (error) {
            console.error('Error initializing pose detector:', error);
            return false;
        }
    }

    async startDetection(videoElement) {
        if (!this.detector) {
            const initialized = await this.init();
            if (!initialized) return false;
        }

        this.video = videoElement;
        this.isDetecting = true;
        this.detectLoop();
        return true;
    }

    stopDetection() {
        this.isDetecting = false;
    }

    async detectLoop() {
        if (!this.isDetecting || !this.detector || !this.video) return;

        try {
            const poses = await this.detector.estimatePoses(this.video, {
                flipHorizontal: false,
                staticImageMode: false,
            });

            if (poses && poses.length > 0) {
                this.currentPose = poses[0];
                this.extractHandPosition(poses[0]);
                this.notifyCallbacks(poses[0]);
            } else {
                this.currentPose = null;
                this.handPosition = null;
            }
        } catch (error) {
            console.error('Pose detection error:', error);
        }

        // 继续检测循环
        if (this.isDetecting) {
            requestAnimationFrame(() => this.detectLoop());
        }
    }

    extractHandPosition(pose) {
        if (!pose || !pose.keypoints) {
            this.handPosition = null;
            return;
        }

        // MediaPipe Pose 关键点索引
        // 左手腕: 15, 右手腕: 16
        const leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
        const rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');

        // 使用更靠近屏幕的手（z值更小）
        let hand = null;
        if (leftWrist && leftWrist.score > 0.5) {
            hand = leftWrist;
        }
        if (rightWrist && rightWrist.score > 0.5) {
            if (!hand || rightWrist.score > hand.score) {
                hand = rightWrist;
            }
        }

        if (hand) {
            // 将屏幕坐标转换为 3D 空间坐标
            // 假设屏幕中心为 (0, 0, 0)，范围映射到花园空间
            const x = (hand.x / window.innerWidth - 0.5) * 20; // -10 到 10
            const y = (0.5 - hand.y / window.innerHeight) * 15; // -7.5 到 7.5
            const z = 0; // 默认深度

            this.handPosition = {
                x: x,
                y: y + 2, // 提升到花朵高度
                z: z,
                confidence: hand.score
            };
        } else {
            this.handPosition = null;
        }
    }

    onPoseDetected(callback) {
        this.callbacks.push(callback);
    }

    notifyCallbacks(pose) {
        this.callbacks.forEach(callback => {
            try {
                callback(pose, this.handPosition);
            } catch (error) {
                console.error('Callback error:', error);
            }
        });
    }

    getHandPosition() {
        return this.handPosition;
    }

    getCurrentPose() {
        return this.currentPose;
    }
}

export { PoseDetector };

