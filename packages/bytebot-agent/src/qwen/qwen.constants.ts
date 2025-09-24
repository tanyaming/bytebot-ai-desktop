import { BytebotAgentModel } from '../agent/agent.types';

export const QWEN_MODELS: BytebotAgentModel[] = [
  {
    provider: 'qwen',
    name: 'qwen-turbo',
    title: 'Qwen Turbo',
    contextWindow: 8192,
  },
  {
    provider: 'qwen',
    name: 'qwen-plus',
    title: 'Qwen Plus',
    contextWindow: 32768,
  },
  {
    provider: 'qwen',
    name: 'qwen-max',
    title: 'Qwen Max',
    contextWindow: 131072,
  },
  {
    provider: 'qwen',
    name: 'qwen-max-longcontext',
    title: 'Qwen Max Long Context',
    contextWindow: 131072,
  },
];

// 设置Qwen Turbo为默认模型
export const DEFAULT_MODEL = QWEN_MODELS[0];
