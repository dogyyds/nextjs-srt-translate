import { nanoid } from 'nanoid';
import { SrtEntry } from '../types';

// 解析SRT文件内容
export function parseSrt(content: string): SrtEntry[] {
    const lines = content.trim().split('\n');
    const entries: SrtEntry[] = [];
    let i = 0;

    while (i < lines.length) {
        // 获取索引号
        const index = parseInt(lines[i], 10);
        if (isNaN(index)) {
            i++;
            continue;
        }

        // 获取时间码
        i++;
        if (i >= lines.length) break;
        const timeCode = lines[i];

        // 获取文本内容
        i++;
        let text = '';
        while (i < lines.length && lines[i].trim() !== '') {
            text += (text ? '\n' : '') + lines[i];
            i++;
        }

        // 添加到条目中
        entries.push({
            id: nanoid(),
            index,
            timeCode,
            text,
        });

        // 跳过空行
        i++;
    }

    return entries;
}

// 生成SRT格式内容
export function generateSrt(entries: SrtEntry[], outputType: 'bilingual' | 'chinese'): string {
    return entries.map((entry) => {
        // 确保有翻译内容，否则使用占位符或原文
        const translation = entry.translation && entry.translation !== '[翻译失败]'
            ? entry.translation
            : (entry.translation === '[翻译失败]' ? '[翻译失败，请重试]' : '');

        const text = outputType === 'bilingual'
            ? `${entry.text}${translation ? '\n' + translation : ''}`
            : (translation || entry.text);  // 如果没有翻译，至少显示原文

        return `${entry.index}\n${entry.timeCode}\n${text}\n`;
    }).join('\n');
}

// 检查一批字幕条目的翻译状态
export function checkTranslationStatus(entries: SrtEntry[]): {
    total: number,
    translated: number,
    failed: number,
    pending: number
} {
    const total = entries.length;
    let translated = 0;
    let failed = 0;
    let pending = 0;

    entries.forEach(entry => {
        if (!entry.translation) {
            pending++;
        } else if (entry.translation === '[翻译失败]' || entry.translation === '[翻译失败，请重试]') {
            failed++;
        } else {
            translated++;
        }
    });

    return { total, translated, failed, pending };
}
