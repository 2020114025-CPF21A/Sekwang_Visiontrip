import { list } from '@vercel/blob';

export default async function handler(request, response) {
    try {
        const { blobs } = await list();

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

        return response.status(200).json(mediaFiles);
    } catch (error) {
        return response.status(500).json({ error: error.message });
    }
}
