import { defineCollection } from "astro:content";
import { z } from "astro/zod";
import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.date(),
    updated: z.date().optional(),
    tags: z.array(z.string()).default([]),
    category: z.string().optional(),
    cover: z.string().optional(),
    draft: z.boolean().optional().default(false)
  })
});

const pages = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.date().optional(),
    cover: z.string().optional(),
    order: z.number().optional(),
    // Exhibits for the anchors gallery. Each image carries its own track, so
    // switching the main image also switches the music.
    gallery: z.array(z.object({
      image: z.string(),
      audio: z.string(),
      track: z.string(),
      title: z.string(),
      note: z.string().optional()
    })).optional()
  })
});

export const collections = { posts, pages };
