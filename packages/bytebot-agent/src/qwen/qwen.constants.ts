import { BytebotAgentModel } from '../agent/agent.types';

export const QWEN_MODELS: BytebotAgentModel[] = [
  {
    provider: 'qwen',
    name: 'qwen3-code-1.5b-instruct',
    title: 'Qwen3 Code 1.5B Instruct',
    contextWindow: 131072,
  },
  {
    provider: 'qwen',
    name: 'qwen3-code-7b-instruct',
    title: 'Qwen3 Code 7B Instruct',
    contextWindow: 131072,
  },
  {
    provider: 'qwen',
    name: 'qwen3-code-14b-instruct',
    title: 'Qwen3 Code 14B Instruct',
    contextWindow: 131072,
  },
  {
    provider: 'qwen',
    name: 'qwen3-code-32b-instruct',
    title: 'Qwen3 Code 32B Instruct',
    contextWindow: 131072,
  },
];

// 设置Qwen3 Code 7B为默认模型
export const DEFAULT_MODEL = QWEN_MODELS[1];
