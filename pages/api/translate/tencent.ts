import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import CryptoJS from 'crypto-js';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const { text } = req.body;

        if (!text) {
            return res.status(400).json({ message: 'Text is required' });
        }

        // 腾讯云翻译API配置
        const secretId = process.env.TENCENT_SECRET_ID || '';
        const secretKey = process.env.TENCENT_SECRET_KEY || '';

        if (!secretId || !secretKey) {
            return res.status(500).json({
                message: 'Translation API credentials not configured',
                translation: '翻译API凭证未配置，请在.env.local中设置TENCENT_SECRET_ID和TENCENT_SECRET_KEY'
            });
        }

        console.log(`Translating with Tencent: "${text.substring(0, 30)}..."`);

        // 构建腾讯云API请求
        try {
            // API请求参数
            const endpoint = 'tmt.tencentcloudapi.com';
            const region = 'ap-guangzhou';
            const action = 'TextTranslate';
            const version = '2018-03-21';
            const timestamp = Math.round(new Date().getTime() / 1000);
            const data = {
                SourceText: text,
                Source: 'en',
                Target: 'zh',
                ProjectId: 0
            };

            // 生成签名
            const payload = {
                Action: action,
                Version: version,
                Timestamp: timestamp,
                Region: region,
                SecretId: secretId,
                ...data
            };

            // 构建请求
            const response = await axios({
                method: 'POST',
                url: `https://${endpoint}`,
                headers: {
                    'Content-Type': 'application/json',
                    'Host': endpoint,
                    'X-TC-Action': action,
                    'X-TC-Region': region,
                    'X-TC-Timestamp': timestamp,
                    'X-TC-Version': version,
                    'Authorization': generateSignature(payload, secretKey, secretId, timestamp, endpoint)
                },
                data: data
            });

            console.log('Tencent API Response:', JSON.stringify(response.data));

            if (!response.data || !response.data.Response || !response.data.Response.TargetText) {
                throw new Error('Invalid response from translation API');
            }

            return res.status(200).json({
                translation: response.data.Response.TargetText
            });
        } catch (apiError: any) {
            console.error('Tencent API Error:', apiError.response?.data || apiError);

            // 提供更详细的错误信息
            const errorDetail = apiError.response?.data?.Response?.Error || {};
            const errorMsg = errorDetail.Message || apiError.message || '未知错误';

            return res.status(500).json({
                message: `Translation API error: ${errorMsg}`,
                translation: `翻译失败: ${errorMsg}`
            });
        }
    } catch (error) {
        console.error('Tencent translation error:', error);
        return res.status(500).json({
            message: 'Translation failed',
            translation: '翻译失败，请检查API配置和网络连接'
        });
    }
}

// 生成腾讯云API签名
function generateSignature(params: any, secretKey: string, secretId: string, timestamp: number, endpoint: string): string {
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

    // 规范请求的查询字符串
    const queryParams = Object.keys(params)
        .sort()
        .map(key => `${key}=${encodeURIComponent(params[key])}`)
        .join('&');

    // 构造规范请求字符串
    const canonicalRequest = [
        'POST',
        '/',
        '',
        'content-type:application/json\nhost:' + endpoint,
        'content-type;host',
        CryptoJS.SHA256(JSON.stringify(params)).toString(CryptoJS.enc.Hex)
    ].join('\n');

    // 构造签名字符串
    const stringToSign = [
        'TC3-HMAC-SHA256',
        timestamp,
        `${date}/${endpoint}/tc3_request`,
        CryptoJS.SHA256(canonicalRequest).toString(CryptoJS.enc.Hex)
    ].join('\n');

    // 计算签名
    const kDate = CryptoJS.HmacSHA256(date, 'TC3' + secretKey);
    const kService = CryptoJS.HmacSHA256(endpoint.split('.')[0], kDate);
    const kSigning = CryptoJS.HmacSHA256('tc3_request', kService);
    const signature = CryptoJS.HmacSHA256(stringToSign, kSigning).toString(CryptoJS.enc.Hex);

    // 拼接 Authorization
    return `TC3-HMAC-SHA256 Credential=${secretId}/${date}/${endpoint.split('.')[0]}/tc3_request, SignedHeaders=content-type;host, Signature=${signature}`;
}
