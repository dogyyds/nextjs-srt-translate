export interface SrtEntry {
    id: string;
    index: number;
    timeCode: string;
    text: string;
    translation?: string;
}

export interface TranslationResult {
    original: string;
    translated: string;
}

// 恢复支持多种引擎类型，为将来扩展做准备
export type TranslationEngine = 'google' | 'openai' | 'azure' | 'custom';
export type OutputType = 'bilingual' | 'chinese';
