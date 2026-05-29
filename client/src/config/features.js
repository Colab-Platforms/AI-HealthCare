/** Feature flags — set VITE_ENABLE_ALCOHOL_TRACKER=false to hide alcohol tracker UI */
export const features = {
  alcoholTracker: import.meta.env.VITE_ENABLE_ALCOHOL_TRACKER !== 'false',
};
