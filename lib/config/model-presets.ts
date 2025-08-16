export interface ModelPreset {
  provider: string
  model: string
  defaultTemperature: number
  systemPromptAddon?: string
}

export const MODEL_PRESETS: ModelPreset[] = [
  {
    provider: 'openai',
    model: 'gpt-4o',
    defaultTemperature: 0.4,
    systemPromptAddon: 'You are GPT-4o. Provide concise yet insightful academic prose.'
  },
  {
    provider: 'openai',
    model: 'gpt-3.5-turbo-0125',
    defaultTemperature: 0.6
  },
  {
    provider: 'anthropic',
    model: 'claude-3-opus-20240229',
    defaultTemperature: 0.3,
    systemPromptAddon: 'You are Claude-3 Opus with deep reasoning capabilities.'
  }
]

export function getPreset(provider: string, model: string) {
  return MODEL_PRESETS.find(p => p.provider === provider && p.model === model)
}
