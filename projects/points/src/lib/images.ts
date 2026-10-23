/**
 * Destination photos. Most are the images Trace's deals feed serves for the
 * same city. Maui, Los Cabos and Bali aren't in the feed, so they use openly
 * licensed Wikimedia Commons photos, credited below and on the trip page.
 * "Banff" uses the feed's Calgary photo (Banff's gateway airport).
 */
const FEED: Record<string, string> = {
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
  "Chicago": "https://www.travelandleisure.com/thmb/wwUPgdpCUuD5sAPFLQf4YasjH0M=/1500x0/filters:no_upscale():max_bytes(150000):strip_icc()/chicago-illinois-CHITG0221-e448062fc5164da0bba639f9857987f6.jpg",
  "Boston": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/86/Bostonstraight.jpg/1280px-Bostonstraight.jpg",
  "Miami": "https://cdn.pixabay.com/photo/2012/06/23/02/25/miami-50556_1280.jpg",
  "Orlando": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Lake_Eola_Park_in_Orlando_01.jpg/1280px-Lake_Eola_Park_in_Orlando_01.jpg",
  "New Orleans": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/ChrisLitherlandBourbonSt.jpg/1280px-ChrisLitherlandBourbonSt.jpg",
  "Nashville": "https://c1.wallpaperflare.com/preview/565/528/856/cityscape-clouds-nashville-public-domain.jpg",
  "Austin": "https://www.bankrate.com/2022/05/18130518/cost-of-living-in-austin-texas.jpg?auto=webp&optimize=high&crop=16:9",
  "Washington, D.C.": "https://images.pexels.com/photos/8181770/pexels-photo-8181770.jpeg?auto=compress&cs=tinysrgb&w=1280",
  "Kauai": "https://www.dripuploads.com/uploads/image_upload/image/4765895/embeddable_85bfbdd7-495c-41b6-8663-214d27d71c27.jpeg",
  "Banff": "https://live.staticflickr.com/7472/27140573725_42320915f7_b.jpg",
  "Mexico City": "https://www.dripuploads.com/uploads/image_upload/image/2884895/embeddable_9907fe52-404d-40a7-bd09-990830b237f5.png",
  "Puerto Vallarta": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/01/Puerto-Vallarta.jpg/1280px-Puerto-Vallarta.jpg",
  "San Juan": "https://live.staticflickr.com/8014/7121404691_4102d8f47c_b.jpg",
  "Punta Cana": "https://www.dripuploads.com/uploads/image_upload/image/2957277/embeddable_c905c860-bd25-4134-971a-b3bab91b441b.png",
  "Aruba": "https://www.dripuploads.com/uploads/image_upload/image/2845105/embeddable_cb90fd1e-3845-490c-8932-910c1e1fb149.png",
  "London": "https://www.dripuploads.com/uploads/image_upload/image/2872586/embeddable_1464348e-bd81-49bd-8b32-6387877bce46.png",
  "Barcelona": "https://www.dripuploads.com/uploads/image_upload/image/2760078/embeddable_1e9d52ea-32c3-4c3d-af29-04039343f472.png",
  "Lisbon": "https://www.dripuploads.com/uploads/image_upload/image/2859332/embeddable_98e44c65-d7c5-43b3-b0ee-1542ec70aac3.png",
  "Amsterdam": "https://live.staticflickr.com/5272/5866586357_cc9a5d3011_b.jpg",
  "Dublin": "https://live.staticflickr.com/7328/13967414850_7909bd0146_b.jpg",
  "Reykjavík": "https://www.dripuploads.com/uploads/image_upload/image/2307502/embeddable_11c191e9-c2c2-4685-976d-aa18dfaffa03.png",
  "Athens": "https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/View_of_the_Acropolis_Athens_%28pixinn.net%29.jpg/1280px-View_of_the_Acropolis_Athens_%28pixinn.net%29.jpg",
  "Osaka": "https://live.staticflickr.com/4305/35929335751_3e7eab587a_b.jpg",
  "Bangkok": "https://www.dripuploads.com/uploads/image_upload/image/2858420/embeddable_19bf2895-3afa-413c-abfe-9420a68e4313.png",
  "Singapore": "https://live.staticflickr.com/8166/7637076872_fcb6fcdaa8_b.jpg",
  "Hong Kong": "https://www.dripuploads.com/uploads/image_upload/image/2858579/embeddable_e58cdd7d-f313-4ac5-b6e8-0432bfffae94.png",
  "Auckland": "https://live.staticflickr.com/65535/49152589687_3eaf2ab58d_b.jpg",
  "Medellín": "https://live.staticflickr.com/393/19938712266_3523cafd02_b.jpg",
  "Buenos Aires": "https://live.staticflickr.com/5049/5269824170_4859863a7b_b.jpg",
  "Dubai": "https://www.dripuploads.com/uploads/image_upload/image/2844815/embeddable_fc887ee2-be80-4635-89a3-8836cece7565.png",
  "Santorini": "https://www.dripuploads.com/uploads/image_upload/image/2862015/embeddable_d3c4dab1-f04c-438b-87ba-eada8b5b9ff4.png",
};

export interface PhotoCredit {
  url: string;
  author: string;
  license: string;
  page: string;
}

export const CREDITED: Record<string, PhotoCredit> = {
  "Maui": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Kaanapali_Beach_Maui_Hawaii_%2844826205585%29.jpg/1280px-Kaanapali_Beach_Maui_Hawaii_%2844826205585%29.jpg", author: "dronepicr", license: "CC BY 2.0", page: "https://commons.wikimedia.org/wiki/File:Kaanapali_Beach_Maui_Hawaii_(44826205585).jpg" },
  "Los Cabos": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/9/97/El_Arco%2C_Cabo_San_Lucas%2C_M%C3%A9xico%2C_2024-12-22%2C_DD_03.jpg/1280px-El_Arco%2C_Cabo_San_Lucas%2C_M%C3%A9xico%2C_2024-12-22%2C_DD_03.jpg", author: "Diego Delso", license: "CC BY-SA 4.0", page: "https://commons.wikimedia.org/wiki/File:El_Arco,_Cabo_San_Lucas,_M%C3%A9xico,_2024-12-22,_DD_03.jpg" },
  "Bali": { url: "https://thumb.wikimedia.org/wikipedia/commons/thumb/8/8a/Rice_terraces%2C_Bali.jpg/1280px-Rice_terraces%2C_Bali.jpg", author: "Vyacheslav Argenberg", license: "CC BY 4.0", page: "https://commons.wikimedia.org/wiki/File:Rice_terraces,_Bali.jpg" },
};

export function photoFor(city: string): string | undefined {
  return CREDITED[city]?.url ?? FEED[city];
}

export function creditFor(city: string): PhotoCredit | undefined {
  return CREDITED[city];
}

/** Hero photos for the landing page, in order. */
export const HERO_CITIES = ["Santorini", "Maui", "Tokyo", "Reykjavík", "Bali", "Paris", "Punta Cana"];

/** A second accent per city, so tiles aren't all the same red. */
const ACCENTS = ["#FF655B", "#FD297B", "#7C3AED", "#0EA5E9", "#14B8A6", "#F97316", "#6366F1"];

export function accentFor(city: string): string {
  let h = 0;
  for (const ch of city) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function fallbackFor(city: string): string {
  const a = accentFor(city);
  return `linear-gradient(135deg, ${a}, #FD297B)`;
}
