import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { translationCache } from '../../../utils/cache';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { texts, engine = 'google' } = req.body;

        if (!texts || !Array.isArray(texts) || texts.length === 0) {
            return res.status(400).json({ message: 'Texts array is required' });
        }

        if (engine !== 'google') {
            console.log(`Engine ${engine} not supported yet, using Google instead`);
        }

        const translations = await Promise.all(texts.map(async (text, idx) => {
            try {
                const cacheKey = `google:${text}`;
                const cachedTranslation = translationCache.get(cacheKey);

                if (cachedTranslation) {
                    return cachedTranslation;
                }

                const response = await axios.get('https://translate.googleapis.com/translate_a/single', {
                    params: {
                        client: 'gtx',
                        sl: 'en',
                        tl: 'zh-CN',
                        dt: 't',
                        q: text
                    },
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.81 Safari/537.36',
                        'Referer': 'https://translate.google.com/'
                    },
                    timeout: 15000
                });

                let translation = '';
                if (response.data && Array.isArray(response.data[0])) {
                    translation = response.data[0]
                        .filter((item: any) => Array.isArray(item) && item[0])
                        .map((item: any[]) => item[0])
                        .join('');
                }

                if (translation) {
                    translationCache.set(cacheKey, translation);
                }

                return translation || '[翻译失败]';
            } catch (error) {
                console.error(`Google translation error for text ${idx}:`, error);
                return '[翻译失败]';
            }
        }));

        return res.status(200).json({
            translations,
            engine: 'google'
        });
    } catch (error) {
        console.error('Batch translation error:', error);
        return res.status(500).json({
            message: 'Translation failed',
            translations: []
        });
    }
}
