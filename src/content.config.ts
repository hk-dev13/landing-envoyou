import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const changelogItemSchema = z.object({
  title: z.string(),
  description: z.string(),
});

const changelogCollection = defineCollection({
  loader: glob({ pattern: '**/[^_]*.{md,mdx}', base: './src/content/changelog' }),
  schema: z.object({
    version: z.string(),
    date: z.string(),
    publishDate: z.string(), // YYYY-MM-DD for sorting
    color: z.enum(['emerald', 'purple', 'primary']),
    title: z.string(), // Release title
    summary: z.string(), // High-level release summary
    added: z.array(changelogItemSchema).optional(),
    changed: z.array(changelogItemSchema).optional(),
    fixed: z.array(changelogItemSchema).optional(),
    removed: z.array(changelogItemSchema).optional(),
  }),
});

export const collections = {
  changelog: changelogCollection,
};
