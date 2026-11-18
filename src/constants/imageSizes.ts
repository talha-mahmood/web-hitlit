export const IMAGE_SIZES = {
  avatar: {
    small: { width: 96, height: 96, quality: 70 },
    medium: { width: 256, height: 256, quality: 80 },
    large: { width: 512, height: 512, quality: 85 },
  },
  venue: {
    card: { width: 480, height: 320, quality: 75 },
    cover: { width: 1200, height: 600, quality: 80 },
    gallery: { width: 1600, height: 1200, quality: 85 },
  },
  game: {
    card: { width: 480, height: 320, quality: 75 },
    cover: { width: 1200, height: 675, quality: 80 },
  },
  group: {
    card: { width: 480, height: 320, quality: 75 },
    cover: { width: 1200, height: 600, quality: 80 },
  },
  event: {
    card: { width: 640, height: 360, quality: 75 },
    cover: { width: 1200, height: 675, quality: 80 },
  },
} as const;

export type ImageSizeVariant = {
  width: number;
  height: number;
  quality: number;
};
