import { handleUpload } from '@vercel/blob/client';

export const config = {
    maxDuration: 60,
};

export default async function handler(request, response) {
    try {
        const jsonResponse = await handleUpload({
            body: request.body,
            request,
            onBeforeGenerateToken: async (pathname) => {
                return {
                    allowedContentTypes: [
                        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
                        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/mpeg'
                    ],
                    tokenPayload: JSON.stringify({}),
                    // 서버 사이드에서 랜덤 접미사 옵션을 강제합니다.
                    addRandomSuffix: true,
                };
            },
            onUploadCompleted: async ({ blob, tokenPayload }) => {
                console.log('Upload completed:', blob.url);
            },
        });

        return response.status(200).json(jsonResponse);
    } catch (error) {
        return response.status(400).json({ error: error.message });
    }
}