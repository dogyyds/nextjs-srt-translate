import axios from 'axios';
import { TranslationResult, TranslationEngine } from '../types';

// Google翻译
export async function googleTranslate(text: string): Promise<string> {
    try {
        const response = await axios.post('/api/translate/google', { text });
        return response.data.translation;
    } catch (error) {
        console.error('Google translation error:', error);
        throw new Error('Google translation failed');
    }
}

// 批量翻译 - 保留引擎参数方便将来扩展
export async function batchTranslate(texts: string[], engine: TranslationEngine = 'google'): Promise<string[]> {
    try {
        const response = await axios.post('/api/translate/batch', {
            texts,
            engine
        });
        return response.data.translations;
    } catch (error) {
        console.error('Batch translation error:', error);
        throw new Error('Batch translation failed');
    }
}

// 获取可用引擎列表
export function getAvailableEngines(): { id: TranslationEngine, name: string, description: string }[] {
    return [
        {
            id: 'google',
            name: 'Google翻译',
            description: '(默认)'
        },
        // 将来可以轻松添加其他翻译引擎
        // {
        //     id: 'openai', 
        //     name: 'OpenAI翻译', 
        //     description: '使用OpenAI API，翻译质量高但需要API密钥'
        // },
    ];
}
