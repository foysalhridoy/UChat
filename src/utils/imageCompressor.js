/**
 * Compresses an image file client-side using HTML5 Canvas.
 * Produces both an optimized Blob and a base64 Data URL.
 * Max dimension: 1280px, JPEG quality: 0.8
 */
export function compressImage(file, maxDimension = 1280, quality = 0.8) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) {
      return reject(new Error('Invalid image file'));
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));

    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image element'));

      img.onload = () => {
        let { width, height } = img;

        // Calculate scaled dimensions keeping aspect ratio
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Failed to create canvas context'));
        }

        // Draw and compress
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              return reject(new Error('Canvas blob conversion failed'));
            }
            resolve({
              blob,
              dataUrl,
              width,
              height,
              size: blob.size,
              name: file.name.replace(/\.[^/.]+$/, '.jpg')
            });
          },
          'image/jpeg',
          quality
        );
      };

      img.src = e.target.result;
    };

    reader.readAsDataURL(file);
  });
}
