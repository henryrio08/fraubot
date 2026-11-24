import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const chatRooms = sqliteTable("chat_rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  createdBy: text("created_by").notNull(),
  createdAt: integer("created_at").notNull(),
  expiresAt: integer("expires_at").notNull(),
}, table => [index("chat_rooms_expiry").on(table.expiresAt), index("chat_rooms_creator").on(table.createdBy)]);

export const chatMembers = sqliteTable("chat_members", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull(),
  nickname: text("nickname").notNull(),
  nicknameKey: text("nickname_key").notNull(),
  active: integer("active").notNull().default(1),
  joinedAt: integer("joined_at").notNull(),
}, table => [uniqueIndex("chat_members_user").on(table.roomId, table.userId)]);

export const chatMessages = sqliteTable("chat_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  roomId: text("room_id").notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
  memberId: text("member_id").notNull().references(() => chatMembers.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  nickname: text("nickname").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [
  index("chat_messages_room").on(table.roomId, table.id),
  index("chat_messages_sender_time").on(table.memberId, table.createdAt),
  uniqueIndex("chat_messages_retry").on(table.roomId, table.memberId, table.clientId),
]);

// The public class channel is separate from all previously private rooms.
export const classProfiles = sqliteTable("class_profiles", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  nickname: text("nickname").notNull(),
  nicknameKey: text("nickname_key").notNull().unique(),
});
export const classMessages = sqliteTable("class_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  memberId: text("member_id").notNull().references(() => classProfiles.id, { onDelete: "cascade" }),
  clientId: text("client_id").notNull(),
  nickname: text("nickname").notNull(),
  text: text("text").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [
  index("class_messages_time").on(table.createdAt),
  index("class_messages_sender_time").on(table.memberId, table.createdAt),
  uniqueIndex("class_messages_retry").on(table.memberId, table.clientId),
]);
export const aiUsage = sqliteTable("ai_usage", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  day: text("day").notNull(),
  kind: text("kind").notNull(),
  createdAt: integer("created_at").notNull(),
}, table => [index("ai_usage_day_kind_user").on(table.day, table.kind, table.userId)]);
