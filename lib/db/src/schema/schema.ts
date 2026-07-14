import { sql, relations } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Tabela de Usuários (Clientes e Admins)
export const users = sqliteTable("users", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  cpf: text("cpf"),
  whatsapp: text("whatsapp"),
  whatsappContactPreference: text("whatsapp_contact_preference", { enum: ["whatsapp", "chat_only"] }).notNull().default("whatsapp"),
  password: text("password").notNull(),
  type: text("type", { enum: ["client", "admin"] }).notNull().default("client"),
  avatar: text("avatar"),
  profileComplete: integer("profile_complete", { mode: "boolean" }).notNull().default(false),
  status: text("status", { enum: ["active", "inactive"] }).notNull().default("active"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Endereços
export const addresses = sqliteTable("addresses", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  userId: text("user_id").references(() => users.id).notNull(),
  zipCode: text("zip_code").notNull(),
  street: text("street").notNull(),
  number: text("number"),
  complement: text("complement"),
  city: text("city").notNull(),
  state: text("state").notNull(),
});

// Tabela de Planos de Assinatura
export const subscriptionPlans = sqliteTable("subscription_plans", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  name: text("name").notNull(),
  price: real("price").notNull(),
  proposalLimit: integer("proposal_limit").notNull().default(10),
  exclusivitySlots: integer("exclusivity_slots").notNull().default(0),
  description: text("description"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Desmanches
export const desmanches = sqliteTable("desmanches", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  companyName: text("company_name").notNull(),
  tradingName: text("trading_name").notNull(),
  cnpj: text("cnpj").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  password: text("password").notNull(),
  responsibleName: text("responsible_name"),
  responsibleCpf: text("responsible_cpf"),
  logo: text("logo"),
  plan: text("plan", { enum: ["monthly"] }).notNull().default("monthly"),
  status: text("status", { enum: ["pending", "active", "inactive", "rejected", "resubmitted"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  vehicleTypes: text("vehicle_types").default("[]"),
  rating: real("rating").notNull().default(0),
  salesCount: integer("sales_count").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Cobrança dos Desmanches
export const desmancheBilling = sqliteTable("desmanche_billing", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull().unique(),
  billingModel: text("billing_model", { enum: ["subscription", "per_transaction", "monthly_cycle"] }).notNull().default("monthly_cycle"),
  planId: text("plan_id").references(() => subscriptionPlans.id),
  monthlyTransactionCount: integer("monthly_transaction_count").notNull().default(0),
  monthlyAmountPaid: real("monthly_amount_paid").notNull().default(0),
  currentPeriodStart: integer("current_period_start").notNull().default(0),
  asaasCustomerId: text("asaas_customer_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Transações de Cobrança
export const billingTransactions = sqliteTable("billing_transactions", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  // Runtime SQLite keeps this optional and currently has no FK. Do not declare
  // the old, incorrect desmanches.id reference here.
  negotiationId: text("negotiation_id"),
  amount: real("amount").notNull(),
  status: text("status", { enum: ["pending", "paid", "failed", "exempt", "billed"] }).notNull().default("pending"),
  type: text("type", { enum: ["per_transaction", "subscription", "monthly_cycle"] }).notNull().default("monthly_cycle"),
  asaasChargeId: text("asaas_charge_id"),
  asaasCreationIntentId: text("asaas_creation_intent_id"),
  asaasDueDate: text("asaas_due_date"),
  paymentLink: text("payment_link"),
  description: text("description"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  paidAt: integer("paid_at", { mode: "timestamp" }),
});

// Intenções locais para criação idempotente de recursos no Asaas. O schema SQL
// efetivo, incluindo CHECKs e índices, é aplicado pelo runtime do API server.
export const asaasCreationIntents = sqliteTable("asaas_creation_intents", {
  intentId: text("intent_id").primaryKey(),
  resourceType: text("resource_type", { enum: ["customer", "payment", "subscription"] }).notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  operationKey: text("operation_key").notNull(),
  externalReference: text("external_reference").notNull().unique(),
  status: text("status", { enum: ["pending", "creating", "created", "ambiguous", "failed"] }).notNull(),
  asaasResourceId: text("asaas_resource_id"),
  parameterHash: text("parameter_hash").notNull(),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: integer("lease_expires_at"),
  lastErrorCode: text("last_error_code"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// Eventos recebidos do webhook Asaas. O payload integral não é persistido.
export const asaasWebhookEvents = sqliteTable("asaas_webhook_events", {
  eventId: text("event_id").primaryKey(),
  eventType: text("event_type").notNull(),
  paymentId: text("payment_id"),
  payloadHash: text("payload_hash").notNull(),
  status: text("status", { enum: ["processed", "ignored"] }).notNull(),
  receivedAt: integer("received_at", { mode: "timestamp" }).notNull(),
  processedAt: integer("processed_at", { mode: "timestamp" }).notNull(),
});

// Tabela de Configurações do Sistema
export const systemSettings = sqliteTable("system_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Endereços dos Desmanches
export const desmancheAddresses = sqliteTable("desmanche_addresses", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  zipCode: text("zip_code").notNull(),
  street: text("street").notNull(),
  number: text("number"),
  complement: text("complement"),
  city: text("city").notNull(),
  state: text("state").notNull(),
});

// Tabela de Documentos dos Desmanches
export const documents = sqliteTable("documents", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  type: text("type", { enum: ["alvara", "credenciamento_detran", "contrato_social", "documento_responsavel", "documento_empresa"] }).notNull(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  validUntil: integer("valid_until", { mode: "timestamp" }),
  status: text("status", { enum: ["valid", "expiring", "expired", "pending"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Pedidos (container/envelope)
export const orders = sqliteTable("orders", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  vehicleType: text("vehicle_type"),
  vehicleBrand: text("vehicle_brand").notNull(),
  vehicleModel: text("vehicle_model").notNull(),
  vehicleYear: integer("vehicle_year").notNull(),
  vehiclePlate: text("vehicle_plate"),
  vehicleColor: text("vehicle_color"),
  vehicleEngine: text("vehicle_engine"),
  partCategory: text("part_category"),
  partName: text("part_name"),
  partPosition: text("part_position"),
  partConditionAccepted: text("part_condition_accepted").default("any"),
  city: text("city"),
  state: text("state"),
  clientId: text("client_id").references(() => users.id),
  desmancheId: text("desmanche_id").references(() => desmanches.id),
  postedByType: text("posted_by_type", { enum: ["client", "desmanche"] }).notNull().default("client"),
  location: text("location").notNull(),
  status: text("status", { enum: ["open", "negotiating", "closed", "shipped", "completed", "cancelled", "expired"] }).notNull().default("open"),
  urgency: text("urgency", { enum: ["normal", "urgent"] }).notNull().default("normal"),
  isPartnerRequest: integer("is_partner_request", { mode: "boolean" }).notNull().default(false),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// ─── NOVO: Itens do Pedido ─────────────────────────────────────────────────────
// Cada pedido pode ter múltiplos itens (peças de diferentes tipos de veículo).
// Propostas, negociações e imagens se vinculam ao item, não ao pedido.
export const orderItems = sqliteTable("order_items", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  orderId: text("order_id").references(() => orders.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  vehicleType: text("vehicle_type"),
  vehicleBrand: text("vehicle_brand"),
  vehicleModel: text("vehicle_model"),
  vehicleYear: integer("vehicle_year"),
  vehiclePlate: text("vehicle_plate"),
  vehicleColor: text("vehicle_color"),
  vehicleEngine: text("vehicle_engine"),
  partCategory: text("part_category"),
  partName: text("part_name"),
  partPosition: text("part_position"),
  partConditionAccepted: text("part_condition_accepted").default("any"),
  status: text("status", { enum: ["open", "has_proposals", "negotiating", "completed", "archived", "expired"] }).notNull().default("open"),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Imagens dos Pedidos (vinculadas ao item, quando disponível)
export const orderImages = sqliteTable("order_images", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  orderId: text("order_id").references(() => orders.id).notNull(),
  orderItemId: text("order_item_id").references(() => orderItems.id),
  url: text("url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Propostas (vinculadas ao item específico)
export const proposals = sqliteTable("proposals", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  orderId: text("order_id").references(() => orders.id).notNull(),
  orderItemId: text("order_item_id").references(() => orderItems.id),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  price: real("price").notNull(),
  message: text("message").notNull(),
  status: text("status", { enum: ["sent", "accepted", "rejected", "withdrawn", "revision_requested"] }).notNull().default("sent"),
  whatsappUnlocked: integer("whatsapp_unlocked", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Negociações (vinculadas ao item específico)
export const negotiations = sqliteTable("negotiations", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  orderId: text("order_id").references(() => orders.id).notNull(),
  orderItemId: text("order_item_id").references(() => orderItems.id),
  proposalId: text("proposal_id").references(() => proposals.id).notNull(),
  clientId: text("client_id").references(() => users.id).notNull(),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  price: real("price").notNull(),
  status: text("status", { enum: ["negotiating", "paid", "shipped", "delivered", "awaiting_review", "completed", "cancelled", "stale_awaiting_desmanche", "stale_awaiting_client", "in_moderation"] }).notNull().default("negotiating"),
  trackingCode: text("tracking_code"),
  receivedAt: integer("received_at", { mode: "timestamp" }),
  reviewDeadlineAt: integer("review_deadline_at", { mode: "timestamp" }),
  staleCheckAt: integer("stale_check_at", { mode: "timestamp" }),
  desmanchemResponse: text("desmanche_response"),
  clientResponse: text("client_response"),
  resolvedByAdminId: text("resolved_by_admin_id").references(() => users.id),
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Leilões
export const auctions = sqliteTable("auctions", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  title: text("title").notNull(),
  source: text("source").notNull(),
  lotCount: integer("lot_count").notNull(),
  estimatedValue: real("estimated_value").notNull(),
  endTime: integer("end_time", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["live", "upcoming", "ended"] }).notNull().default("upcoming"),
  url: text("url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Faturas
export const invoices = sqliteTable("invoices", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  month: text("month").notNull(),
  description: text("description").notNull(),
  amount: real("amount").notNull(),
  dueDate: integer("due_date", { mode: "timestamp" }).notNull(),
  status: text("status", { enum: ["paid", "pending", "overdue"] }).notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Avaliações
export const reviews = sqliteTable("reviews", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  negotiationId: text("negotiation_id").references(() => negotiations.id).notNull(),
  clientId: text("client_id").references(() => users.id).notNull(),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  rating: integer("rating").notNull(),
  comment: text("comment"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Salas de Chat
export const chatRooms = sqliteTable("chat_rooms", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  proposalId: text("proposal_id").references(() => proposals.id).notNull().unique(),
  orderId: text("order_id").references(() => orders.id).notNull(),
  clientId: text("client_id").references(() => users.id).notNull(),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  lastMessageAt: integer("last_message_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Mensagens de Chat
export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  roomId: text("room_id").references(() => chatRooms.id).notNull(),
  senderId: text("sender_id").notNull(),
  senderType: text("sender_type", { enum: ["client", "desmanche"] }).notNull(),
  content: text("content").notNull(),
  readAt: integer("read_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Salas de Chat Pré-Proposta (conversa antes de enviar proposta)
export const preProposalRooms = sqliteTable("pre_proposal_rooms", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  orderId: text("order_id").references(() => orders.id).notNull(),
  orderItemId: text("order_item_id"),
  clientId: text("client_id").references(() => users.id).notNull(),
  desmancheId: text("desmanche_id").references(() => desmanches.id).notNull(),
  lastMessageAt: integer("last_message_at"),
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
});

// Tabela de Mensagens Pré-Proposta
export const preProposalMessages = sqliteTable("pre_proposal_messages", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  roomId: text("room_id").references(() => preProposalRooms.id).notNull(),
  senderId: text("sender_id").notNull(),
  senderType: text("sender_type", { enum: ["client", "desmanche"] }).notNull(),
  content: text("content").notNull(),
  readAt: integer("read_at"),
  createdAt: integer("created_at").notNull().default(sql`(strftime('%s', 'now'))`),
});

// ─── Schemas de Inserção ──────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).pick({
  name: true, email: true, phone: true, cpf: true, password: true, type: true,
});

export const insertDesmancheSchema = createInsertSchema(desmanches).pick({
  companyName: true, tradingName: true, cnpj: true, email: true, phone: true,
  password: true, plan: true, responsibleName: true, responsibleCpf: true,
});

export const insertOrderSchema = createInsertSchema(orders).pick({
  title: true, description: true, vehicleType: true, vehicleBrand: true,
  vehicleModel: true, vehicleYear: true, vehiclePlate: true, vehicleColor: true,
  vehicleEngine: true, partCategory: true, partName: true, partPosition: true,
  partConditionAccepted: true, city: true, state: true, location: true,
  urgency: true, isPartnerRequest: true, postedByType: true,
});

export const insertOrderItemSchema = createInsertSchema(orderItems).pick({
  orderId: true, title: true, description: true, vehicleType: true,
  vehicleBrand: true, vehicleModel: true, vehicleYear: true, vehiclePlate: true,
  vehicleColor: true, vehicleEngine: true, partCategory: true, partName: true,
  partPosition: true, partConditionAccepted: true,
});

export const insertProposalSchema = createInsertSchema(proposals).pick({
  orderId: true, orderItemId: true, desmancheId: true, price: true, message: true,
});

export const insertDocumentSchema = createInsertSchema(documents).pick({
  desmancheId: true, type: true, name: true, url: true, validUntil: true,
});

export const insertAuctionSchema = createInsertSchema(auctions).pick({
  title: true, source: true, lotCount: true, estimatedValue: true,
  endTime: true, status: true, url: true,
});

export const insertInvoiceSchema = createInsertSchema(invoices).pick({
  desmancheId: true, month: true, description: true, amount: true, dueDate: true,
});

export const insertReviewSchema = createInsertSchema(reviews).pick({
  negotiationId: true, clientId: true, desmancheId: true, rating: true, comment: true,
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans).pick({
  name: true, price: true, proposalLimit: true, exclusivitySlots: true,
  description: true, active: true,
});

// ─── Relações ─────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  negotiations: many(negotiations, { relationName: "clientNegotiations" }),
  resolvedNegotiations: many(negotiations, { relationName: "resolvedNegotiations" }),
  reviews: many(reviews),
}));

export const desmanchesRelations = relations(desmanches, ({ many, one }) => ({
  addresses: many(desmancheAddresses),
  documents: many(documents),
  proposals: many(proposals),
  negotiations: many(negotiations),
  invoices: many(invoices),
  reviews: many(reviews),
  billing: one(desmancheBilling, { fields: [desmanches.id], references: [desmancheBilling.desmancheId] }),
  billingTransactions: many(billingTransactions),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  billings: many(desmancheBilling),
}));

export const desmancheBillingRelations = relations(desmancheBilling, ({ one }) => ({
  desmanche: one(desmanches, { fields: [desmancheBilling.desmancheId], references: [desmanches.id] }),
  plan: one(subscriptionPlans, { fields: [desmancheBilling.planId], references: [subscriptionPlans.id] }),
}));

export const billingTransactionsRelations = relations(billingTransactions, ({ one }) => ({
  desmanche: one(desmanches, { fields: [billingTransactions.desmancheId], references: [desmanches.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  client: one(users, { fields: [orders.clientId], references: [users.id] }),
  desmanche: one(desmanches, { fields: [orders.desmancheId], references: [desmanches.id] }),
  items: many(orderItems),
  images: many(orderImages),
  proposals: many(proposals),
  negotiations: many(negotiations),
}));

export const orderItemsRelations = relations(orderItems, ({ one, many }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  proposals: many(proposals),
  negotiations: many(negotiations),
  images: many(orderImages),
}));

export const orderImagesRelations = relations(orderImages, ({ one }) => ({
  order: one(orders, { fields: [orderImages.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [orderImages.orderItemId], references: [orderItems.id] }),
}));

export const proposalsRelations = relations(proposals, ({ one, many }) => ({
  order: one(orders, { fields: [proposals.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [proposals.orderItemId], references: [orderItems.id] }),
  desmanche: one(desmanches, { fields: [proposals.desmancheId], references: [desmanches.id] }),
  negotiations: many(negotiations),
}));

export const negotiationsRelations = relations(negotiations, ({ one }) => ({
  order: one(orders, { fields: [negotiations.orderId], references: [orders.id] }),
  orderItem: one(orderItems, { fields: [negotiations.orderItemId], references: [orderItems.id] }),
  proposal: one(proposals, { fields: [negotiations.proposalId], references: [proposals.id] }),
  client: one(users, { fields: [negotiations.clientId], references: [users.id], relationName: "clientNegotiations" }),
  desmanche: one(desmanches, { fields: [negotiations.desmancheId], references: [desmanches.id] }),
  resolvedByAdmin: one(users, { fields: [negotiations.resolvedByAdminId], references: [users.id], relationName: "resolvedNegotiations" }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  desmanche: one(desmanches, { fields: [invoices.desmancheId], references: [desmanches.id] }),
}));

export const documentsRelations = relations(documents, ({ one }) => ({
  desmanche: one(desmanches, { fields: [documents.desmancheId], references: [desmanches.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  client: one(users, { fields: [reviews.clientId], references: [users.id] }),
  desmanche: one(desmanches, { fields: [reviews.desmancheId], references: [desmanches.id] }),
  negotiation: one(negotiations, { fields: [reviews.negotiationId], references: [negotiations.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const desmancheAddressesRelations = relations(desmancheAddresses, ({ one }) => ({
  desmanche: one(desmanches, { fields: [desmancheAddresses.desmancheId], references: [desmanches.id] }),
}));

export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  proposal: one(proposals, { fields: [chatRooms.proposalId], references: [proposals.id] }),
  order: one(orders, { fields: [chatRooms.orderId], references: [orders.id] }),
  client: one(users, { fields: [chatRooms.clientId], references: [users.id] }),
  desmanche: one(desmanches, { fields: [chatRooms.desmancheId], references: [desmanches.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  room: one(chatRooms, { fields: [chatMessages.roomId], references: [chatRooms.id] }),
}));

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Desmanche = typeof desmanches.$inferSelect;
export type InsertDesmanche = z.infer<typeof insertDesmancheSchema>;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;

export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;

export type Proposal = typeof proposals.$inferSelect;
export type InsertProposal = z.infer<typeof insertProposalSchema>;

export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;

export type Auction = typeof auctions.$inferSelect;
export type InsertAuction = z.infer<typeof insertAuctionSchema>;

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = z.infer<typeof insertReviewSchema>;

export type Address = typeof addresses.$inferSelect;
export type DesmancheAddress = typeof desmancheAddresses.$inferSelect;
export type OrderImage = typeof orderImages.$inferSelect;
export type Negotiation = typeof negotiations.$inferSelect;
export const preProposalRoomsRelations = relations(preProposalRooms, ({ one, many }) => ({
  order: one(orders, { fields: [preProposalRooms.orderId], references: [orders.id] }),
  client: one(users, { fields: [preProposalRooms.clientId], references: [users.id] }),
  desmanche: one(desmanches, { fields: [preProposalRooms.desmancheId], references: [desmanches.id] }),
  messages: many(preProposalMessages),
}));

export const preProposalMessagesRelations = relations(preProposalMessages, ({ one }) => ({
  room: one(preProposalRooms, { fields: [preProposalMessages.roomId], references: [preProposalRooms.id] }),
}));

export type ChatRoom = typeof chatRooms.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type PreProposalRoom = typeof preProposalRooms.$inferSelect;
export type PreProposalMessage = typeof preProposalMessages.$inferSelect;

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type DesmancheBilling = typeof desmancheBilling.$inferSelect;
export type BillingTransaction = typeof billingTransactions.$inferSelect;
export type SystemSetting = typeof systemSettings.$inferSelect;

// ─── GUINCHOS ─────────────────────────────────────────────────────────────────

export const guinchos = sqliteTable("guinchos", {
  id: text("id").primaryKey().default(sql`(lower(hex(randomblob(16)))`),
  name: text("name").notNull(),
  tradingName: text("trading_name").notNull(),
  documentType: text("document_type", { enum: ["cnpj", "cpf"] }).notNull().default("cnpj"),
  cnpj: text("cnpj").unique(),
  cpf: text("cpf").unique(),
  antt: text("antt"),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull(),
  whatsapp: text("whatsapp").notNull(),
  password: text("password").notNull(),
  description: text("description"),
  zipCode: text("zip_code").notNull(),
  street: text("street").notNull(),
  number: text("number"),
  neighborhood: text("neighborhood"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  serviceRadius: integer("service_radius").notNull().default(50),
  photoUrl: text("photo_url"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  status: text("status", { enum: ["pending", "active", "rejected", "inactive"] }).notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  asaasCustomerId: text("asaas_customer_id"),
  asaasPaymentId: text("asaas_payment_id"),
  asaasSubscriptionId: text("asaas_subscription_id"),
  plan: text("plan", { enum: ["annual", "monthly"] }).notNull().default("annual"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(strftime('%s', 'now'))`),
});

export const insertGuinchoSchema = createInsertSchema(guinchos, {
  name: z.string().min(2, "Nome deve ter ao menos 2 caracteres"),
  tradingName: z.string().min(2, "Nome fantasia deve ter ao menos 2 caracteres"),
  documentType: z.enum(["cnpj", "cpf"]).default("cnpj"),
  cnpj: z.string().regex(/^\d{14}$/, "CNPJ deve conter 14 dígitos numéricos").optional().nullable(),
  cpf: z.string().regex(/^\d{11}$/, "CPF deve conter 11 dígitos numéricos").optional().nullable(),
  antt: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido"),
  phone: z.string().min(10, "Telefone inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  password: z.string().min(6, "Senha deve ter ao menos 6 caracteres"),
  zipCode: z.string().min(8, "CEP inválido"),
  street: z.string().min(2, "Rua obrigatória"),
  city: z.string().min(2, "Cidade obrigatória"),
  state: z.string().length(2, "Estado deve ter 2 letras"),
  serviceRadius: z.number().int().min(5).max(500).optional(),
})
  .omit({ id: true, status: true, rejectionReason: true, createdAt: true, photoUrl: true, latitude: true, longitude: true })
  .refine((d) => (d.documentType === "cnpj" ? !!d.cnpj : !!d.cpf), {
    message: "Informe um CNPJ válido ou um CPF válido de acordo com o tipo selecionado",
    path: ["cnpj"],
  });

export type Guincho = typeof guinchos.$inferSelect;
export type InsertGuincho = z.infer<typeof insertGuinchoSchema>;
