import { defineCollection, z } from "astro:content";

const cues = defineCollection({
  type: "content",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    order: z.number(),
    voice: z.string().optional(),
    rate: z.number().optional(),
  }),
});

export const collections = { cues };
