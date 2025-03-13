import { NextApiRequest, NextApiResponse } from 'next';
import { exec } from 'child_process';
import util from 'util';
import axios from 'axios';

const execPromise = util.promisify(exec);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        // 首先检查translation命令是否存在
        try {
            await execPromise('which translation || echo "not found"');

            // 尝试使用macOS自带的translation命令行工具
            try {
                const escapedText = text.replace(/"/g, '\\"').replace(/'/g, "'\\''");
                const command = `echo "${escapedText}" | translation shell --to zh-Hans`;
                const { stdout } = await execPromise(command);

                return res.status(200).json({
                    translation: stdout.trim()
                });
            } catch (translationError) {
                console.error('Translation command failed:', translationError);
                // 自动回退到Google翻译
                return await fallbackToGoogle(text, res);
            }
        } catch (checkError) {
            console.log('Translation command not available, falling back to Google');
            // 如果translation命令不存在，直接回退到Google翻译
            return await fallbackToGoogle(text, res);
        }
    } catch (error) {
        console.error('MAC translation error:', error);
        return res.status(500).json({
            message: 'Translation failed',
            error: error instanceof Error ? error.message : String(error),
            translation: '自动翻译失败，已切换至Google翻译'
        });
    }
}

// 作为备选方案使用Google翻译
async function fallbackToGoogle(text: string, res: NextApiResponse) {
    try {
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
            }
        });

        let translation = '';
        if (response.data && Array.isArray(response.data[0])) {
            translation = response.data[0]
                .filter((item: any) => Array.isArray(item) && item[0])
                .map((item: any[]) => item[0])
                .join('');
        }

        if (!translation) {
            throw new Error('Failed to parse translation result');
        }

        return res.status(200).json({
            translation,
            engine: 'google',
            notice: 'Mac翻译不可用，已自动切换到Google翻译'
        });
    } catch (error) {
        console.error('Google fallback translation error:', error);
        return res.status(500).json({
            message: 'All translation methods failed',
            translation: '所有翻译方法都失败，请尝试其他翻译引擎'
        });
    }
}
