/**
 * Zod schemas for chat mock service API routes.
 */

import { z } from "zod";

export const StickerSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  pack_id: z.number().nullable(),
  category: z.enum(["recent", "favorite", "custom"]),
  storage_path: z.string(),
  mime_type: z.enum(["image/gif", "image/png", "image/jpeg", "image/svg+xml"]),
  created_at: z.string(),
  sort_order: z.number(),
});

export const ListStickersQuerySchema = z.object({
  category: z.enum(["recent", "favorite", "custom"]).optional(),
});

export const ListStickersResponseSchema = z.object({
  stickers: z.array(StickerSchema),
});

export const StickerIdParamSchema = z.object({
  id: z.coerce.number().positive(),
});

export const PatchStickerBodySchema = z.object({
  category: z.enum(["recent", "favorite", "custom"]).optional(),
  sort_order: z.number().int().optional(),
});

export const StorePackSchema = z.object({
  id: z.number(),
  title: z.string(),
  provider_name: z.string(),
  previews: z.array(z.object({ filename: z.string(), label: z.string() })),
  acquired: z.boolean(),
});

export const ListStorePacksResponseSchema = z.object({
  packs: z.array(StorePackSchema),
});

export const AcquirePackParamSchema = z.object({
  id: z.coerce.number().positive(),
});

export const ChannelSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  name: z.string(),
  kind: z.enum(["direct", "group", "system"]),
  last_message_preview: z.string().nullable(),
  updated_at: z.string(),
  unread_count: z.number(),
});

export const ListChannelsResponseSchema = z.object({
  channels: z.array(ChannelSchema),
});

export const MessageSchema = z.object({
  id: z.number(),
  channel_id: z.number(),
  sender: z.string(),
  body: z.string(),
  sent_at: z.string(),
  message_kind: z.enum(["chat", "structured_brief", "thread_sync", "sticker"]),
  source_ref: z.string().nullable(),
});

export const ListMessagesResponseSchema = z.object({
  messages: z.array(MessageSchema),
});

export const SendMessageBodySchema = z.object({
  body: z.string().optional(),
  message_kind: z.enum(["chat", "sticker"]).default("chat"),
  sticker_id: z.coerce.number().int().positive().optional(),
});

export const ChannelIdParamSchema = z.object({
  id: z.coerce.number().positive(),
});
