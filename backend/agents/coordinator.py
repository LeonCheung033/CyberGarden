"""
Coordinator Agent
协调所有 agents 的工作，整合结果
"""

import asyncio
from typing import Dict, Optional


class CoordinatorAgent:
    """协调者智能体 - 协调所有 agents 的工作"""
    
    def __init__(self, visual_agent, butterfly_agent, env_agent, **kwargs):
        self.name = "Coordinator"
        self.visual_agent = visual_agent
        self.butterfly_agent = butterfly_agent
        self.env_agent = env_agent
    
    async def process_emotion_data(
        self,
        emotion: str,
        emotion_intensity: float,
        audio_features: Dict,
        pose_data: Optional[Dict] = None,
        flower_positions: Optional[list] = None
    ) -> Dict:
        """协调处理情绪数据，返回整合后的结果"""
        
        # 并行调用各个 agents
        tasks = [
            self.visual_agent.recommend_visual_params(emotion, emotion_intensity, pose_data),
            self.butterfly_agent.decide_behavior(emotion, emotion_intensity, pose_data, flower_positions),
            self.env_agent.generate_environment(emotion, emotion_intensity, pose_data.get('motion_level', 0) if pose_data else 0)
        ]
        
        try:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            visual_params = results[0] if not isinstance(results[0], Exception) else None
            butterfly_behavior = results[1] if not isinstance(results[1], Exception) else None
            env_params = results[2] if not isinstance(results[2], Exception) else None
            
            # 整合结果
            return {
                'visual': visual_params,
                'butterfly': butterfly_behavior,
                'environment': env_params,
                'emotion': emotion,
                'emotion_intensity': emotion_intensity,
                'audio': audio_features
            }
        except Exception as e:
            print(f"Error in coordinator: {e}")
            # 返回基础结果
            return {
                'visual': None,
                'butterfly': None,
                'environment': None,
                'emotion': emotion,
                'emotion_intensity': emotion_intensity,
                'audio': audio_features
            }

