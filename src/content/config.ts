import { defineCollection, z } from "astro:content";

const cues = defineCollection({
  type: "content",
  schema: z.object({
    id: z.string(),
    title: z.string(),
    order: z.number(),
    voice: z.string().default("it"),
    rate: z.number().default(1.0),
  }),
});

export const collections = { cues };
