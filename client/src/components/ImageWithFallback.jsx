import { useState, useEffect } from 'react';
import { Utensils } from 'lucide-react';
import { getFoodImage } from '../services/imageService';

export const ImageWithFallback = ({ src, query, alt, className }) => {
    const [imgSrc, setImgSrc] = useState(src);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!src && query) {
            getFoodImage(query).then(url => {
                if (url) setImgSrc(url);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [src, query]);

    if (loading) {
        return <div className={`animate-pulse bg-slate-100 flex items-center justify-center ${className}`}>
            <Utensils className="w-6 h-6 text-slate-300" />
        </div>;
    }

    return (
        <img
            src={imgSrc || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80'}
            alt={alt}
            className={className}
            onError={(e) => {
                e.target.onerror = null;
                e.target.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&q=80';
            }}
        />
    );
};
