import type { CategoryDef } from './types';

/**
 * Built-in categories. Prompts are what the image model compares photos against; several per
 * category are averaged, which is more robust than any single description.
 * `needsModel` categories are only scored once the CLIP model is available.
 */
export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'screenshots',
    name: 'Screenshots',
    icon: 'device-mobile',
    prompts: [
      'a screenshot of a phone screen',
      'a screenshot of a mobile app',
      'a screenshot of a chat conversation',
      'a screenshot of a social media post',
      'a screenshot of a computer screen',
      'a screenshot of a website',
    ],
    needsModel: false,
  },
  {
    id: 'shopping',
    name: 'Shopping and product ads',
    icon: 'shopping-bag',
    prompts: [
      'a screenshot of an online shopping website',
      'a product listing with a price',
      'an advertisement for a product',
      'a product photo on a plain white background',
      'a sale banner with discount prices',
    ],
    needsModel: true,
  },
  {
    id: 'memes',
    name: 'Memes and forwarded images',
    icon: 'mood-smile',
    prompts: [
      'a meme',
      'a funny meme with caption text',
      'a cartoon or comic',
      'an image with big text on top of a picture',
      'a motivational quote image',
    ],
    needsModel: true,
  },
  {
    id: 'documents',
    name: 'Receipts and documents',
    icon: 'receipt',
    prompts: [
      'a photo of a receipt',
      'a photo of a paper document',
      'a scanned document',
      'a photo of an invoice or bill',
      'a photo of a printed form',
    ],
    needsModel: true,
  },
  {
    id: 'notes',
    name: 'Whiteboards and notes',
    icon: 'notes',
    prompts: [
      'a photo of a whiteboard',
      'a photo of handwritten notes',
      'a photo of a presentation slide on a screen',
      'a photo of a notebook page',
    ],
    needsModel: true,
  },
];

/**
 * Everyday photos that should never be suggested. They compete with the categories above, so a
 * photo is only flagged when it looks more like clutter than like a memory.
 */
export const KEEP_PROMPTS: readonly string[] = [
  'a photo of people',
  'a group photo of friends',
  'a selfie',
  'a photo of a child',
  'a family photo',
  'a wedding photo',
  'a landscape photo',
  'a photo of nature',
  'a photo of the sky',
  'a photo of a pet',
  'a photo of food',
  'a travel photo',
  'a photo of a city street',
  'a photo of a building',
  'an abstract colorful image',
];

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
