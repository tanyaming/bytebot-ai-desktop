import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI, { APIUserAbortError } from 'openai';
import {
  MessageContentBlock,
  MessageContentType,
  TextContentBlock,
  ToolUseContentBlock,
  ToolResultContentBlock,
  ImageContentBlock,
  isUserActionContentBlock,
  isComputerToolUseContentBlock,
  isImageContentBlock,
  ThinkingContentBlock,
} from '@bytebot/shared';
import { Message, Role } from '@prisma/client';
import { proxyTools } from '../proxy/proxy.tools';
import {
  BytebotAgentService,
  BytebotAgentInterrupt,
  BytebotAgentResponse,
} from '../agent/agent.types';

/**
 * Qwen via DashScope OpenAI-compatible endpoint
 * Docs: https://help.aliyun.com/zh/dashscope/developer-reference/compatible-openai-apis
 */
@Injectable()
export class QwenService implements BytebotAgentService {
  private readonly client: OpenAI;
  private readonly logger = new Logger(QwenService.name);

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.get<string>('QWEN_API_KEY');
    const baseURL =
      this.configService.get<string>('QWEN_BASE_URL') ||
      'https://dashscope.aliyuncs.com/compatible-mode/v1';

    if (!apiKey) {
      this.logger.warn(
        'QWEN_API_KEY is not set. QwenService will not work properly.',
      );
    }

    this.client = new OpenAI({ apiKey: apiKey || 'dummy', baseURL });
  }

  async generateMessage(
    systemPrompt: string,
    messages: Message[],
    model: string,
    useTools: boolean = true,
    signal?: AbortSignal,
  ): Promise<BytebotAgentResponse> {
    const chatMessages = this.formatMessagesForChatCompletion(
      systemPrompt,
      messages,
    );
    try {
      const completion = await this.client.chat.completions.create(
        {
          model,
          messages: chatMessages,
          max_tokens: 8192,
          ...(useTools && { tools: proxyTools }),
        },
        { signal },
      );

      const choice = completion.choices[0];
      if (!choice || !choice.message) {
        throw new Error('No valid response from Qwen Chat Completions');
      }

      const contentBlocks = this.formatChatCompletionResponse(choice.message);
      return {
        contentBlocks,
        tokenUsage: {
          inputTokens: completion.usage?.prompt_tokens || 0,
          outputTokens: completion.usage?.completion_tokens || 0,
          totalTokens: completion.usage?.total_tokens || 0,
        },
      };
    } catch (error: any) {
      if (error instanceof APIUserAbortError) {
        this.logger.log('Qwen request aborted');
        throw new BytebotAgentInterrupt();
      }
      this.logger.error(`Qwen error: ${error.message}`, error.stack);
      throw error;
    }
  }

  private formatMessagesForChatCompletion(
    systemPrompt: string,
    messages: Message[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    chatMessages.push({ role: 'system', content: systemPrompt });

    for (const message of messages) {
      const blocks = message.content as MessageContentBlock[];
      if (blocks.every((b) => isUserActionContentBlock(b))) {
        const userActionBlocks = blocks.flatMap((b) => b.content);
        for (const block of userActionBlocks) {
          if (isComputerToolUseContentBlock(block)) {
            chatMessages.push({
              role: 'user',
              content: `User performed action: ${block.name}\n${JSON.stringify(
                block.input,
                null,
                2,
              )}`,
            });
          } else if (isImageContentBlock(block)) {
            chatMessages.push({
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${block.source.media_type};base64,${block.source.data}`,
                    detail: 'high',
                  },
                },
              ],
            });
          }
        }
      } else {
        for (const block of blocks) {
          switch (block.type) {
            case MessageContentType.Text:
              chatMessages.push({
                role: message.role === Role.USER ? 'user' : 'assistant',
                content: block.text,
              });
              break;
            case MessageContentType.Image: {
              const imageBlock = block as ImageContentBlock;
              chatMessages.push({
                role: 'user',
                content: [
                  {
                    type: 'image_url',
                    image_url: {
                      url: `data:${imageBlock.source.media_type};base64,${imageBlock.source.data}`,
                      detail: 'high',
                    },
                  },
                ],
              });
              break;
            }
            case MessageContentType.ToolUse: {
              const toolBlock = block as ToolUseContentBlock;
              chatMessages.push({
                role: 'assistant',
                tool_calls: [
                  {
                    id: toolBlock.id,
                    type: 'function',
                    function: {
                      name: toolBlock.name,
                      arguments: JSON.stringify(toolBlock.input),
                    },
                  },
                ],
              });
              break;
            }
            case MessageContentType.Thinking: {
              const thinkingBlock = block as ThinkingContentBlock;
              const msg: any = { role: 'assistant', content: null };
              msg['reasoning_content'] = thinkingBlock.thinking;
              chatMessages.push(msg);
              break;
            }
            case MessageContentType.ToolResult: {
              const toolResult = block as ToolResultContentBlock;
              // 合并所有tool result内容到一个消息中
              let combinedContent = '';
              let hasImage = false;
              
              toolResult.content.forEach((content) => {
                if (content.type === MessageContentType.Text) {
                  combinedContent += content.text + '\n';
                }
                if (content.type === MessageContentType.Image) {
                  hasImage = true;
                  combinedContent += '[Screenshot provided]\n';
                }
              });
              
              if (combinedContent.trim()) {
                chatMessages.push({
                  role: 'tool',
                  tool_call_id: toolResult.tool_use_id,
                  content: combinedContent.trim(),
                } as any);
              }
              break;
            }
          }
        }
      }
    }

    return chatMessages;
  }

  private formatChatCompletionResponse(
    message: OpenAI.Chat.ChatCompletionMessage,
  ): MessageContentBlock[] {
    const contentBlocks: MessageContentBlock[] = [];
    if (message.content) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: message.content,
      } as TextContentBlock);
    }
    if ((message as any)['reasoning_content']) {
      contentBlocks.push({
        type: MessageContentType.Thinking,
        thinking: (message as any)['reasoning_content'],
        signature: (message as any)['reasoning_content'],
      } as ThinkingContentBlock);
    }
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          let parsedInput = {};
          try {
            parsedInput = JSON.parse(toolCall.function.arguments || '{}');
          } catch (e) {
            this.logger.warn(
              `Failed to parse tool call arguments: ${toolCall.function.arguments}`,
            );
            parsedInput = {};
          }
          contentBlocks.push({
            type: MessageContentType.ToolUse,
            id: toolCall.id,
            name: toolCall.function.name,
            input: parsedInput,
          } as ToolUseContentBlock);
        }
      }
    }
    if ((message as any).refusal) {
      contentBlocks.push({
        type: MessageContentType.Text,
        text: `Refusal: ${(message as any).refusal}`,
      } as TextContentBlock);
    }
    return contentBlocks;
  }
}
