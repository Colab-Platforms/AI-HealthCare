import api from './api';

/**
 * Fetch a high-quality food image using the backend proxy for SerpAPI
 * @param {string} query - The food name/query to search for
 * @returns {Promise<string|null>} - The URL of the first image result or null
 */
export const getFoodImage = async (query) => {
    if (!query) return null;

    // Check cache first but use new v5 prefix to clear random stock photos
    const cacheKey = `food_img_v5_${query.toLowerCase().replace(/\s+/g, '_')}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;

    try {
        // Use backend proxy to avoid CORS and hide API key
        const response = await api.get('nutrition/food-image', {
            params: { foodName: query }
        });

        if (response.data?.success && response.data?.imageUrl) {
            localStorage.setItem(cacheKey, response.data.imageUrl);
            return response.data.imageUrl;
        }
    } catch (error) {
        console.warn(`Backend image proxy failed for: ${query}. Using fallback.`, error.message);
    }

    // Fallback to Free accurate image search if backend fails
    try {
        const cleanQuery = query.replace(/[^a-zA-Z0-9 ]/g, '');
        const fallbackUrl = `https://tse1.mm.bing.net/th?q=${encodeURIComponent(cleanQuery + ' food meal')}&w=500&h=500&c=7&rs=1&p=0`;
        return fallbackUrl;
    } catch (err) {
        return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=500&q=80';
    }
};

export default { getFoodImage };
