/** A measured feed page owns its height, not the photo's aspect ratio. */
export const discoveryPhotoHeight = (width: number, availableHeight?: number) => {
  const preferred = Math.min(Math.max((width - 24) * 1.24, 456), 590);
  return availableHeight && availableHeight > 0 ? availableHeight : preferred;
};
