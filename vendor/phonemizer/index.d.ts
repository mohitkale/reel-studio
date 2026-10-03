export interface Voice {
  name: string;
  identifier: string;
  languages: Array<{ priority: number; name: string }>;
}
export function phonemize(text: string, language?: string): Promise<string[]>;
export function list_voices(language?: string): Promise<Voice[]>;
