import type { CategoryDef } from './types';

/** Built-in categories. Only those with `needsModel: false` are scored before CLIP lands. */
export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: 'screenshots',
    name: 'Screenshots',
    icon: 'device-mobile',
    prompts: ['a screenshot of a phone screen', 'a screenshot of a computer screen'],
    needsModel: false,
  },
  {
    id: 'shopping',
    name: 'Shopping and product ads',
    icon: 'shopping-bag',
    prompts: [
      'a screenshot of an online shopping website',
      'a product listing with a price and an add-to-cart button',
      'an advertisement for a product',
      'a screenshot of a social media ad',
    ],
    needsModel: true,
  },
  {
    id: 'memes',
    name: 'Memes and forwarded images',
    icon: 'mood-smile',
    prompts: ['a meme with text on top of an image', 'a forwarded chat image'],
    needsModel: true,
  },
  {
    id: 'documents',
    name: 'Receipts and documents',
    icon: 'receipt',
    prompts: ['a photo of a paper receipt', 'a photo of a printed document'],
    needsModel: true,
  },
  {
    id: 'notes',
    name: 'Whiteboards and notes',
    icon: 'notes',
    prompts: ['a photo of a whiteboard', 'a photo of handwritten notes'],
    needsModel: true,
  },
];

export function categoryById(id: string): CategoryDef | undefined {
  return CATEGORIES.find((c) => c.id === id);
}
