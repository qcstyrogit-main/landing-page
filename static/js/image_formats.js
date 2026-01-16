(() => {
    const supportsType = (type) => {
        const canvas = document.createElement('canvas');
        if (!canvas.getContext) return false;
        return canvas.toDataURL(type).indexOf(`data:${type}`) === 0;
    };

    const supportsAvif = supportsType('image/avif');
    const supportsWebp = supportsType('image/webp');

    if (!supportsAvif && !supportsWebp) return;

    const getCandidateSrc = (src, ext) => {
        return src.replace(/\.png(\?.*)?$/i, `${ext}$1`);
    };

    document.querySelectorAll('img').forEach((img) => {
        const src = img.getAttribute('src');
        if (!src) return;

        const cleanSrc = src.split('?')[0];
        if (!cleanSrc.toLowerCase().endsWith('.png')) return;

        if (supportsAvif) {
            const avifSrc = getCandidateSrc(src, '.avif');
            img.dataset.originalSrc = src;
            img.src = avifSrc;
            img.addEventListener('error', () => {
                if (supportsWebp) {
                    img.src = getCandidateSrc(src, '.webp');
                } else {
                    img.src = img.dataset.originalSrc || src;
                }
            }, { once: true });
            return;
        }

        const webpSrc = getCandidateSrc(src, '.webp');
        img.dataset.originalSrc = src;
        img.src = webpSrc;
        img.addEventListener('error', () => {
            img.src = img.dataset.originalSrc || src;
        }, { once: true });
    });
})();
