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
    
    // 加载脚本文件的辅助方法
    loadScript(src) {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }
            
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }

    async init() {
        try {
            console.log('开始初始化姿态检测器（使用本地文件）...');
            
            // 检查全局变量是否已加载（通过 script 标签）
            if (typeof window.tf === 'undefined') {
                throw new Error('TensorFlow.js 未加载，请确保 script 标签已添加到 HTML');
            }
            console.log('✓ TensorFlow.js 已加载');
            
            // 初始化 TensorFlow.js backend
            const tf = window.tf;
            console.log('等待 TensorFlow.js 后端初始化...');
            await tf.ready();
            console.log('✓ TensorFlow.js 后端已就绪');
            
            // 检查可用的后端
            let backends = [];
            try {
                const backendNames = tf.engine().backendNames;
                // backendNames 可能是数组或对象
                if (Array.isArray(backendNames)) {
                    backends = backendNames;
                } else if (typeof backendNames === 'object' && backendNames !== null) {
                    backends = Object.keys(backendNames);
                } else {
                    // 如果无法获取，尝试直接设置后端
                    backends = ['webgl', 'cpu'];
                }
            } catch (e) {
                console.warn('无法获取后端列表，使用默认后端:', e);
                backends = ['webgl', 'cpu'];
            }
            
            console.log('可用的后端:', backends);
            
            // 尝试使用 webgl 后端（更兼容），如果不可用则使用默认后端
            try {
                if (backends.length > 0 && (backends.includes('webgl') || backends.indexOf('webgl') >= 0)) {
                    await tf.setBackend('webgl');
                    await tf.ready();
                    console.log('✓ 使用 WebGL 后端');
                } else {
                    // 尝试设置 webgl，如果失败则使用默认
                    try {
                        await tf.setBackend('webgl');
                        await tf.ready();
                        console.log('✓ 使用 WebGL 后端');
                    } catch (e) {
                        console.log('WebGL 不可用，使用默认后端:', tf.getBackend());
                    }
                }
            } catch (e) {
                console.log('设置后端时出错，使用默认后端:', tf.getBackend(), e);
            }
            
            if (typeof window.poseDetection === 'undefined') {
                throw new Error('Pose Detection 未加载，请确保 script 标签已添加到 HTML');
            }
            console.log('✓ Pose Detection 已加载');
            
            // 使用全局变量
            const poseDetection = window.poseDetection;
            console.log('poseDetection 对象:', poseDetection);
            console.log('poseDetection 的键:', Object.keys(poseDetection || {}));
            
            if (!poseDetection || !poseDetection.SupportedModels) {
                console.error('poseDetection 对象:', poseDetection);
                throw new Error('poseDetection.SupportedModels 未定义，请检查库是否正确加载');
            }
            
            console.log('SupportedModels:', poseDetection.SupportedModels);
            
            // 创建检测器 - 尝试使用 BlazePose 作为备用方案
            let detector = null;
            let error = null;
            
            // 首先尝试 BlazePose (更可靠，不需要外部依赖)
            try {
                console.log('尝试使用 BlazePose 检测器（推荐）...');
                
                // 检查 BlazePose 是否可用
                if (!poseDetection.SupportedModels.BlazePose) {
                    throw new Error('BlazePose 模型不可用');
                }
                
                const model = poseDetection.SupportedModels.BlazePose;
                console.log('BlazePose 模型:', model);
                
                const detectorConfig = {
                    runtime: 'tfjs',
                    modelType: 'full',
                    enableSmoothing: true,
                };
                
                detector = await poseDetection.createDetector(model, detectorConfig);
                console.log('✓ BlazePose 检测器初始化成功');
            } catch (blazeposeError) {
                console.warn('BlazePose 初始化失败，尝试 MediaPipe:', blazeposeError);
                error = blazeposeError;
                
                // 备用方案：使用 MediaPipe
                try {
                    console.log('尝试使用 MediaPipe 检测器...');
                    
                    // 检查 MediaPipe 是否可用
                    if (!poseDetection.SupportedModels.MediaPipe) {
                        throw new Error('MediaPipe 模型不可用');
                    }
                    
                    const model = poseDetection.SupportedModels.MediaPipe;
                    console.log('MediaPipe 模型:', model);
                    
                    // 尝试多个可能的 solutionPath
                    const solutionPaths = [
                        'https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1635989137',
                        'https://cdn.jsdelivr.net/npm/@mediapipe/pose',
                        'https://unpkg.com/@mediapipe/pose@0.5.1635989137',
                    ];
                    
                    let mediapipeDetector = null;
                    let lastError = null;
                    
                    for (const solutionPath of solutionPaths) {
                        try {
                            console.log(`尝试 solutionPath: ${solutionPath}`);
                            const detectorConfig = {
                                runtime: 'mediapipe',
                                solutionPath: solutionPath,
                                modelType: 'full',
                                enableSmoothing: true,
                            };
                            
                            mediapipeDetector = await poseDetection.createDetector(model, detectorConfig);
                            console.log(`✓ MediaPipe 检测器初始化成功 (使用 ${solutionPath})`);
                            break;
                        } catch (pathError) {
                            console.warn(`solutionPath ${solutionPath} 失败:`, pathError);
                            lastError = pathError;
                            continue;
                        }
                    }
                    
                    if (!mediapipeDetector) {
                        throw lastError || new Error('所有 MediaPipe solutionPath 都失败');
                    }
                    
                    detector = mediapipeDetector;
                } catch (mediapipeError) {
                    console.error('MediaPipe 也初始化失败:', mediapipeError);
                    throw new Error(`所有检测器初始化失败。BlazePose: ${blazeposeError.message}, MediaPipe: ${mediapipeError.message}`);
                }
            }
            
            this.detector = detector;
            console.log('✓ Pose detector 初始化成功');
            return true;
        } catch (error) {
            console.error('✗ Error initializing pose detector:', error);
            console.error('错误详情:', {
                name: error.name,
                message: error.message,
                stack: error.stack
            });
            return false;
        }
    }

    async startDetection(videoElement) {
        try {
            if (!this.detector) {
                console.log('检测器未初始化，开始初始化...');
                const initialized = await this.init();
                if (!initialized) {
                    console.error('✗ 检测器初始化失败');
                    return false;
                }
            }

            if (!videoElement) {
                console.error('✗ 视频元素不存在');
                return false;
            }

            this.video = videoElement;
            this.isDetecting = true;
            console.log('✓ 开始姿态检测循环');
            this.detectLoop();
            return true;
        } catch (error) {
            console.error('✗ 启动检测失败:', error);
            return false;
        }
    }
    
    isDetectingActive() {
        return this.isDetecting === true;
    }

    stopDetection() {
        this.isDetecting = false;
    }

    async detectLoop() {
        if (!this.isDetecting || !this.detector || !this.video) {
            if (!this.isDetecting) {
                console.log('检测循环停止：isDetecting = false');
            }
            if (!this.detector) {
                console.log('检测循环停止：detector 不存在');
            }
            if (!this.video) {
                console.log('检测循环停止：video 不存在');
            }
            return;
        }

        try {
            const poses = await this.detector.estimatePoses(this.video, {
                flipHorizontal: false,
                staticImageMode: false,
            });

            if (poses && poses.length > 0) {
                this.currentPose = poses[0];
                this.extractHandPosition(poses[0]);
                this.notifyCallbacks(poses[0], this.handPosition);
            } else {
                this.currentPose = null;
                this.handPosition = null;
                // 即使没有检测到姿态，也通知回调（handPos 为 null）
                this.notifyCallbacks(null, null);
            }
        } catch (error) {
            console.error('Pose detection error in detectLoop:', error);
            // 即使出错也继续循环，避免检测完全停止
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

        // 支持 MediaPipe 和 BlazePose 两种模型
        // MediaPipe: left_wrist, right_wrist
        // BlazePose: left_wrist, right_wrist (相同)
        let leftWrist = pose.keypoints.find(kp => kp.name === 'left_wrist');
        let rightWrist = pose.keypoints.find(kp => kp.name === 'right_wrist');
        
        // 如果找不到，尝试使用索引（BlazePose 可能使用索引）
        if (!leftWrist && pose.keypoints.length > 15) {
            leftWrist = pose.keypoints[15]; // MediaPipe 左手腕索引
        }
        if (!rightWrist && pose.keypoints.length > 16) {
            rightWrist = pose.keypoints[16]; // MediaPipe 右手腕索引
        }

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
            // MediaPipe/BlazePose 返回的坐标是归一化的 (0-1)
            // 将归一化坐标转换为 3D 空间坐标
            // 假设屏幕中心为 (0, 0, 0)，范围映射到花园空间
            const normalizedX = hand.x; // 已经是 0-1
            const normalizedY = hand.y; // 已经是 0-1
            
            // 转换为 3D 空间坐标（-10 到 10 的范围）
            const x = (normalizedX - 0.5) * 20; // -10 到 10
            const y = (0.5 - normalizedY) * 15; // -7.5 到 7.5（翻转Y轴）
            const z = (hand.z || 0) * 10; // 如果有深度信息，使用它

            this.handPosition = {
                x: x,
                y: y + 2, // 提升到花朵高度
                z: z,
                confidence: hand.score,
                // 保存归一化坐标用于手势识别
                normalizedX: normalizedX,
                normalizedY: normalizedY
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

