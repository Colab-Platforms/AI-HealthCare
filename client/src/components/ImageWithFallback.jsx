import { Utensils } from 'lucide-react';

/**
 * Food photos are switched off across the app: no stored photo, no scan photo and no name-based
 * lookup is ever shown. Every food tile renders this neutral placeholder. `src`, `query` and `alt`
 * are still accepted so existing callers keep working.
 */
// eslint-disable-next-line no-unused-vars
export const ImageWithFallback = ({ src, query, alt, className }) => (
    <div className={`bg-emerald-50 flex items-center justify-center ${className || ''}`} aria-hidden="true">
        <Utensils className="w-1/3 h-1/3 max-w-10 max-h-10 text-emerald-300" />
    </div>
);
