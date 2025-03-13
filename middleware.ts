import { NextRequest, NextResponse } from 'next/server';

// 只保留针对滥用的基本保护，不再对正常使用进行限制
export function middleware(request: NextRequest) {
    // 获取访问路径
    const path = request.nextUrl.pathname;

    // 只对翻译API端点进行极简保护，防止潜在的滥用
    if (path.startsWith('/api/translate')) {
        // 获取用户IP
        const ip = request.ip || request.headers.get('x-forwarded-for') || '127.0.0.1';

        // 可以在这里添加滥用检测逻辑，但暂时不做限制
        // 仅保留响应头最佳实践
        return NextResponse.next({
            headers: {
                'Access-Control-Allow-Origin': '*',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
            }
        });
    }

    // 正常页面访问不做任何限制
    return NextResponse.next();
}

// 仅保留API路径的匹配器
export const config = {
    matcher: ['/api/translate/:path*'],
};
