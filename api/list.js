import { list } from '@vercel/blob';

export const config = {
    runtime: 'edge',
};

export default async function handler(request) {
    try {
        const { blobs } = await list();

        // 이미지와 비디오 파일만 필터링 (Vercel Blob은 파일 확장자나 contentType을 제공함)
        const mediaFiles = blobs.filter(blob => {
            const url = blob.url.toLowerCase();
            return url.endsWith('.jpg') ||
                url.endsWith('.jpeg') ||
                url.endsWith('.png') ||
                url.endsWith('.gif') ||
                url.endsWith('.webp') ||
                url.endsWith('.mp4') ||
                url.endsWith('.mov') ||
                url.endsWith('.webm');
        });

        return new Response(JSON.stringify(mediaFiles), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json',
            },
        });
    }
}
