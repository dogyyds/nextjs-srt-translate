import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { translationCache } from '../../../utils/cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        // 检查缓存
        const cacheKey = `google:${text}`;
        const cachedTranslation = translationCache.get(cacheKey);

        if (cachedTranslation) {
            console.log('Cache hit for:', text.substring(0, 30) + '...');
            return res.status(200).json({
                translation: cachedTranslation,
                engine: 'google',
                cached: true
            });
        }

        console.log(`Google translating: "${text.substring(0, 30)}..."`);

        const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: {
                client: 'gtx',
                sl: 'en',
                tl: 'zh-CN',
                dt: 't',
                q: text
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
                'Referer': 'https://translate.google.com/'
            },
            timeout: 10000 // 10秒超时
        });

        let translation = '';
        if (response.data && Array.isArray(response.data[0])) {
            translation = response.data[0]
                .filter((item: any) => Array.isArray(item) && item[0])
                .map((item: any[]) => item[0])
                .join('');
        }

        if (!translation) {
            throw new Error('Failed to parse Google translation result');
        }

        // 缓存翻译结果
        translationCache.set(cacheKey, translation);

        return res.status(200).json({
            translation,
            engine: 'google'
        });
    } catch (error: any) {
        console.error('Google translation error:', error.message || error);
        return res.status(500).json({
            message: `Google translation failed: ${error.message || 'Unknown error'}`,
            translation: '翻译失败，请稍后重试'
        });
    }
}
