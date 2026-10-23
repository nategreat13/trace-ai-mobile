/**
 * Destination photos, the same ones Trace's deals feed serves for these
 * cities. Cities without a photo in the feed (Maui, Los Cabos, Bali) fall
 * back to a colored tile with the airport code.
 */
const PHOTOS: Record<string, string> = {
  "Tokyo": "https://www.dripuploads.com/uploads/image_upload/image/2696582/embeddable_6ba76abc-9af6-42e4-883c-1f830abeef8b.png",
  "Paris": "https://www.dripuploads.com/uploads/image_upload/image/2750595/embeddable_ce33e13c-352c-400f-b9e7-8a851b4130bf.png",
  "Rome": "https://www.dripuploads.com/uploads/image_upload/image/2845097/embeddable_153fff30-5516-442c-828b-f58c08e353e9.png",
  "Seoul": "https://www.dripuploads.com/uploads/image_upload/image/2952795/embeddable_3e1ab943-55a2-4753-b725-e1737155e658.png",
  "Sydney": "https://www.dripuploads.com/uploads/image_upload/image/2321762/embeddable_06933ac0-a4de-421d-97c4-d91d473040bb.png",
  "New York": "https://www.dripuploads.com/uploads/image_upload/image/2871598/embeddable_2f6817f9-8a66-492d-8697-28204e35725d.png",
  "Honolulu": "https://live.staticflickr.com/7530/16022395537_7565b7ab2c_b.jpg",
  "Cancún": "https://live.staticflickr.com/4591/38614407175_50a43d37ac_b.jpg",
  "Costa Rica": "https://www.dripuploads.com/uploads/image_upload/image/2925459/embeddable_1679bd75-06d1-47f5-b37c-577355f7c617.png",
  "Los Angeles": "https://www.dripuploads.com/uploads/image_upload/image/2762706/embeddable_620ffa68-0fcc-4b28-887d-e9c47c2e532d.png",
  "San Francisco": "https://blogger.tpusa.com/wp-content/uploads/2022/10/image-from-rawpixel-id-5925732-jpeg-1024x683.jpg",
  "Las Vegas": "https://www.dripuploads.com/uploads/image_upload/image/2762693/embeddable_419766bb-7736-472a-87d6-9a1e02cb636a.png",
};

const FALLBACKS = ["#FF655B", "#FD297B", "#F97316", "#F43F5E", "#D97706", "#E84E3A"];

export function photoFor(city: string): string | undefined {
  return PHOTOS[city];
}

export function fallbackFor(city: string): string {
  let h = 0;
  for (const ch of city) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const a = FALLBACKS[h % FALLBACKS.length];
  const b = FALLBACKS[(h + 2) % FALLBACKS.length];
  return `linear-gradient(135deg, ${a}, ${b})`;
}
