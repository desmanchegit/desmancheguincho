import type { Express, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod/v4";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as storage from "../storage";
import * as schema from "@workspace/db/schema";
import * as asaas from "../asaas";
import * as email from "../email";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const uploadStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: uploadStorage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use PDF, JPG, PNG ou WebP.'));
    }
  },
});

const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Middleware de autenticação
function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ message: "Token não fornecido" });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    (req as any).user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token inválido" });
  }
}

// Middleware de autorização por tipo
function requireType(types: string[]) {
  return (req: Request, res: Response, next: Function) => {
    const user = (req as any).user;
    if (!types.includes(user.type)) {
      return res.status(403).json({ message: "Acesso negado" });
    }
    next();
  };
}

export async function registerRoutes(app: Express) {
  const express = await import("express");
  app.use("/api/uploads", express.default.static(uploadsDir));
  // ============================================
  // AUTH ROUTES
  // ============================================
  
  // Login de usuário (cliente/admin)
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }
      
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      const isValid = await storage.verifyPassword(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }

      if ((user as any).status === "inactive") {
        return res.status(403).json({ message: "Usuário desativado. Entre em contato com o suporte." });
      }
      
      const permissions = user.type === "admin" ? storage.getAdminPermissions(user.id) : undefined;

      const token = jwt.sign(
        { id: user.id, email: user.email, type: user.type },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      storage.logActivity({
        action: user.type === "admin" ? "admin_login" : "client_login",
        actorType: user.type === "admin" ? "admin" : "client",
        actorId: user.id,
        actorName: user.name,
        description: `${user.type === "admin" ? "Admin" : "Cliente"} ${user.name} fez login`,
      });
      res.json({
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          type: user.type,
          avatar: user.avatar,
          permissions: user.type === "admin" ? permissions : undefined,
        },
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Erro no login" });
    }
  });
  
  // Login de desmanche
  app.post("/api/auth/login-desmanche", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email e senha são obrigatórios" });
      }
      
      const desmanche = await storage.getDesmancheByEmail(email);
      if (!desmanche) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      const isValid = await storage.verifyPassword(password, desmanche.password);
      if (!isValid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      
      const token = jwt.sign(
        { id: desmanche.id, email: desmanche.email, type: "desmanche" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      storage.logActivity({
        action: "desmanche_login",
        actorType: "desmanche",
        actorId: desmanche.id,
        actorName: desmanche.tradingName,
        description: `Desmanche ${desmanche.tradingName} fez login`,
      });
      res.json({
        token,
        user: {
          id: desmanche.id,
          name: desmanche.tradingName,
          email: desmanche.email,
          phone: desmanche.phone,
          type: "desmanche",
          status: desmanche.status,
          rating: desmanche.rating,
          salesCount: desmanche.salesCount,
          plan: desmanche.plan,
        },
      });
    } catch (error) {
      console.error("Login desmanche error:", error);
      res.status(500).json({ message: "Erro no login" });
    }
  });
  
  // Registro de cliente
  app.post("/api/auth/register", async (req, res) => {
    try {
      const userData = schema.insertUserSchema.parse(req.body);
      
      // Verifica se email já existe
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }

      // Verifica se CPF já existe (se informado)
      if (userData.cpf) {
        const existingCpf = await storage.getUserByCpf(userData.cpf);
        if (existingCpf) {
          return res.status(400).json({ message: "CPF já cadastrado. Se você já tem uma conta, faça login." });
        }
      }
      
      const user = await storage.createUser(userData);

      storage.logActivity({
        action: "client_registered",
        actorType: "client",
        actorId: user!.id,
        actorName: user!.name,
        targetType: "user",
        targetId: user!.id,
        description: `Novo cliente cadastrado: ${user!.name} (${user!.email})`,
      });
      
      // Send verification email + welcome email
      const verifyToken = randomBytes(32).toString("hex");
      const verifyExpires = Math.floor(Date.now() / 1000) + 86400; // 24h
      storage.setEmailVerificationToken(user!.id, verifyToken, verifyExpires);
      email.sendVerificationEmail(user!.email, verifyToken).catch(err => console.error("Email error:", err));
      email.sendWelcomeClientEmail(user!.email, user!.name).catch(err => console.error("Welcome email error:", err));
      
      const token = jwt.sign(
        { id: user!.id, email: user!.email, type: user!.type },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      res.status(201).json({
        token,
        user: {
          id: user!.id,
          name: user!.name,
          email: user!.email,
          phone: user!.phone,
          type: user!.type,
          emailVerified: false,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Register error:", error);
      res.status(500).json({ message: "Erro no registro" });
    }
  });
  
  // ─── EMAIL VERIFICATION ─────────────────────────────────────────────────────

  app.get("/api/auth/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) return res.status(400).json({ message: "Token inválido" });
      const user = storage.getUserByVerificationToken(token);
      if (!user) return res.status(400).json({ message: "Link inválido ou já utilizado." });
      const now = Math.floor(Date.now() / 1000);
      if (user.email_verification_expires && user.email_verification_expires < now) {
        return res.status(400).json({ message: "Link expirado. Solicite um novo e-mail de verificação." });
      }
      storage.markEmailVerified(user.id);
      res.json({ message: "E-mail verificado com sucesso!" });
    } catch (error) {
      console.error("Verify email error:", error);
      res.status(500).json({ message: "Erro ao verificar e-mail" });
    }
  });

  app.post("/api/auth/resend-verification", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      if (storage.isEmailVerified(userId)) {
        return res.status(400).json({ message: "E-mail já verificado." });
      }
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });
      const token = randomBytes(32).toString("hex");
      const expires = Math.floor(Date.now() / 1000) + 86400;
      storage.setEmailVerificationToken(userId, token, expires);
      await email.sendVerificationEmail(user.email, token);
      res.json({ message: "E-mail de verificação reenviado!" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Erro ao reenviar e-mail" });
    }
  });

  // ─── PASSWORD RESET ──────────────────────────────────────────────────────────

  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email: userEmail } = req.body;
      if (!userEmail) return res.status(400).json({ message: "E-mail obrigatório" });
      const user = await storage.getUserByEmail(userEmail);
      // Always return success to avoid email enumeration
      if (user) {
        const token = randomBytes(32).toString("hex");
        const expires = Math.floor(Date.now() / 1000) + 3600; // 1h
        storage.setPasswordResetToken(user.id, token, expires);
        email.sendPasswordResetEmail(user.email, token).catch(err => console.error("Email error:", err));
      }
      res.json({ message: "Se este e-mail estiver cadastrado, você receberá as instruções em breve." });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Erro ao processar solicitação" });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password: newPassword } = req.body;
      if (!token || !newPassword) return res.status(400).json({ message: "Token e senha são obrigatórios" });
      if (newPassword.length < 6) return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      const user = storage.getUserByPasswordResetToken(token);
      if (!user) return res.status(400).json({ message: "Link inválido ou já utilizado." });
      const now = Math.floor(Date.now() / 1000);
      if (user.password_reset_expires && user.password_reset_expires < now) {
        return res.status(400).json({ message: "Link expirado. Solicite um novo." });
      }
      const hash = await bcrypt.hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hash);
      storage.clearPasswordResetToken(user.id);
      res.json({ message: "Senha redefinida com sucesso!" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Erro ao redefinir senha" });
    }
  });

  // Registro de desmanche
  app.post("/api/auth/register-desmanche", async (req, res) => {
    try {
      const desmancheData = schema.insertDesmancheSchema.parse(req.body);
      
      // Verifica se email ou CNPJ já existe
      const existingEmail = await storage.getDesmancheByEmail(desmancheData.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email já cadastrado" });
      }
      
      const existingCnpj = await storage.getDesmancheByCnpj(desmancheData.cnpj);
      if (existingCnpj) {
        return res.status(400).json({ message: "CNPJ já cadastrado. Se o seu desmanche já tem uma conta, faça login." });
      }

      // Verifica se CPF do responsável já foi usado em outro cadastro
      if (desmancheData.responsibleCpf) {
        const existingResponsibleCpf = await storage.getDesmancheByResponsibleCpf(desmancheData.responsibleCpf);
        if (existingResponsibleCpf) {
          return res.status(400).json({ message: "CPF do responsável já cadastrado em outro desmanche." });
        }
      }
      
      const desmanche = await storage.createDesmanche(desmancheData);

      storage.logActivity({
        action: "desmanche_registered",
        actorType: "desmanche",
        actorId: desmanche!.id,
        actorName: desmanche!.tradingName,
        targetType: "desmanche",
        targetId: desmanche!.id,
        description: `Novo desmanche cadastrado: ${desmanche!.tradingName} (CNPJ: ${desmanche!.cnpj})`,
      });

      // Send welcome email to new desmanche
      email.sendWelcomeDesmancheEmail(desmanche!.email, desmanche!.tradingName).catch(err => console.error("Welcome desmanche email error:", err));

      const token = jwt.sign(
        { id: desmanche!.id, email: desmanche!.email, type: "desmanche" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      
      res.status(201).json({
        token,
        user: {
          id: desmanche!.id,
          name: desmanche!.tradingName,
          email: desmanche!.email,
          phone: desmanche!.phone,
          type: "desmanche",
          status: desmanche!.status,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Register desmanche error:", error);
      res.status(500).json({ message: "Erro no registro" });
    }
  });
  
  // ============================================
  // USER ROUTES
  // ============================================
  
  app.get("/api/users/me", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      
      if (userType === "desmanche") {
        const desmanche = await storage.getDesmancheById(userId);
        if (!desmanche) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const address = await storage.getDesmancheAddressByDesmancheId(userId);
        const docs = await storage.getDocumentsByDesmanche(userId);
        res.json({
          id: desmanche.id,
          name: desmanche.tradingName,
          email: desmanche.email,
          phone: desmanche.phone,
          type: "desmanche",
          status: desmanche.status,
          rating: desmanche.rating,
          salesCount: desmanche.salesCount,
          plan: desmanche.plan,
          companyName: desmanche.companyName,
          tradingName: desmanche.tradingName,
          cnpj: desmanche.cnpj,
          responsibleName: desmanche.responsibleName,
          responsibleCpf: desmanche.responsibleCpf,
          rejectionReason: desmanche.rejectionReason,
          address: address || null,
          documents: docs,
        });
      } else {
        const user = await storage.getUserById(userId);
        if (!user) {
          return res.status(404).json({ message: "Usuário não encontrado" });
        }
        const address = await storage.getAddressByUserId(userId);
        const profileComplete = !!(user.whatsapp && address?.zipCode && address?.street && address?.city);
        const emailVerified = storage.isEmailVerified(userId);
        const adminPerms = user.type === "admin" ? storage.getAdminPermissions(user.id) : undefined;
        res.json({
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          whatsapp: user.whatsapp,
          type: user.type,
          avatar: user.avatar,
          profileComplete,
          emailVerified,
          address: address || null,
          permissions: user.type === "admin" ? adminPerms : undefined,
        });
      }
    } catch (error) {
      console.error("Get user error:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });
  
  app.patch("/api/users/me", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { name, email, phone, whatsapp, whatsappContactPreference } = req.body;
      
      const user = await storage.updateUserProfile(userId, { name, email, phone, whatsapp, whatsappContactPreference });
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }
      
      const address = await storage.getAddressByUserId(userId);
      const isComplete = !!(user.whatsapp && address);
      await storage.setUserProfileComplete(userId, isComplete);
      
      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        whatsapp: user.whatsapp,
        whatsappContactPreference: user.whatsappContactPreference,
        type: user.type,
        avatar: user.avatar,
        profileComplete: isComplete,
        address: address || null,
      });
    } catch (error) {
      console.error("Update user error:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });
  
  app.get("/api/users/me/address", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const address = await storage.getAddressByUserId(userId);
      res.json(address || null);
    } catch (error) {
      console.error("Get address error:", error);
      res.status(500).json({ message: "Erro ao buscar endereço" });
    }
  });
  
  app.put("/api/users/me/address", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const { zipCode, street, number, complement, city, state } = req.body;
      
      if (!zipCode || !street || !city || !state) {
        return res.status(400).json({ message: "CEP, rua, cidade e estado são obrigatórios" });
      }
      
      const address = await storage.createOrUpdateAddress(userId, {
        zipCode, street, number, complement, city, state,
      });
      
      const user = await storage.getUserById(userId);
      const isComplete = !!(user?.whatsapp && address);
      await storage.setUserProfileComplete(userId, isComplete);
      
      res.json(address);
    } catch (error) {
      console.error("Update address error:", error);
      res.status(500).json({ message: "Erro ao salvar endereço" });
    }
  });
  
  // ============================================
  // DESMANCHES ROUTES
  // ============================================
  
  app.get("/api/desmanches", authMiddleware, async (req, res) => {
    try {
      const { status, plan } = req.query;
      const desmanches = await storage.getAllDesmanches({
        status: status as string,
        plan: plan as string,
      });
      res.json(desmanches);
    } catch (error) {
      console.error("Get desmanches error:", error);
      res.status(500).json({ message: "Erro ao buscar desmanches" });
    }
  });
  
  app.get("/api/desmanches/me", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const desmanche = await storage.getDesmancheById(desmancheId);
      if (!desmanche) return res.status(404).json({ message: "Desmanche não encontrado" });
      const { password: _, ...safe } = desmanche as any;
      res.json(safe);
    } catch (error) {
      console.error("Get desmanche me error:", error);
      res.status(500).json({ message: "Erro ao buscar dados" });
    }
  });

  app.patch("/api/desmanches/me", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { tradingName, phone, responsibleName, responsibleCpf, logo, vehicleTypes } = req.body;
      const vtJson = vehicleTypes !== undefined ? JSON.stringify(vehicleTypes) : undefined;
      const desmanche = await storage.updateDesmancheProfile(desmancheId, { tradingName, phone, responsibleName, responsibleCpf, logo, vehicleTypes: vtJson });
      res.json(desmanche);
    } catch (error) {
      console.error("Update desmanche profile error:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });
  
  // Desmanche resubmits after rejection — sends corrections back to admin queue
  app.post("/api/desmanches/me/resubmit", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const desmanche = await storage.getDesmancheById(desmancheId);
      if (!desmanche) return res.status(404).json({ message: "Desmanche não encontrado" });
      if (!["rejected"].includes(desmanche.status)) {
        return res.status(400).json({ message: "Só é possível reenviar quando o cadastro foi rejeitado." });
      }
      const { correctionNote } = req.body;
      const updated = await storage.resubmitDesmanche(desmancheId, correctionNote);
      res.json(updated);
    } catch (error) {
      console.error("Resubmit desmanche error:", error);
      res.status(500).json({ message: "Erro ao reenviar cadastro" });
    }
  });

  app.get("/api/desmanches/me/address", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const address = await storage.getDesmancheAddressByDesmancheId(desmancheId);
      res.json(address || null);
    } catch (error) {
      console.error("Get desmanche address error:", error);
      res.status(500).json({ message: "Erro ao buscar endereço" });
    }
  });
  
  app.put("/api/desmanches/me/address", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { zipCode, street, number, complement, city, state } = req.body;
      if (!zipCode || !street || !city || !state) {
        return res.status(400).json({ message: "CEP, rua, cidade e estado são obrigatórios" });
      }
      const address = await storage.createOrUpdateDesmancheAddress(desmancheId, { zipCode, street, number, complement, city, state });
      res.json(address);
    } catch (error) {
      console.error("Update desmanche address error:", error);
      res.status(500).json({ message: "Erro ao salvar endereço" });
    }
  });
  
  app.get("/api/desmanches/:id", authMiddleware, async (req, res) => {
    try {
      const desmanche = await storage.getDesmancheById((req.params.id as string) as string);
      if (!desmanche) {
        return res.status(404).json({ message: "Desmanche não encontrado" });
      }
      res.json(desmanche);
    } catch (error) {
      console.error("Get desmanche error:", error);
      res.status(500).json({ message: "Erro ao buscar desmanche" });
    }
  });
  
  app.patch("/api/desmanches/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { status, rejectionReason } = req.body;
      const desmanche = await storage.updateDesmancheStatus((req.params.id as string) as string, status, rejectionReason);
      const adminUser = (req as any).user;
      const action = status === "active" ? "desmanche_approved" : status === "rejected" ? "desmanche_rejected" : "desmanche_status_changed";
      storage.logActivity({
        action,
        actorType: "admin",
        actorId: adminUser.id,
        actorName: adminUser.name || "Admin",
        targetType: "desmanche",
        targetId: (req.params.id as string),
        description: `Desmanche ${desmanche?.tradingName ?? (req.params.id as string)} teve status alterado para "${status}"${rejectionReason ? ` — Motivo: ${rejectionReason}` : ""}`,
      });
      res.json(desmanche);
    } catch (error) {
      console.error("Update desmanche status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // ============================================
  // ORDERS ROUTES
  // ============================================
  
  app.get("/api/orders", authMiddleware, async (req, res) => {
    try {
      const { status, urgency, isPartnerRequest } = req.query;
      const orders = await storage.getAllOrders({
        status: status as string,
        urgency: urgency as string,
        isPartnerRequest: isPartnerRequest === "true" ? true : isPartnerRequest === "false" ? false : undefined,
      });
      res.json(orders);
    } catch (error) {
      console.error("Get orders error:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });
  
  app.get("/api/orders/my", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const orders = await storage.getOrdersByClient(userId);
      res.json(orders);
    } catch (error) {
      console.error("Get my orders error:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });

  app.get("/api/orders/my-ads", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const orders = await storage.getOrdersByDesmanche(desmancheId);
      res.json(orders);
    } catch (error) {
      console.error("Get my ads error:", error);
      res.status(500).json({ message: "Erro ao buscar anúncios" });
    }
  });
  
  app.get("/api/orders/:id", authMiddleware, async (req, res) => {
    try {
      const order = await storage.getOrderById((req.params.id as string) as string);
      if (!order) {
        return res.status(404).json({ message: "Pedido não encontrado" });
      }
      res.json(order);
    } catch (error) {
      console.error("Get order error:", error);
      res.status(500).json({ message: "Erro ao buscar pedido" });
    }
  });

  app.post("/api/orders", authMiddleware, requireType(["client", "desmanche"]), async (req, res) => {
    try {
      const reqUser = (req as any).user;
      
      if (reqUser.type === "desmanche") {
        const desmancheId = reqUser.id;
        const desmanche = await storage.getDesmancheById(desmancheId);
        if (!desmanche || desmanche.status !== "active") {
          return res.status(403).json({ message: "Apenas desmanches credenciados podem publicar anúncios" });
        }
        const orderData = schema.insertOrderSchema.parse(req.body);
        const order = await storage.createOrder({
          ...orderData,
          clientId: null,
          desmancheId,
          postedByType: "desmanche",
        });
        storage.logActivity({
          action: "order_created",
          actorType: "desmanche",
          actorId: desmancheId,
          actorName: desmanche.tradingName,
          targetType: "order",
          targetId: order!.id,
          description: `Anúncio publicado por desmanche ${desmanche.tradingName}`,
        });
        return res.status(201).json(order);
      }

      // Client flow
      const clientId = reqUser.id;
      const user = await storage.getUserById(clientId);
      if (!user?.profileComplete) {
        return res.status(400).json({ message: "Configure seu WhatsApp e endereço no perfil antes de criar pedidos." });
      }
      // Email verification check disabled for testing (re-enable after launch)
      // if (!storage.isEmailVerified(clientId)) {
      //   return res.status(403).json({ message: "Confirme seu e-mail antes de criar pedidos.", emailNotVerified: true });
      // }
      
      const maxOverdue = await storage.getSystemSettingNumber("maxOverdueBeforeBlock", 1);
      const overdueCount = await storage.getOverdueReviewCountForClient(clientId);
      if (overdueCount >= maxOverdue) {
        const pending = await storage.getPendingReviewsForClient(clientId);
        return res.status(403).json({
          message: "Você possui avaliações atrasadas. Avalie as negociações concluídas para criar novos pedidos.",
          blocked: true,
          pendingReviews: pending,
        });
      }
      
      const orderData = schema.insertOrderSchema.parse(req.body);
      const items = req.body.items as any[] | undefined;
      const order = await storage.createOrder({
        ...orderData,
        clientId,
        postedByType: "client",
        items: items && items.length > 0 ? items : undefined,
      });
      storage.logActivity({
        action: "order_created",
        actorType: "client",
        actorId: clientId,
        actorName: user!.name,
        targetType: "order",
        targetId: order!.id,
        description: `Pedido criado por ${user!.name}`,
      });
      res.status(201).json(order);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Create order error:", error);
      res.status(500).json({ message: "Erro ao criar pedido" });
    }
  });

  // ============================================
  // ORDER ITEMS ROUTES
  // ============================================

  app.get("/api/order-items/:id", authMiddleware, async (req, res) => {
    try {
      const item = await storage.getOrderItemById((req.params.id as string));
      if (!item) return res.status(404).json({ message: "Item não encontrado" });
      res.json(item);
    } catch (error) {
      console.error("Get order item error:", error);
      res.status(500).json({ message: "Erro ao buscar item" });
    }
  });

  app.patch("/api/order-items/:id/status", authMiddleware, async (req, res) => {
    try {
      const { status } = req.body;
      const item = await storage.updateOrderItemStatus((req.params.id as string), status);
      res.json(item);
    } catch (error) {
      console.error("Update order item status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status do item" });
    }
  });

  app.patch("/api/order-items/:id/reactivate", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const item = await storage.getOrderItemById((req.params.id as string));
      if (!item) return res.status(404).json({ message: "Item não encontrado" });
      const order = await storage.getOrderById(item.orderId);
      if (!order || order.clientId !== clientId) return res.status(403).json({ message: "Sem permissão" });
      const updated = await storage.reactivateOrderItem((req.params.id as string));
      res.json(updated);
    } catch (error) {
      console.error("Reactivate order item error:", error);
      res.status(500).json({ message: "Erro ao reativar item" });
    }
  });

  app.patch("/api/orders/:id/reactivate", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const order = await storage.getOrderById((req.params.id as string));
      if (!order) return res.status(404).json({ message: "Anúncio não encontrado" });
      if (order.desmancheId !== desmancheId) return res.status(403).json({ message: "Sem permissão" });
      if (order.postedByType !== "desmanche") return res.status(400).json({ message: "Apenas anúncios de desmanche podem ser reativados" });
      const updated = await storage.reactivateOrder(order.id);
      res.json(updated);
    } catch (error) {
      console.error("Reactivate order error:", error);
      res.status(500).json({ message: "Erro ao reativar anúncio" });
    }
  });
  
  app.patch("/api/orders/:id/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const { status } = req.body;
      
      const order = await storage.getOrderById((req.params.id as string) as string);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
      const isOwner = order.postedByType === "desmanche"
        ? order.desmancheId === userId
        : order.clientId === userId;
      if (userType !== "admin" && !isOwner) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updated = await storage.updateOrderStatus((req.params.id as string) as string, status);
      res.json(updated);
    } catch (error) {
      console.error("Update order status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // Direct buy endpoint for clients purchasing desmanche-posted ads (no proposal needed)
  app.post("/api/orders/:id/buy", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const order = await storage.getOrderById((req.params.id as string) as string);
      if (!order) return res.status(404).json({ message: "Anúncio não encontrado" });
      if (order.postedByType !== "desmanche") {
        return res.status(400).json({ message: "Este pedido não é um anúncio de desmanche" });
      }
      if (order.status !== "open") {
        return res.status(409).json({ message: "Este anúncio não está disponível" });
      }
      if (!order.desmancheId) {
        return res.status(500).json({ message: "Anúncio sem desmanche associado" });
      }

      // Create a purchase proposal on behalf of the desmanche owner so the negotiation chain is consistent
      const proposal = await storage.createProposal({
        orderId: order.id,
        desmancheId: order.desmancheId,
        price: req.body.price ?? 0,
        message: req.body.message ?? "Compra direta via anúncio",
      });
      await storage.updateProposalStatus(proposal!.id, "accepted");

      const negotiation = await storage.createNegotiation({
        orderId: order.id,
        proposalId: proposal!.id,
        clientId,
        desmancheId: order.desmancheId,
        price: proposal!.price,
      });
      await storage.updateOrderStatus(order.id, "negotiating");

      try {
        await storage.createChatRoom({
          proposalId: proposal!.id,
          orderId: order.id,
          clientId,
          desmancheId: order.desmancheId,
        });
      } catch (chatErr) {
        console.error("Buy chat room creation error (non-critical):", chatErr);
      }

      res.status(201).json(negotiation);
    } catch (error) {
      console.error("Buy order error:", error);
      res.status(500).json({ message: "Erro ao processar compra" });
    }
  });

  // ============================================
  // PROPOSALS ROUTES
  // ============================================
  
  app.get("/api/proposals", authMiddleware, async (req, res) => {
    try {
      const { orderId, desmancheId } = req.query;
      
      if (orderId) {
        const proposals = await storage.getProposalsByOrder(orderId as string);
        return res.json(proposals);
      }
      
      if (desmancheId) {
        const proposals = await storage.getProposalsByDesmanche(desmancheId as string);
        return res.json(proposals);
      }
      
      res.status(400).json({ message: "orderId ou desmancheId é obrigatório" });
    } catch (error) {
      console.error("Get proposals error:", error);
      res.status(500).json({ message: "Erro ao buscar propostas" });
    }
  });
  
  app.post("/api/proposals", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      let proposalData = schema.insertProposalSchema.parse(req.body);

      // Se veio orderItemId mas não orderId, derivar orderId do item
      if (proposalData.orderItemId && !proposalData.orderId) {
        const item = await storage.getOrderItemById(proposalData.orderItemId);
        if (!item) return res.status(404).json({ message: "Item não encontrado" });
        proposalData = { ...proposalData, orderId: item.orderId };
      }

      // Verifica se o desmanche está fazendo a proposta
      if (proposalData.desmancheId !== desmancheId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      // Impede que um desmanche responda ao próprio anúncio
      const proposalOrder = await storage.getOrderById(proposalData.orderId);
      if (proposalOrder && proposalOrder.postedByType === "desmanche" && proposalOrder.desmancheId === desmancheId) {
        return res.status(403).json({ message: "Você não pode enviar propostas para o seu próprio anúncio." });
      }
      
      // Verificação de bloqueio por avaliação pendente
      const maxOverdue = await storage.getSystemSettingNumber("maxOverdueBeforeBlock", 1);
      const overdueCount = await storage.getOverdueReviewCountForDesmanche(desmancheId);
      if (overdueCount >= maxOverdue) {
        return res.status(403).json({
          message: "Você possui avaliações atrasadas. Aguarde a avaliação do cliente para enviar novas propostas.",
          blocked: true,
        });
      }

      // Verificação de limite de propostas mensais (modelo assinatura)
      const billing = await storage.getDesmancheBilling(desmancheId);
      if (billing && billing.billingModel === "subscription" && billing.planId) {
        const plan = await storage.getSubscriptionPlanById(billing.planId);
        if (plan && plan.proposalLimit < 999) {
          const monthlyCount = await storage.getMonthlyProposalCountForDesmanche(desmancheId);
          if (monthlyCount >= plan.proposalLimit) {
            return res.status(429).json({
              message: `Limite de ${plan.proposalLimit} propostas do plano ${plan.name} atingido este mês. Aguarde o próximo ciclo ou faça upgrade do plano.`,
              proposalLimitReached: true,
              limit: plan.proposalLimit,
              currentCount: monthlyCount,
            });
          }
        }
      }

      const proposal = await storage.createProposal(proposalData);

      const desmancheForLog = (req as any).user;
      storage.logActivity({
        action: "proposal_sent",
        actorType: "desmanche",
        actorId: desmancheId,
        actorName: desmancheForLog.name || desmancheForLog.tradingName || desmancheId,
        targetType: "order",
        targetId: proposalData.orderId,
        description: `Proposta enviada por desmanche ${desmancheForLog.name || desmancheId} — Valor: R$ ${Number(proposalData.price).toFixed(2)}`,
      });

      // Atualiza status do item para has_proposals
      if (proposalData.orderItemId) {
        await storage.updateOrderItemStatus(proposalData.orderItemId, 'has_proposals');
      }
      
      // Auto-create chat room when proposal is sent (only for client orders)
      try {
        const order = await storage.getOrderById(proposalData.orderId);
        if (order && order.clientId) {
          await storage.createChatRoom({
            proposalId: proposal!.id,
            orderId: proposalData.orderId,
            clientId: order.clientId,
            desmancheId: proposalData.desmancheId,
          });
        }
      } catch (chatErr) {
        console.error("Chat room creation error (non-critical):", chatErr);
      }
      
      res.status(201).json(proposal);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Create proposal error:", error);
      res.status(500).json({ message: "Erro ao criar proposta" });
    }
  });
  
  app.patch("/api/proposals/:id/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const { status } = req.body;
      
      const proposal = await storage.getProposalById((req.params.id as string) as string);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      
      const order = await storage.getOrderById(proposal.orderId);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
      
      const isDesmancheAd = order.postedByType === "desmanche";

      if (isDesmancheAd) {
        // For desmanche-posted ads: only clients can "buy" (accept), or the ad-owner desmanche can reject/withdraw
        if (userType === "client" && status === "accepted") {
          // Any authenticated client may accept a desmanche ad
        } else if (userType === "desmanche" && order.desmancheId === userId && status !== "accepted") {
          // Desmanche owner may reject/withdraw their own proposal
        } else if (userType === "admin") {
          // Admin always allowed
        } else {
          return res.status(403).json({ message: "Acesso negado" });
        }
      } else {
        // For client-posted orders: only the order's client or an admin may change proposal status
        if (userType === "client" && order.clientId !== userId) {
          return res.status(403).json({ message: "Acesso negado" });
        }
        if (userType === "desmanche" && proposal.desmancheId !== userId) {
          return res.status(403).json({ message: "Acesso negado" });
        }
      }
      
      const updated = await storage.updateProposalStatus((req.params.id as string) as string, status);

      if (status === "accepted" || status === "rejected") {
        storage.logActivity({
          action: status === "accepted" ? "proposal_accepted" : "proposal_rejected",
          actorType: userType === "admin" ? "admin" : userType as any,
          actorId: userId,
          targetType: "order",
          targetId: proposal.orderId,
          description: `Proposta ${status === "accepted" ? "aceita" : "rejeitada"} para pedido ${proposal.orderId}`,
        });
      }
      
      if (status === "accepted") {
        // For desmanche ads the "client" is the user who accepted; for client orders it's order.clientId
        const negotiationClientId = isDesmancheAd ? userId : order.clientId!;
        const negotiationDesmancheId = isDesmancheAd ? order.desmancheId! : updated!.desmancheId;
        await storage.createNegotiation({
          orderId: updated!.orderId,
          proposalId: updated!.id,
          clientId: negotiationClientId,
          desmancheId: negotiationDesmancheId,
          price: updated!.price,
        });
        await storage.updateOrderStatus(updated!.orderId, "negotiating");
        // For desmanche ads, create the chat room now (deferred from proposal creation)
        if (isDesmancheAd) {
          try {
            await storage.createChatRoom({
              proposalId: updated!.id,
              orderId: updated!.orderId,
              clientId: negotiationClientId,
              desmancheId: negotiationDesmancheId,
            });
          } catch (chatErr) {
            console.error("Deferred chat room creation error (non-critical):", chatErr);
          }
        }
      }
      
      res.json(updated);
    } catch (error) {
      console.error("Update proposal status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // Desmanche revises a rejected/revision_requested proposal and resubmits
  app.patch("/api/proposals/:id/revise", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { price, message } = req.body;
      if (!price || !message) return res.status(400).json({ message: "Preço e mensagem são obrigatórios" });

      const proposal = await storage.getProposalById((req.params.id as string) as string);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      if (proposal.desmancheId !== desmancheId) return res.status(403).json({ message: "Acesso negado" });
      if (!["revision_requested", "rejected"].includes(proposal.status)) {
        return res.status(400).json({ message: "Só é possível revisar propostas que foram devolvidas para revisão" });
      }

      const updated = await storage.updateProposalContent(proposal.id, parseFloat(price), message);
      res.json(updated);
    } catch (error) {
      console.error("Revise proposal error:", error);
      res.status(500).json({ message: "Erro ao revisar proposta" });
    }
  });

  app.post("/api/proposals/:id/unlock-whatsapp", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const proposal = await storage.getProposalById((req.params.id as string) as string);
      if (!proposal) return res.status(404).json({ message: "Proposta não encontrada" });
      
      const order = await storage.getOrderById(proposal.orderId);
      if (!order || order.clientId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updated = await storage.unlockWhatsapp((req.params.id as string) as string);
      res.json(updated);
    } catch (error) {
      console.error("Unlock whatsapp error:", error);
      res.status(500).json({ message: "Erro ao desbloquear WhatsApp" });
    }
  });
  
  // ============================================
  // NEGOTIATIONS ROUTES
  // ============================================
  
  app.get("/api/negotiations", authMiddleware, async (req, res) => {
    try {
      const { clientId, desmancheId } = req.query;
      
      if (clientId) {
        const negotiations = await storage.getNegotiationsByClient(clientId as string);
        return res.json(negotiations);
      }
      
      if (desmancheId) {
        const negotiations = await storage.getNegotiationsByDesmanche(desmancheId as string);
        return res.json(negotiations);
      }
      
      res.status(400).json({ message: "clientId ou desmancheId é obrigatório" });
    } catch (error) {
      console.error("Get negotiations error:", error);
      res.status(500).json({ message: "Erro ao buscar negociações" });
    }
  });
  
  app.get("/api/negotiations/my", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      
      if (userType === "desmanche") {
        const negotiations = await storage.getNegotiationsByDesmanche(userId);
        return res.json(negotiations);
      } else {
        const negotiations = await storage.getNegotiationsByClient(userId);
        return res.json(negotiations);
      }
    } catch (error) {
      console.error("Get my negotiations error:", error);
      res.status(500).json({ message: "Erro ao buscar negociações" });
    }
  });
  
  app.patch("/api/negotiations/:id/status", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const { status, trackingCode } = req.body;
      
      const negotiation = await storage.getNegotiationById((req.params.id as string) as string);
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      
      if (userType === "client" && negotiation.clientId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userType === "desmanche" && negotiation.desmancheId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const updated = await storage.updateNegotiationStatus((req.params.id as string) as string, status, trackingCode);
      res.json(updated);
    } catch (error) {
      console.error("Update negotiation status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // ============================================
  // AUCTIONS ROUTES
  // ============================================
  
  app.get("/api/auctions", authMiddleware, async (req, res) => {
    try {
      const { status } = req.query;
      const auctions = await storage.getAllAuctions({ status: status as string });
      res.json(auctions);
    } catch (error) {
      console.error("Get auctions error:", error);
      res.status(500).json({ message: "Erro ao buscar leilões" });
    }
  });
  
  app.post("/api/auctions", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const auctionData = schema.insertAuctionSchema.parse(req.body);
      const auction = await storage.createAuction(auctionData);
      res.status(201).json(auction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Create auction error:", error);
      res.status(500).json({ message: "Erro ao criar leilão" });
    }
  });
  
  // ============================================
  // INVOICES ROUTES
  // ============================================
  
  app.get("/api/invoices", authMiddleware, async (req, res) => {
    try {
      const { desmancheId } = req.query;
      
      if (desmancheId) {
        const invoices = await storage.getInvoicesByDesmanche(desmancheId as string);
        return res.json(invoices);
      }
      
      // Admin vê todas
      const invoices = await storage.getAllInvoices();
      res.json(invoices);
    } catch (error) {
      console.error("Get invoices error:", error);
      res.status(500).json({ message: "Erro ao buscar faturas" });
    }
  });
  
  app.get("/api/invoices/my", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const invoices = await storage.getInvoicesByDesmanche(desmancheId);
      res.json(invoices);
    } catch (error) {
      console.error("Get my invoices error:", error);
      res.status(500).json({ message: "Erro ao buscar faturas" });
    }
  });
  
  app.post("/api/invoices", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const invoiceData = schema.insertInvoiceSchema.parse(req.body);
      const invoice = await storage.createInvoice(invoiceData);
      res.status(201).json(invoice);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Create invoice error:", error);
      res.status(500).json({ message: "Erro ao criar fatura" });
    }
  });
  
  app.patch("/api/invoices/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateInvoiceStatus((req.params.id as string) as string, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Update invoice status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // ============================================
  // DOCUMENTS ROUTES
  // ============================================
  
  app.get("/api/documents", authMiddleware, async (req, res) => {
    try {
      const { desmancheId } = req.query;
      if (!desmancheId) {
        return res.status(400).json({ message: "desmancheId é obrigatório" });
      }
      const userType = (req as any).user.type;
      const userId = (req as any).user.id;
      if (userType !== "admin" && userId !== desmancheId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      const documents = await storage.getDocumentsByDesmanche(desmancheId as string);
      res.json(documents);
    } catch (error) {
      console.error("Get documents error:", error);
      res.status(500).json({ message: "Erro ao buscar documentos" });
    }
  });
  
  app.get("/api/documents/my", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const documents = await storage.getDocumentsByDesmanche(desmancheId);
      res.json(documents);
    } catch (error) {
      console.error("Get my documents error:", error);
      res.status(500).json({ message: "Erro ao buscar documentos" });
    }
  });
  
  app.post("/api/documents", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const { type, name, url, validUntil } = req.body;
      const desmancheId = (req as any).user.id;

      const validTypes = ["alvara", "credenciamento_detran", "contrato_social", "documento_responsavel", "documento_empresa"];
      if (!type || !name || !url || !validTypes.includes(type)) {
        return res.status(400).json({ message: "Dados inválidos: type, name e url são obrigatórios" });
      }

      // validUntil vem do frontend como Unix timestamp em segundos (número)
      // O Drizzle espera Date, então convertemos aqui antes de salvar
      const validUntilDate: Date | undefined = validUntil
        ? new Date(Number(validUntil) * 1000)
        : undefined;

      const document = await storage.createDocument({
        desmancheId,
        type: type as any,
        name,
        url,
        validUntil: validUntilDate,
      });
      res.status(201).json(document);
    } catch (error) {
      console.error("Create document error:", error);
      res.status(500).json({ message: "Erro ao criar documento" });
    }
  });
  
  app.patch("/api/documents/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { status } = req.body;
      await storage.updateDocumentStatus((req.params.id as string) as string, status);
      res.json({ success: true });
    } catch (error) {
      console.error("Update document status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  // ============================================
  // REVIEWS ROUTES
  // ============================================
  
  app.get("/api/reviews", authMiddleware, async (req, res) => {
    try {
      const { desmancheId } = req.query;
      if (!desmancheId) {
        return res.status(400).json({ message: "desmancheId é obrigatório" });
      }
      const reviews = await storage.getReviewsByDesmanche(desmancheId as string);
      res.json(reviews);
    } catch (error) {
      console.error("Get reviews error:", error);
      res.status(500).json({ message: "Erro ao buscar avaliações" });
    }
  });
  
  app.post("/api/reviews", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const reviewData = schema.insertReviewSchema.parse(req.body);
      const clientId = (req as any).user.id;
      
      if (reviewData.clientId !== clientId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      
      const review = await storage.createReview(reviewData);

      const reviewerUser = (req as any).user;
      storage.logActivity({
        action: "review_submitted",
        actorType: "client",
        actorId: clientId,
        actorName: reviewerUser.name || clientId,
        targetType: "desmanche",
        targetId: reviewData.desmancheId,
        description: `Avaliação ${reviewData.rating}⭐ enviada pelo cliente ${reviewerUser.name || clientId}`,
      });
      
      // Marca negociação como concluída após avaliação
      const completedNeg = await storage.updateNegotiationStatus(reviewData.negotiationId, 'completed');
      
      // Atualiza o status do pedido para "completed"
      if (completedNeg?.orderId) {
        try {
          await storage.updateOrderStatus(completedNeg.orderId, 'completed');
        } catch (orderErr) {
          console.error("Order status update error (non-critical):", orderErr);
        }
      }
      
      // Dispara cobrança por transação se aplicável
      try {
        await triggerTransactionBilling(reviewData.desmancheId, reviewData.negotiationId);
      } catch (billingErr) {
        console.error("Billing trigger error (non-critical):", billingErr);
      }
      
      // Atualiza a nota do desmanche
      const reviews = await storage.getReviewsByDesmanche(reviewData.desmancheId);
      const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      await storage.updateDesmancheRating(reviewData.desmancheId, avgRating);
      
      res.status(201).json(review);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Create review error:", error);
      res.status(500).json({ message: "Erro ao criar avaliação" });
    }
  });
  
  // ============================================
  // DASHBOARD STATS
  // ============================================
  
  // Negociações pendentes (stale) para o admin
  app.get("/api/admin/negotiations/pending", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const pending = await storage.getStaleNegotiations();
      res.json(pending);
    } catch (error) {
      console.error("Error fetching pending negotiations:", error);
      res.status(500).json({ message: "Erro ao buscar negociações pendentes" });
    }
  });

  app.get("/api/dashboard/stats", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      console.error("Get dashboard stats error:", error);
      res.status(500).json({ message: "Erro ao buscar estatísticas" });
    }
  });
  
  // ============================================
  // FILE UPLOAD ROUTE
  // ============================================
  
  app.post("/api/orders/:id/images", authMiddleware, requireType(["client", "desmanche"]), (req, res, next) => {
    upload.array("photos", 10)(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Erro no upload: ${err.message}` });
      }
      if (err) return res.status(400).json({ message: err.message });
      next();
    });
  }, async (req, res) => {
    try {
      const reqUser = (req as any).user;
      const order = await storage.getOrderById((req.params.id as string));
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });
      const isOwner = reqUser.type === "desmanche"
        ? order.desmancheId === reqUser.id
        : order.clientId === reqUser.id;
      if (!isOwner) return res.status(403).json({ message: "Acesso negado" });
      const files = (req as any).files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ message: "Nenhum arquivo enviado" });
      const orderItemId = req.query.itemId as string | undefined;
      const images = await Promise.all(files.map(f => storage.createOrderImage(order.id, `/uploads/${f.filename}`, orderItemId)));
      res.json({ images });
    } catch (error) {
      console.error("Order image upload error:", error);
      res.status(500).json({ message: "Erro ao fazer upload das fotos" });
    }
  });

  app.post("/api/upload", authMiddleware, requireType(["desmanche", "admin"]), (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        return res.status(400).json({ message: `Erro no upload: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  }, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "Nenhum arquivo enviado" });
      }
      const fileUrl = `/uploads/${req.file.filename}`;
      res.json({ url: fileUrl, originalName: req.file.originalname });
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ message: "Erro ao fazer upload" });
    }
  });
  
  // ============================================
  // ADMIN ROUTES
  // ============================================
  
  app.get("/api/admin/users/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const user = await storage.getUserById(id);
      if (!user) return res.status(404).json({ message: "Usuário não encontrado" });

      const orders = await storage.getOrdersByClient(id);
      const negotiations = await storage.getNegotiationsByClient(id);

      const ordersWithCount = orders.map((o: any) => ({
        id: o.id,
        title: o.title,
        vehicleBrand: o.vehicleBrand,
        vehicleModel: o.vehicleModel,
        vehicleYear: o.vehicleYear,
        status: o.status,
        createdAt: o.createdAt,
        proposalCount: (o.proposals || []).length,
      }));

      const negotiationsDetail = negotiations.map((n: any) => ({
        id: n.id,
        status: n.status,
        agreedPrice: n.agreedPrice,
        createdAt: n.createdAt,
        orderTitle: n.order?.title || null,
        desmancheName: n.desmanche?.tradingName || n.desmanche?.companyName || null,
        desmancheRating: n.desmanche?.rating || null,
      }));

      res.json({
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        whatsapp: user.whatsapp,
        type: user.type,
        createdAt: user.createdAt,
        orders: ordersWithCount,
        negotiations: negotiationsDetail,
        stats: {
          totalOrders: orders.length,
          totalWithProposals: orders.filter((o: any) => (o.proposals || []).length > 0).length,
          totalNegotiating: negotiations.filter((n: any) => n.status === "negotiating").length,
          totalCompleted: negotiations.filter((n: any) => n.status === "completed").length,
          totalCancelled: negotiations.filter((n: any) => n.status === "cancelled").length,
        },
      });
    } catch (error) {
      console.error("Get admin user detail error:", error);
      res.status(500).json({ message: "Erro ao buscar usuário" });
    }
  });

  app.get("/api/admin/users", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map((u: any) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        type: u.type,
        status: u.status ?? "active",
        createdAt: u.createdAt,
      })));
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ message: "Erro ao buscar usuários" });
    }
  });

  app.patch("/api/admin/users/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body;
      if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ message: "Status inválido" });
      }
      storage.setUserStatus(id, status);
      res.json({ success: true, status });
    } catch (error) {
      console.error("Toggle user status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });
  
  app.get("/api/admin/orders/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const order = await storage.getOrderById(id);
      if (!order) return res.status(404).json({ message: "Pedido não encontrado" });

      const [proposals, negotiations, chatRooms] = await Promise.all([
        storage.getProposalsByOrder(id),
        storage.getNegotiationsByOrder ? storage.getNegotiationsByOrder(id) : Promise.resolve([]),
        storage.getChatRoomsByOrder(id),
      ]);

      // Get reviews per negotiation
      const negIds = (negotiations as any[]).map((n: any) => n.id);
      const reviews: any[] = [];
      for (const neg of negotiations as any[]) {
        if (neg.review) reviews.push({ ...neg.review, negotiationId: neg.id, desmancheName: neg.desmanche?.tradingName || neg.desmanche?.companyName });
      }

      res.json({
        ...order,
        proposals: (proposals as any[]).map((p: any) => ({
          id: p.id,
          price: p.price,
          message: p.message,
          status: p.status,
          createdAt: p.createdAt,
          whatsappUnlocked: p.whatsappUnlocked,
          desmanche: p.desmanche ? {
            id: p.desmanche.id,
            tradingName: p.desmanche.tradingName,
            companyName: p.desmanche.companyName,
            rating: p.desmanche.rating,
            phone: p.desmanche.phone,
            city: p.desmanche.city,
            state: p.desmanche.state,
          } : null,
        })),
        negotiations: (negotiations as any[]).map((n: any) => ({
          id: n.id,
          status: n.status,
          agreedPrice: n.agreedPrice,
          createdAt: n.createdAt,
          updatedAt: n.updatedAt,
          trackingCode: n.trackingCode,
          desmancheId: n.desmancheId,
          desmancheName: n.desmanche?.tradingName || n.desmanche?.companyName || null,
          desmanchePhone: n.desmanche?.phone || null,
          desmancheRating: n.desmanche?.rating || null,
          clientName: n.client?.name || null,
          clientEmail: n.client?.email || null,
        })),
        chatRooms: (chatRooms as any[]).map((r: any) => ({
          id: r.id,
          desmancheName: r.desmanche?.tradingName || r.desmanche?.companyName || null,
          clientName: r.client?.name || null,
          messageCount: r.messages?.length ?? 0,
          lastMessageAt: r.lastMessageAt,
          lastMessage: r.messages?.[0] ? {
            content: r.messages[0].content,
            senderType: r.messages[0].senderType,
            createdAt: r.messages[0].createdAt,
          } : null,
        })),
        reviews,
      });
    } catch (error) {
      console.error("Get admin order detail error:", error);
      res.status(500).json({ message: "Erro ao buscar pedido" });
    }
  });

  app.get("/api/admin/orders", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const orders = await storage.getAllOrders();
      res.json(orders);
    } catch (error) {
      console.error("Get admin orders error:", error);
      res.status(500).json({ message: "Erro ao buscar pedidos" });
    }
  });
  
  app.get("/api/admin/desmanches/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const desmanche = await storage.getDesmancheById(id);
      if (!desmanche) return res.status(404).json({ message: "Desmanche não encontrado" });
      const address = await storage.getDesmancheAddressByDesmancheId(id);
      const docs = await storage.getDocumentsByDesmanche(id);
      const negotiations = await storage.getNegotiationsByDesmanche(id);
      const reviews = await storage.getReviewsByDesmanche(id);
      const billing = await storage.getDesmancheBilling(id);
      const transactions = await storage.getBillingTransactionsByDesmanche(id);

      const negotiationsWithClient = await Promise.all(negotiations.map(async (neg: any) => {
        const order = neg.order || null;
        const client = neg.client || null;
        return { ...neg, order, client };
      }));

      res.json({
        ...desmanche,
        password: undefined,
        address,
        documents: docs,
        negotiations: negotiationsWithClient,
        reviews,
        billing: billing || null,
        billingTransactions: transactions,
        totalPaid: transactions.filter((t: any) => t.status === "paid").reduce((s: number, t: any) => s + t.amount, 0),
        totalPending: transactions.filter((t: any) => t.status === "pending").reduce((s: number, t: any) => s + t.amount, 0),
      });
    } catch (error) {
      console.error("Get admin desmanche detail error:", error);
      res.status(500).json({ message: "Erro ao buscar desmanche" });
    }
  });

  app.patch("/api/admin/desmanches/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { status, rejectionReason } = req.body;
      if (!["active", "inactive", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      await storage.updateDesmancheStatus(id, status, rejectionReason);
      const updated = await storage.getDesmancheById(id);
      res.json({ ...updated, password: undefined });
    } catch (error) {
      console.error("Update desmanche status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  app.get("/api/admin/desmanches", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { status } = req.query;
      const desmanches = await storage.getAllDesmanches({ status: status as string });
      const result = await Promise.all(desmanches.map(async (d) => {
        const address = await storage.getDesmancheAddressByDesmancheId(d.id);
        const docs = await storage.getDocumentsByDesmanche(d.id);
        return {
          ...d,
          password: undefined,
          address,
          documents: docs,
        };
      }));
      res.json(result);
    } catch (error) {
      console.error("Get admin desmanches error:", error);
      res.status(500).json({ message: "Erro ao buscar desmanches" });
    }
  });
  
  // ============================================
  // CHAT ROUTES
  // ============================================

  app.get("/api/chat/rooms", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;

      let rooms: any[];
      if (userType === "desmanche") {
        rooms = await storage.getChatRoomsByDesmanche(userId);
      } else {
        rooms = await storage.getChatRoomsByClient(userId);
      }

      const roomsWithUnread = await Promise.all(
        rooms.map(async (room: any) => {
          const unread = await storage.countUnreadMessages(room.id, userId);
          return { ...room, unreadCount: unread };
        })
      );
      res.json(roomsWithUnread);
    } catch (error) {
      console.error("Get chat rooms error:", error);
      res.status(500).json({ message: "Erro ao buscar conversas" });
    }
  });

  app.get("/api/chat/rooms/:roomId/messages", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const room = await storage.getChatRoomById((req.params.roomId as string));

      if (!room) return res.status(404).json({ message: "Conversa não encontrada" });

      if (userType === "client" && room.clientId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userType === "desmanche" && room.desmancheId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      await storage.markRoomMessagesAsRead((req.params.roomId as string), userId);
      const messages = await storage.getMessagesByRoom((req.params.roomId as string));
      res.json(messages);
    } catch (error) {
      console.error("Get messages error:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  app.post("/api/chat/rooms/:roomId/messages", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const { content } = req.body;

      if (!content || !content.trim()) {
        return res.status(400).json({ message: "Mensagem não pode ser vazia" });
      }

      const room = await storage.getChatRoomById((req.params.roomId as string));
      if (!room) return res.status(404).json({ message: "Conversa não encontrada" });

      if (userType === "client" && room.clientId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }
      if (userType === "desmanche" && room.desmancheId !== userId) {
        return res.status(403).json({ message: "Acesso negado" });
      }

      const senderType = userType === "desmanche" ? "desmanche" : "client";
      const message = await storage.createChatMessage({
        roomId: (req.params.roomId as string),
        senderId: userId,
        senderType,
        content: content.trim(),
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Create message error:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  // ============================================
  // PRE-PROPOSAL CHAT (conversa antes de enviar proposta)
  // ============================================

  // Desmanche inicia ou recupera sala + envia mensagem
  app.post("/api/pre-proposal-chat/start", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { orderId, orderItemId, clientId, content } = req.body;
      if (!orderId || !clientId || !content?.trim()) {
        return res.status(400).json({ message: "orderId, clientId e content são obrigatórios" });
      }
      const room = await storage.getOrCreatePreProposalRoom({ orderId, orderItemId, clientId, desmancheId });
      if (!room) return res.status(500).json({ message: "Erro ao criar sala" });
      const message = await storage.createPreProposalMessage({
        roomId: room.id,
        senderId: desmancheId,
        senderType: "desmanche",
        content: content.trim(),
      });
      res.status(201).json({ room, message });
    } catch (error) {
      console.error("Pre-proposal chat start error:", error);
      res.status(500).json({ message: "Erro ao iniciar conversa" });
    }
  });

  // Listar salas do usuário logado
  app.get("/api/pre-proposal-chat/rooms", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      let rooms: any[];
      if (userType === "desmanche") {
        rooms = await storage.getPreProposalRoomsByDesmanche(userId);
      } else {
        rooms = await storage.getPreProposalRoomsByClient(userId);
      }
      res.json(rooms);
    } catch (error) {
      console.error("Pre-proposal chat rooms error:", error);
      res.status(500).json({ message: "Erro ao buscar conversas" });
    }
  });

  // Mensagens de uma sala específica (marca como lido)
  app.get("/api/pre-proposal-chat/:roomId/messages", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const room = await storage.getPreProposalRoomById((req.params.roomId as string));
      if (!room) return res.status(404).json({ message: "Conversa não encontrada" });
      if (userType === "client" && room.clientId !== userId) return res.status(403).json({ message: "Acesso negado" });
      if (userType === "desmanche" && room.desmancheId !== userId) return res.status(403).json({ message: "Acesso negado" });
      await storage.markPreProposalMessagesAsRead((req.params.roomId as string), userId);
      const messages = await storage.getPreProposalMessages((req.params.roomId as string));
      res.json(messages);
    } catch (error) {
      console.error("Pre-proposal messages error:", error);
      res.status(500).json({ message: "Erro ao buscar mensagens" });
    }
  });

  // Enviar mensagem em sala existente (cliente ou desmanche)
  app.post("/api/pre-proposal-chat/:roomId/messages", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const userType = (req as any).user.type;
      const { content } = req.body;
      if (!content?.trim()) return res.status(400).json({ message: "Mensagem não pode ser vazia" });
      const room = await storage.getPreProposalRoomById((req.params.roomId as string));
      if (!room) return res.status(404).json({ message: "Conversa não encontrada" });
      if (userType === "client" && room.clientId !== userId) return res.status(403).json({ message: "Acesso negado" });
      if (userType === "desmanche" && room.desmancheId !== userId) return res.status(403).json({ message: "Acesso negado" });
      const message = await storage.createPreProposalMessage({
        roomId: room.id,
        senderId: userId,
        senderType: userType === "desmanche" ? "desmanche" : "client",
        content: content.trim(),
      });
      res.status(201).json(message);
    } catch (error) {
      console.error("Pre-proposal send message error:", error);
      res.status(500).json({ message: "Erro ao enviar mensagem" });
    }
  });

  // Contagem de não lidas para o usuário logado
  app.get("/api/pre-proposal-chat/unread-count", authMiddleware, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const count = await storage.countUnreadPreProposalMessages(userId);
      res.json({ count });
    } catch (error) {
      res.status(500).json({ count: 0 });
    }
  });

  // ============================================
  // NEGOTIATION - SHIP / RECEIVED
  // ============================================

  app.patch("/api/negotiations/:id/ship", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { trackingCode } = req.body;
      const negotiation = await storage.getNegotiationById((req.params.id as string));
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      if (negotiation.desmancheId !== desmancheId) return res.status(403).json({ message: "Acesso negado" });
      if (negotiation.status !== "negotiating") {
        return res.status(400).json({ message: "Negociação não está no status correto para marcar envio" });
      }
      const updated = await storage.updateNegotiationStatus((req.params.id as string), "shipped", trackingCode);
      const desmancheActor = (req as any).user;
      storage.logActivity({
        action: "negotiation_shipped",
        actorType: "desmanche",
        actorId: desmancheId,
        actorName: desmancheActor.name || desmancheActor.tradingName || desmancheId,
        targetType: "negotiation",
        targetId: (req.params.id as string),
        description: `Envio marcado pelo desmanche${trackingCode ? ` — Rastreio: ${trackingCode}` : ""}`,
      });
      res.json(updated);
    } catch (error) {
      console.error("Ship negotiation error:", error);
      res.status(500).json({ message: "Erro ao marcar envio" });
    }
  });

  app.patch("/api/negotiations/:id/received", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const negotiation = await storage.getNegotiationById((req.params.id as string));
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      if (negotiation.clientId !== clientId) return res.status(403).json({ message: "Acesso negado" });
      if (negotiation.status !== "shipped") {
        return res.status(400).json({ message: "Negociação não está no status correto" });
      }
      const reviewDeadlineDays = await storage.getSystemSettingNumber("reviewDeadlineDays", 10);
      const updated = await storage.setNegotiationReceived((req.params.id as string), reviewDeadlineDays);
      const clientActor = (req as any).user;
      storage.logActivity({
        action: "negotiation_received",
        actorType: "client",
        actorId: clientId,
        actorName: clientActor.name || clientId,
        targetType: "negotiation",
        targetId: (req.params.id as string),
        description: `Cliente ${clientActor.name || clientId} confirmou recebimento da negociação`,
      });
      res.json(updated);
    } catch (error) {
      console.error("Received negotiation error:", error);
      res.status(500).json({ message: "Erro ao confirmar recebimento" });
    }
  });

  // Resposta do desmanche sobre negociação parada
  app.patch("/api/negotiations/:id/stale-desmanche-response", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { response } = req.body;
      if (!["sold", "not_sold", "still_negotiating"].includes(response)) {
        return res.status(400).json({ message: "Resposta inválida" });
      }
      const negotiation = await storage.getNegotiationById((req.params.id as string));
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      if (negotiation.desmancheId !== desmancheId) return res.status(403).json({ message: "Acesso negado" });
      if (negotiation.status !== "stale_awaiting_desmanche") {
        return res.status(400).json({ message: "Negociação não está aguardando resposta do desmanche" });
      }
      const updated = await storage.respondStaleAsDesmanche((req.params.id as string), response);
      res.json(updated);
    } catch (error) {
      console.error("Stale desmanche response error:", error);
      res.status(500).json({ message: "Erro ao processar resposta" });
    }
  });

  // Resposta do cliente sobre negociação parada
  app.patch("/api/negotiations/:id/stale-client-response", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const { response } = req.body;
      if (!["received", "not_received"].includes(response)) {
        return res.status(400).json({ message: "Resposta inválida" });
      }
      const negotiation = await storage.getNegotiationById((req.params.id as string));
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      if (negotiation.clientId !== clientId) return res.status(403).json({ message: "Acesso negado" });
      if (negotiation.status !== "stale_awaiting_client") {
        return res.status(400).json({ message: "Negociação não está aguardando confirmação do cliente" });
      }
      const reviewDeadlineDays = await storage.getSystemSettingNumber("reviewDeadlineDays", 10);
      const { negotiation: updated, divergence } = await storage.respondStaleAsClient((req.params.id as string), response, reviewDeadlineDays);
      // Billing: both agree on sale → will fire on review submit / auto-expire (standard flow)
      // Divergence → in_moderation: admin will decide billing on resolution
      // Both agree nothing happened → cancelled: no billing

      if (divergence && updated) {
        const clientUser = await storage.getUserById(negotiation.clientId);
        const desmanche = updated.desmanche;
        const orderTitle = updated.order?.title || "Pedido sem título";
        if (clientUser && desmanche?.email) {
          email.sendModerationNotificationEmail({
            clientEmail: clientUser.email,
            clientName: clientUser.name,
            desmancheEmail: desmanche.email,
            desmancheName: desmanche.tradingName,
            orderTitle,
            negotiationId: updated.id,
          }).catch((err) => console.error("Moderation email send error:", err));
        }
      }

      res.json({ negotiation: updated, divergence });
    } catch (error) {
      console.error("Stale client response error:", error);
      res.status(500).json({ message: "Erro ao processar resposta" });
    }
  });

  // Admin: listar negociações em moderação
  app.get("/api/admin/negotiations/moderation", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const negs = await storage.getModerationNegotiations();
      res.json(negs);
    } catch (error) {
      console.error("Get moderation negotiations error:", error);
      res.status(500).json({ message: "Erro ao buscar negociações em moderação" });
    }
  });

  // Admin: histórico de negociações resolvidas via moderação
  app.get("/api/admin/negotiations/moderation/resolved", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { dateFrom, dateTo, resolution, desmancheName, clientName } = req.query as Record<string, string | undefined>;
      if (dateFrom && isNaN(Date.parse(dateFrom))) {
        return res.status(400).json({ message: "Formato de data inválido para 'dateFrom'" });
      }
      if (dateTo && isNaN(Date.parse(dateTo))) {
        return res.status(400).json({ message: "Formato de data inválido para 'dateTo'" });
      }
      const validResolution = resolution === 'sold' || resolution === 'cancelled' ? resolution : undefined;
      const negs = await storage.getResolvedModerationNegotiations({
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        resolution: validResolution,
        desmancheName: desmancheName || undefined,
        clientName: clientName || undefined,
      });
      res.json(negs);
    } catch (error) {
      console.error("Get resolved moderation negotiations error:", error);
      res.status(500).json({ message: "Erro ao buscar histórico de moderação" });
    }
  });

  // Admin: resolver negociação em moderação
  app.post("/api/admin/negotiations/moderation/:id/resolve", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { resolution } = req.body;
      if (!["sold", "cancelled"].includes(resolution)) {
        return res.status(400).json({ message: "Resolução inválida. Use 'sold' ou 'cancelled'." });
      }
      const negotiation = await storage.getNegotiationById(id);
      if (!negotiation) return res.status(404).json({ message: "Negociação não encontrada" });
      if (negotiation.status !== "in_moderation") {
        return res.status(400).json({ message: "Negociação não está em moderação" });
      }
      const reviewDeadlineDays = await storage.getSystemSettingNumber("reviewDeadlineDays", 10);
      const adminId = (req as any).user.id as string;
      const updated = await storage.resolveModerationNegotiation(id, resolution, reviewDeadlineDays, adminId);
      // Billing fires immediately on admin confirmation of sale.
      // The idempotency guard in triggerTransactionBilling prevents double-charging if
      // review submission or auto-expiry also attempt to charge the same negotiation.
      if (resolution === "sold") {
        try {
          await triggerTransactionBilling(negotiation.desmancheId, negotiation.id);
        } catch (billingErr) {
          console.error("Billing on moderation resolution error:", billingErr);
        }
      }
      res.json(updated);
    } catch (error) {
      console.error("Resolve moderation error:", error);
      res.status(500).json({ message: "Erro ao resolver negociação" });
    }
  });

  // Endpoint para checar bloqueio do cliente (usado no frontend)
  app.get("/api/client/review-block-status", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const maxOverdue = await storage.getSystemSettingNumber("maxOverdueBeforeBlock", 1);
      const overdueCount = await storage.getOverdueReviewCountForClient(clientId);
      const isBlocked = overdueCount >= maxOverdue;
      const pending = isBlocked ? await storage.getPendingReviewsForClient(clientId) : [];
      res.json({ isBlocked, overdueCount, pendingReviews: pending });
    } catch (error) {
      res.status(500).json({ message: "Erro" });
    }
  });

  // Endpoint para checar bloqueio do desmanche
  app.get("/api/desmanche/review-block-status", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const maxOverdue = await storage.getSystemSettingNumber("maxOverdueBeforeBlock", 1);
      const overdueCount = await storage.getOverdueReviewCountForDesmanche(desmancheId);
      const isBlocked = overdueCount >= maxOverdue;
      res.json({ isBlocked, overdueCount });
    } catch (error) {
      res.status(500).json({ message: "Erro" });
    }
  });

  // ============================================
  // ADMIN USER MANAGEMENT (PERMISSIONS)
  // ============================================

  app.get("/api/admin/admin-users", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const callerPerms = storage.getAdminPermissions((req as any).user.id);
      if (callerPerms !== null) {
        return res.status(403).json({ message: "Apenas super-admins podem gerenciar permissões" });
      }
      const admins = storage.getAdminUsers();
      const mapped = admins.map((a: any) => ({
        ...a,
        permissions: a.permissions ? JSON.parse(a.permissions) : null,
      }));
      res.json(mapped);
    } catch (error) {
      res.status(500).json({ message: "Erro ao listar admins" });
    }
  });

  app.post("/api/admin/admin-users", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const callerPerms = storage.getAdminPermissions((req as any).user.id);
      if (callerPerms !== null) {
        return res.status(403).json({ message: "Apenas super-admins podem criar admins" });
      }
      const { name, email, phone, password, permissions } = req.body;
      if (!name?.trim() || !email?.trim() || !password?.trim()) {
        return res.status(400).json({ message: "Nome, email e senha são obrigatórios" });
      }
      const existing = await storage.getUserByEmail(email.trim());
      if (existing) return res.status(409).json({ message: "Email já cadastrado" });

      const created = await storage.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone?.trim() || "",
        password: password,
        type: "admin",
      });

      if (!created) {
        return res.status(500).json({ message: "Erro ao criar admin" });
      }

      if (permissions && Array.isArray(permissions)) {
        storage.setAdminPermissions(created.id, permissions);
      }

      res.status(201).json({ id: created.id, name: created.name, email: created.email });
    } catch (error) {
      console.error("Create admin error:", error);
      res.status(500).json({ message: "Erro ao criar admin" });
    }
  });

  app.patch("/api/admin/admin-users/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const callerPerms = storage.getAdminPermissions((req as any).user.id);
      if (callerPerms !== null) {
        return res.status(403).json({ message: "Apenas super-admins podem editar permissões" });
      }
      const { id } = req.params as { id: string };
      const { permissions, name } = req.body;

      if (name) {
        storage.updateAdminUser(id, { name });
      }
      if (permissions !== undefined) {
        storage.setAdminPermissions(id, permissions);
      }

      const admins = storage.getAdminUsers();
      const updated = admins.find((a: any) => a.id === id);
      if (!updated) return res.status(404).json({ message: "Admin não encontrado" });
      res.json({ ...updated, permissions: updated.permissions ? JSON.parse(updated.permissions) : null });
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar admin" });
    }
  });

  app.patch("/api/admin/admin-users/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const callerPerms = storage.getAdminPermissions((req as any).user.id);
      if (callerPerms !== null) {
        return res.status(403).json({ message: "Apenas super-admins podem alterar status de admins" });
      }
      const { id } = req.params as { id: string };
      const { status } = req.body;
      if (status !== "active" && status !== "inactive") {
        return res.status(400).json({ message: "Status inválido" });
      }
      if (id === (req as any).user.id) {
        return res.status(400).json({ message: "Você não pode desativar sua própria conta" });
      }
      storage.setUserStatus(id, status);
      res.json({ success: true, status });
    } catch (error) {
      console.error("Toggle admin status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status do admin" });
    }
  });

  app.delete("/api/admin/admin-users/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const callerPerms = storage.getAdminPermissions((req as any).user.id);
      if (callerPerms !== null) {
        return res.status(403).json({ message: "Apenas super-admins podem remover admins" });
      }
      const { id } = req.params as { id: string };
      if (id === (req as any).user.id) {
        return res.status(400).json({ message: "Você não pode remover sua própria conta" });
      }
      storage.deleteAdminUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao remover admin" });
    }
  });

  // ============================================
  // COMPLAINTS / FEEDBACK
  // ============================================

  app.get("/api/complaints/my-desmanches", authMiddleware, requireType(["client"]), async (req, res) => {
    try {
      const clientId = (req as any).user.id;
      const result = await storage.getDesmanchesByClientInteractions(clientId);
      res.json(result);
    } catch (error) {
      console.error("Get my desmanches error:", error);
      res.status(500).json({ message: "Erro ao buscar desmanches" });
    }
  });

  app.post("/api/complaints", authMiddleware, async (req, res) => {
    try {
      const { type, subject, message, targetType, targetId, targetDescription, desmancheId } = req.body;
      if (!type || !["denuncia", "sugestao", "reclamacao"].includes(type)) {
        return res.status(400).json({ message: "Tipo inválido. Use: denuncia, sugestao ou reclamacao" });
      }
      if (!subject?.trim()) return res.status(400).json({ message: "Assunto obrigatório" });
      if (!message?.trim()) return res.status(400).json({ message: "Mensagem obrigatória" });

      const authorId = (req as any).user.id;
      const authorType = (req as any).user.type; // "client" or "desmanche"

      let authorName = "";
      if (authorType === "client" || authorType === "admin") {
        const u = await storage.getUserById(authorId);
        authorName = u?.name || "";
      } else if (authorType === "desmanche") {
        const d = await storage.getDesmancheById(authorId);
        authorName = d?.tradingName || d?.companyName || "";
      }

      const complaint = storage.createComplaint({
        type, subject: subject.trim(), message: message.trim(),
        authorId, authorType: authorType === "admin" ? "client" : authorType,
        authorName, targetType, targetId, targetDescription, desmancheId,
      });

      res.status(201).json(complaint);
    } catch (error) {
      console.error("Create complaint error:", error);
      res.status(500).json({ message: "Erro ao registrar" });
    }
  });

  app.get("/api/complaints/my", authMiddleware, async (req, res) => {
    try {
      const authorId = (req as any).user.id;
      const complaints = storage.getComplaintsByAuthor(authorId);
      res.json(complaints);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar" });
    }
  });

  app.get("/api/admin/complaints", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { type, status } = req.query as any;
      const complaints = storage.getAllComplaints({ type, status });
      res.json(complaints);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar reclamações" });
    }
  });

  app.patch("/api/admin/complaints/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { status, adminNotes } = req.body;
      const valid = ["pending", "reviewing", "resolved", "dismissed"];
      if (status && !valid.includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      const updated = storage.updateComplaintStatus(id, status, adminNotes);
      if (!updated) return res.status(404).json({ message: "Não encontrado" });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar" });
    }
  });

  // ============================================
  // ADMIN: CRIAR CLIENTE / DESMANCHE
  // ============================================

  app.post("/api/admin/create-client", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { name, email, phone, password } = req.body;
      if (!name || !email || !phone || !password) {
        return res.status(400).json({ message: "Nome, e-mail, telefone e senha são obrigatórios" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "E-mail já cadastrado" });

      const user = await storage.createUser({ name, email, phone, password, type: "client" });
      if (!user) return res.status(500).json({ message: "Erro ao criar cliente" });

      // Marca e-mail como verificado imediatamente
      storage.markEmailVerified(user.id);

      res.status(201).json({
        message: "Cliente cadastrado com sucesso",
        user: { id: user.id, name: user.name, email: user.email, phone: user.phone, type: user.type },
      });
    } catch (error) {
      console.error("Admin create client error:", error);
      res.status(500).json({ message: "Erro ao criar cliente" });
    }
  });

  app.post("/api/admin/create-desmanche", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const {
        companyName, tradingName, cnpj, email, phone, password,
        responsibleName, responsibleCpf, vehicleTypes,
        // endereço (opcional)
        zipCode, street, number, complement, city, state,
      } = req.body;

      if (!companyName || !tradingName || !cnpj || !email || !phone || !password) {
        return res.status(400).json({ message: "Campos obrigatórios: Razão Social, Nome Fantasia, CNPJ, E-mail, Telefone e Senha" });
      }
      if (password.length < 6) {
        return res.status(400).json({ message: "A senha deve ter pelo menos 6 caracteres" });
      }

      const existingEmail = await storage.getDesmancheByEmail(email);
      if (existingEmail) return res.status(400).json({ message: "E-mail já cadastrado" });

      const existingCnpj = await storage.getDesmancheByCnpj(cnpj);
      if (existingCnpj) return res.status(400).json({ message: "CNPJ já cadastrado" });

      // Cria já como ativo
      const desmanche = await storage.createDesmanche({
        companyName, tradingName,
        cnpj: cnpj.replace(/\D/g, ""),
        email, phone, password,
        responsibleName: responsibleName || undefined,
        responsibleCpf: responsibleCpf || undefined,
        vehicleTypes: JSON.stringify(vehicleTypes || []),
        plan: "monthly",
        status: "active",
      } as any);

      if (!desmanche) return res.status(500).json({ message: "Erro ao criar desmanche" });

      // Cria endereço se fornecido
      if (city && state && street && zipCode) {
        await storage.createOrUpdateDesmancheAddress(desmanche.id, { zipCode, street, number, complement, city, state });
      }

      res.status(201).json({
        message: "Desmanche cadastrado e ativado com sucesso",
        desmanche: { id: desmanche.id, tradingName: desmanche.tradingName, email: desmanche.email, status: desmanche.status },
      });
    } catch (error) {
      console.error("Admin create desmanche error:", error);
      res.status(500).json({ message: "Erro ao criar desmanche" });
    }
  });

  // ============================================
  // LICENSE ALERTS
  // ============================================

  // Desmanche: checks own Detran license expiry
  app.get("/api/desmanche/license-alert", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const alertDays = await storage.getSystemSettingNumber("licenseAlertDays", 30);
      const docs = await storage.getDocumentsByDesmanche(desmancheId);
      const detranDocs = docs.filter((d: any) => d.type === "credenciamento_detran" && d.validUntil);
      const now = Date.now();
      const thresholdMs = alertDays * 24 * 60 * 60 * 1000;
      const alerts = detranDocs.map((d: any) => {
        const validUntilMs = d.validUntil instanceof Date ? d.validUntil.getTime() : new Date(d.validUntil).getTime();
        const daysLeft = Math.ceil((validUntilMs - now) / (24 * 60 * 60 * 1000));
        return { id: d.id, name: d.name, validUntil: d.validUntil, daysLeft, expired: daysLeft < 0 };
      }).filter((d: any) => d.daysLeft <= alertDays);
      res.json({ alerts, alertDays });
    } catch (error) {
      console.error("License alert error:", error);
      res.status(500).json({ message: "Erro ao verificar licenças" });
    }
  });

  // Admin: returns all desmanches with expiring/expired Detran licenses
  app.get("/api/admin/license-alerts", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const alertDays = await storage.getSystemSettingNumber("licenseAlertDays", 30);
      const desmanches = await storage.getAllDesmanches();
      const now = Date.now();
      const thresholdMs = alertDays * 24 * 60 * 60 * 1000;
      const results = await Promise.all(desmanches.map(async (dm: any) => {
        const docs = await storage.getDocumentsByDesmanche(dm.id);
        const detranDocs = docs.filter((d: any) => d.type === "credenciamento_detran" && d.validUntil);
        const alerts = detranDocs.map((d: any) => {
          const validUntilMs = d.validUntil instanceof Date ? d.validUntil.getTime() : new Date(d.validUntil).getTime();
          const daysLeft = Math.ceil((validUntilMs - now) / (24 * 60 * 60 * 1000));
          return { id: d.id, name: d.name, validUntil: d.validUntil, daysLeft, expired: daysLeft < 0 };
        }).filter((d: any) => d.daysLeft <= alertDays);
        return { desmanche: { id: dm.id, companyName: dm.companyName, tradingName: dm.tradingName }, alerts };
      }));
      const withAlerts = results.filter((r: any) => r.alerts.length > 0);
      res.json({ items: withAlerts, alertDays });
    } catch (error) {
      console.error("Admin license alerts error:", error);
      res.status(500).json({ message: "Erro ao verificar licenças" });
    }
  });

  // ============================================
  // BILLING / ASAAS ROUTES
  // ============================================

  app.get("/api/billing/my", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      let billing = await storage.getDesmancheBilling(desmancheId);
      // Auto-create billing record with default monthly_cycle model if not set up yet
      if (!billing) {
        billing = await storage.createOrUpdateDesmancheBilling(desmancheId, { billingModel: "monthly_cycle" });
      }
      const transactions = await storage.getBillingTransactionsByDesmanche(desmancheId);
      const capAmount = await storage.getSystemSettingNumber("monthlyCapAmount", 200);
      const perTxAmount = await storage.getSystemSettingNumber("perTransactionAmount", 25);
      const monthlyProposalCount = await storage.getMonthlyProposalCountForDesmanche(desmancheId);

      // Compute cycle info for monthly_cycle model
      let cycleInfo = null;
      if (billing && billing.billingModel === "monthly_cycle") {
        const periodStart = billing.currentPeriodStart && Number(billing.currentPeriodStart) > 0
          ? new Date(Number(billing.currentPeriodStart) * 1000)
          : null;
        const cycleCloseDate = periodStart
          ? new Date(periodStart.getTime() + 30 * 24 * 60 * 60 * 1000)
          : null;
        cycleInfo = {
          periodStart: periodStart ? periodStart.toISOString() : null,
          cycleCloseDate: cycleCloseDate ? cycleCloseDate.toISOString() : null,
          accumulatedAmount: billing.monthlyAmountPaid || 0,
          transactionCount: billing.monthlyTransactionCount || 0,
        };
      }

      res.json({
        billing: billing || null,
        transactions,
        settings: { capAmount, perTxAmount },
        asaasConfigured: asaas.isAsaasConfigured(),
        monthlyProposalCount,
        cycleInfo,
      });
    } catch (error) {
      console.error("Get billing error:", error);
      res.status(500).json({ message: "Erro ao buscar cobrança" });
    }
  });

  app.post("/api/billing/setup", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { billingModel, planId } = req.body;
      if (!billingModel || !["subscription", "per_transaction", "monthly_cycle"].includes(billingModel)) {
        return res.status(400).json({ message: "Modelo de cobrança inválido" });
      }
      if (billingModel === "subscription" && !planId) {
        return res.status(400).json({ message: "Plano obrigatório para assinatura" });
      }
      const desmanche = await storage.getDesmancheById(desmancheId);
      if (!desmanche) return res.status(404).json({ message: "Desmanche não encontrado" });

      let asaasCustomerId: string | undefined;
      if (asaas.isAsaasConfigured()) {
        const customer = await asaas.createAsaasCustomer({
          name: desmanche.companyName,
          email: desmanche.email,
          phone: desmanche.phone,
          cpfCnpj: desmanche.cnpj,
        });
        if (customer && !("error" in customer)) asaasCustomerId = customer.id;
      }

      const billing = await storage.createOrUpdateDesmancheBilling(desmancheId, {
        billingModel,
        planId: planId || null,
        asaasCustomerId,
      });
      res.json(billing);
    } catch (error) {
      console.error("Billing setup error:", error);
      res.status(500).json({ message: "Erro ao configurar cobrança" });
    }
  });

  // Webhook Asaas - confirma pagamento
  app.post("/api/billing/webhook", async (req, res) => {
    try {
      const { event, payment } = req.body;
      if (event === "PAYMENT_RECEIVED" || event === "PAYMENT_CONFIRMED") {
        if (payment?.id) {
          // Update ALL transactions sharing this charge ID (consolidated monthly charges
          // link multiple transactions to a single Asaas charge)
          const allTx = await storage.getAllBillingTransactions();
          const matching = allTx.filter((t: any) => t.asaasChargeId === payment.id);
          for (const tx of matching) {
            await storage.updateBillingTransactionStatus(tx.id, "paid");
          }
          if (matching.length > 0) {
            console.log(`[webhook] Marked ${matching.length} transaction(s) as paid for charge ${payment.id}`);
          }
        }
      }
      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Erro no webhook" });
    }
  });

  // Gerar/retentar cobrança Asaas para transação pendente sem link
  app.post("/api/billing/transactions/:txId/charge", authMiddleware, requireType(["desmanche"]), async (req, res) => {
    try {
      const desmancheId = (req as any).user.id;
      const { txId } = req.params as { txId: string };

      const allTx = await storage.getBillingTransactionsByDesmanche(desmancheId);
      const tx = allTx.find((t: any) => t.id === txId);
      if (!tx) return res.status(404).json({ message: "Transação não encontrada" });
      if (tx.status !== "pending") return res.status(400).json({ message: "Transação não está pendente" });
      // Monthly-cycle transactions are consolidated into a single charge at cycle close — cannot be charged individually
      if (tx.type === "monthly_cycle") return res.status(400).json({ message: "Transações do ciclo mensal são faturadas automaticamente no fechamento do ciclo. Não é possível gerar cobrança individual." });
      if (tx.asaasChargeId) return res.status(400).json({ message: "Cobrança já existe no Asaas" });
      if (!asaas.isAsaasConfigured()) return res.status(400).json({ message: "Asaas não configurado" });

      let billing = await storage.getDesmancheBilling(desmancheId);
      if (!billing) return res.status(404).json({ message: "Dados de cobrança não encontrados" });

      // Se não tem cliente Asaas, cria agora
      if (!billing.asaasCustomerId) {
        const desmanche = await storage.getDesmancheById(desmancheId);
        if (!desmanche) return res.status(404).json({ message: "Desmanche não encontrado" });
        const customer = await asaas.createAsaasCustomer({
          name: desmanche.companyName,
          email: desmanche.email,
          phone: desmanche.phone,
          cpfCnpj: desmanche.cnpj,
        });
        if (!customer) return res.status(502).json({ message: "Erro de conexão com o Asaas. Tente novamente." });
        if ("error" in customer) {
          return res.status(422).json({ message: `Asaas: ${customer.error}. Verifique o CNPJ no Perfil da Empresa.` });
        }
        billing = await storage.createOrUpdateDesmancheBilling(desmancheId, { asaasCustomerId: customer.id });
      }

      const charge = await asaas.createAsaasCharge({
        customerId: billing!.asaasCustomerId!,
        value: tx.amount,
        dueDate: asaas.getDueDateString(3),
        description: tx.description || `Central dos Desmanches — transação #${txId.slice(0, 8)}`,
        billingType: "UNDEFINED",
      });
      if (!charge) return res.status(502).json({ message: "Erro ao criar cobrança no Asaas" });

      const paymentLink = charge.invoiceUrl || charge.bankSlipUrl;
      await storage.updateBillingTransactionStatus(txId, "pending", charge.id, paymentLink);

      res.json({ asaasChargeId: charge.id, paymentLink });
    } catch (error) {
      console.error("Retry charge error:", error);
      res.status(500).json({ message: "Erro ao gerar cobrança" });
    }
  });

  // ============================================
  // SUBSCRIPTION PLANS (ADMIN)
  // ============================================

  app.get("/api/subscription-plans", async (req, res) => {
    try {
      let onlyActive = true;
      const token = req.headers.authorization?.replace("Bearer ", "");
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded?.type === "admin") onlyActive = false;
        } catch {}
      }
      const plans = await storage.getAllSubscriptionPlans(onlyActive);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar planos" });
    }
  });

  app.post("/api/subscription-plans", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const data = schema.insertSubscriptionPlanSchema.parse(req.body);
      const plan = await storage.createSubscriptionPlan(data);
      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      res.status(500).json({ message: "Erro ao criar plano" });
    }
  });

  app.patch("/api/subscription-plans/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const plan = await storage.updateSubscriptionPlan((req.params.id as string), req.body);
      res.json(plan);
    } catch (error) {
      res.status(500).json({ message: "Erro ao atualizar plano" });
    }
  });

  app.delete("/api/subscription-plans/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      await storage.deleteSubscriptionPlan((req.params.id as string));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Erro ao deletar plano" });
    }
  });

  // ============================================
  // SYSTEM SETTINGS (ADMIN)
  // ============================================

  app.get("/api/admin/settings", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const settings = await storage.getAllSystemSettings();
      const obj: Record<string, string> = {};
      for (const s of settings) obj[s.key] = s.value;
      res.json(obj);
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar configurações" });
    }
  });

  app.patch("/api/admin/settings", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const allowed = ["reviewDeadlineDays", "maxOverdueBeforeBlock", "perTransactionAmount", "monthlyCapAmount", "asaasApiKey", "asaasEnvironment", "licenseAlertDays", "staleNegotiationDays"];
      const numericRanges: Record<string, [number, number]> = {
        reviewDeadlineDays: [1, 90],
        maxOverdueBeforeBlock: [1, 100],
        perTransactionAmount: [1, 1000],
        monthlyCapAmount: [1, 10000],
        licenseAlertDays: [1, 365],
        staleNegotiationDays: [1, 365],
      };
      for (const [key, value] of Object.entries(req.body)) {
        if (allowed.includes(key)) {
          if (key in numericRanges) {
            const num = Number(value);
            const [min, max] = numericRanges[key];
            if (isNaN(num) || num < min || num > max) {
              return res.status(400).json({ message: `${key} deve ser um número entre ${min} e ${max}` });
            }
          }
          await storage.setSystemSetting(key, String(value));
        }
      }
      // Apply Asaas config dynamically if updated
      const apiKey = await storage.getSystemSetting("asaasApiKey");
      const env = await storage.getSystemSetting("asaasEnvironment");
      asaas.setAsaasConfig(apiKey || "", env || "sandbox");

      const settingsAdmin = (req as any).user;
      const changedKeys = Object.keys(req.body).filter((k) => allowed.includes(k));
      if (changedKeys.length > 0) {
        storage.logActivity({
          action: "settings_changed",
          actorType: "admin",
          actorId: settingsAdmin.id,
          actorName: settingsAdmin.name || "Admin",
          targetType: "settings",
          description: `Configurações do sistema alteradas: ${changedKeys.join(", ")}`,
        });
      }

      // Se staleNegotiationDays foi alterado, rodar detecção imediatamente
      if ("staleNegotiationDays" in req.body) {
        const staleDays = await storage.getSystemSettingNumber("staleNegotiationDays", 30);
        storage.detectStaleNegotiations(staleDays).catch((e) =>
          console.error("Immediate stale detection error:", e)
        );
      }

      const settings = await storage.getAllSystemSettings();
      const obj: Record<string, string> = {};
      for (const s of settings) obj[s.key] = s.value;
      res.json(obj);
    } catch (error) {
      res.status(500).json({ message: "Erro ao salvar configurações" });
    }
  });

  // Endpoint manual: forçar detecção de negociações paradas
  app.post("/api/admin/negotiations/detect-stale", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const staleDays = await storage.getSystemSettingNumber("staleNegotiationDays", 30);
      const detected = await storage.detectStaleNegotiations(staleDays);
      res.json({ detected: detected.length, message: `${detected.length} negociação(ões) marcada(s) como pendente.` });
    } catch (error) {
      console.error("Manual detect stale error:", error);
      res.status(500).json({ message: "Erro ao verificar negociações" });
    }
  });

  // ─── SITE SETTINGS (public read, admin write) ───────────────────────────────

  app.get("/api/site-settings", async (_req, res) => {
    try {
      res.json(storage.getSiteSettings());
    } catch {
      res.status(500).json({ message: "Erro ao buscar configurações do site" });
    }
  });

  app.patch("/api/site-settings", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      storage.setSiteSettings(req.body as Record<string, string>);
      res.json(storage.getSiteSettings());
    } catch {
      res.status(500).json({ message: "Erro ao salvar configurações do site" });
    }
  });

  // ─── REAL SITE STATS (public) ───────────────────────────────────────────────

  app.get("/api/site-stats/real", async (_req, res) => {
    try {
      res.json(storage.getRealStats());
    } catch (err) {
      console.error("Real stats error:", err);
      res.status(500).json({ message: "Erro ao buscar dados reais" });
    }
  });

  // ─── BRAND LOGOS (public read, admin write) ─────────────────────────────────

  app.get("/api/brand-logos", async (_req, res) => {
    try {
      res.json(storage.getBrandLogos());
    } catch {
      res.status(500).json({ message: "Erro ao buscar logos" });
    }
  });

  app.post("/api/brand-logos", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { brandId, brandName, logoUrl, vehicleType } = req.body;
      if (!brandId || !brandName || !logoUrl) return res.status(400).json({ message: "brandId, brandName e logoUrl são obrigatórios" });
      const logo = storage.upsertBrandLogo(String(brandId), String(brandName), String(logoUrl), vehicleType || "car");
      res.json(logo);
    } catch {
      res.status(500).json({ message: "Erro ao salvar logo" });
    }
  });

  app.delete("/api/brand-logos/:id", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      storage.deleteBrandLogo((req.params.id as string));
      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: "Erro ao excluir logo" });
    }
  });

  // ============================================
  // ADMIN FINANCE
  // ============================================

  app.get("/api/admin/billing", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const transactions = await storage.getAllBillingTransactions();
      const totalPaid = transactions
        .filter((t: any) => t.status === "paid")
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalPending = transactions
        .filter((t: any) => t.status === "pending")
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const totalBilled = transactions
        .filter((t: any) => t.status === "billed")
        .reduce((sum: number, t: any) => sum + t.amount, 0);
      const plans = await storage.getAllSubscriptionPlans();
      res.json({ transactions, totalPaid, totalPending, totalBilled, plans });
    } catch (error) {
      res.status(500).json({ message: "Erro ao buscar financeiro" });
    }
  });

  // Auto-expire overdue reviews e order items
  async function runAutoExpire() {
    try {
      // Auto-complete negociações com prazo de avaliação vencido e gerar cobrança para cada uma
      const expired = await storage.autoExpireOverdueReviews();
      for (const neg of expired) {
        try {
          await triggerTransactionBilling(neg.desmancheId, neg.id);
        } catch (billingErr) {
          console.error(`Billing on auto-expire error for neg ${neg.id}:`, billingErr);
        }
      }

      // Detectar negociações paradas e mover para verificação
      const staleDays = await storage.getSystemSettingNumber("staleNegotiationDays", 30);
      await storage.detectStaleNegotiations(staleDays);

      await storage.expireOldOrderItems();
      await storage.expireOldOrders();
      storage.expireOrdersWithAllExpiredItems();
    } catch (e) {
      console.error("Auto-expire error:", e);
    }
  }

  // Billing helper
  async function triggerTransactionBilling(desmancheId: string, negotiationId: string) {
    // Idempotency guard: skip if any billing transaction already exists for this negotiation
    const existingTx = await storage.getBillingTransactionsByDesmanche(desmancheId);
    const alreadyBilled = existingTx.some((t: any) => t.negotiationId === negotiationId);
    if (alreadyBilled) {
      console.log(`[billing] Skipping duplicate charge for negotiation ${negotiationId}`);
      return;
    }

    let billing = await storage.getDesmancheBilling(desmancheId);

    // Auto-create billing record with default monthly_cycle model if not set up yet
    if (!billing) {
      billing = await storage.createOrUpdateDesmancheBilling(desmancheId, { billingModel: "monthly_cycle" });
    }
    if (!billing) return;

    const perTxAmount = await storage.getSystemSettingNumber("perTransactionAmount", 25);

    // ── Modelo: ciclo mensal ─────────────────────────────────────────────────
    if (billing.billingModel === "monthly_cycle") {
      const isFirstInCycle = !billing.currentPeriodStart || Number(billing.currentPeriodStart) === 0 || billing.monthlyTransactionCount === 0;
      const tx = await storage.createBillingTransaction({
        desmancheId,
        negotiationId,
        amount: perTxAmount,
        type: "monthly_cycle",
        description: `Ciclo mensal — negociação #${negotiationId.slice(0, 8)}`,
        status: "pending",
      });
      await storage.incrementBillingTransaction(desmancheId, perTxAmount, isFirstInCycle);
      console.log(`[billing] monthly_cycle: recorded R$${perTxAmount} for negotiation ${negotiationId} (first=${isFirstInCycle})`);
      return tx;
    }

    // ── Modelo: por transação (legado) ───────────────────────────────────────
    if (billing.billingModel !== "per_transaction") return;

    const capAmount = await storage.getSystemSettingNumber("monthlyCapAmount", 200);

    if (billing.monthlyAmountPaid >= capAmount) {
      await storage.createBillingTransaction({
        desmancheId,
        negotiationId,
        amount: 0,
        type: "per_transaction",
        description: "Isento — teto mensal atingido",
        status: "exempt",
      });
      return;
    }

    const chargeAmount = Math.min(perTxAmount, capAmount - billing.monthlyAmountPaid);
    let asaasChargeId: string | undefined;
    let paymentLink: string | undefined;

    if (asaas.isAsaasConfigured() && billing.asaasCustomerId) {
      const charge = await asaas.createAsaasCharge({
        customerId: billing.asaasCustomerId,
        value: chargeAmount,
        dueDate: asaas.getDueDateString(3),
        description: `Central dos Desmanches — transação #${negotiationId.slice(0, 8)}`,
        billingType: "UNDEFINED",
      });
      if (charge) {
        asaasChargeId = charge.id;
        paymentLink = charge.invoiceUrl || charge.bankSlipUrl;
      }
    }

    const tx = await storage.createBillingTransaction({
      desmancheId,
      negotiationId,
      amount: chargeAmount,
      type: "per_transaction",
      description: `Transação — negociação #${negotiationId.slice(0, 8)}`,
      asaasChargeId,
      paymentLink,
      status: "pending",
    });

    await storage.incrementBillingTransaction(desmancheId, chargeAmount);
    return tx;
  }

  // Monthly cycle close job
  async function runMonthlyCycleClose() {
    try {
      const overdue = await storage.getDesmanchesWithOverdueMonthlyCycles();
      if (overdue.length === 0) return;
      console.log(`[billing] Monthly cycle close: ${overdue.length} desmanche(s) due`);

      for (const billingRecord of overdue) {
        const desmancheId = billingRecord.desmancheId;
        try {
          const pendingTxs = await storage.getPendingCycleBillingTransactions(desmancheId);
          const totalAmount = pendingTxs.reduce((s: number, t: any) => s + t.amount, 0);

          if (pendingTxs.length === 0 || totalAmount === 0) {
            await storage.resetMonthlyCycle(desmancheId);
            continue;
          }

          // Asaas must be configured to close a cycle and generate a consolidated charge
          if (!asaas.isAsaasConfigured()) {
            console.warn(`[billing] Cycle close for ${desmancheId}: Asaas not configured, skipping (will retry when configured)`);
            continue;
          }

          // Auto-provision Asaas customer if missing
          let asaasCustomerId = billingRecord.asaasCustomerId;
          if (!asaasCustomerId) {
            const desmanche = (billingRecord as any).desmanche;
            if (!desmanche) {
              console.warn(`[billing] Cycle close for ${desmancheId}: desmanche data missing, skipping`);
              continue;
            }
            const customer = await asaas.createAsaasCustomer({
              name: desmanche.companyName,
              email: desmanche.email,
              phone: desmanche.phone,
              cpfCnpj: desmanche.cnpj,
            });
            if (!customer || "error" in customer) {
              console.warn(`[billing] Cycle close for ${desmancheId}: failed to create Asaas customer (${(customer as any)?.error || "unknown"}), skipping`);
              continue;
            }
            asaasCustomerId = customer.id;
            await storage.createOrUpdateDesmancheBilling(desmancheId, { asaasCustomerId });
            console.log(`[billing] Auto-provisioned Asaas customer for ${desmancheId}: ${asaasCustomerId}`);
          }

          const periodStart = new Date(Number(billingRecord.currentPeriodStart) * 1000);
          const periodEnd = new Date();
          const desc = `Central dos Desmanches — ${pendingTxs.length} operações (${periodStart.toLocaleDateString("pt-BR")} a ${periodEnd.toLocaleDateString("pt-BR")})`;
          const charge = await asaas.createAsaasCharge({
            customerId: asaasCustomerId,
            value: totalAmount,
            dueDate: asaas.getDueDateString(5),
            description: desc,
            billingType: "UNDEFINED",
          });
          if (!charge) {
            // Charge creation failed — leave cycle open for retry next run
            console.warn(`[billing] Cycle close for ${desmancheId}: Asaas charge creation failed, skipping (will retry next run)`);
            continue;
          }

          const txIds = pendingTxs.map((t: any) => t.id);
          await storage.markBillingTransactionsAsBilled(txIds, charge.id, charge.invoiceUrl || charge.bankSlipUrl);
          await storage.resetMonthlyCycle(desmancheId);

          console.log(`[billing] Closed cycle for ${desmancheId}: R$${totalAmount} (${pendingTxs.length} tx, charge=${charge.id})`);
        } catch (err) {
          console.error(`[billing] Error closing cycle for ${desmancheId}:`, err);
        }
      }
    } catch (err) {
      console.error("[billing] runMonthlyCycleClose error:", err);
    }
  }

  // Seed database
  await storage.seedDatabase();
  console.log("Database seeded successfully");

  // ─── ACTIVITY LOG ROUTE ──────────────────────────────────────────────────────
  app.get("/api/admin/activity-logs", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
      const offset = parseInt(req.query.offset as string || "0");
      const action = req.query.action as string || undefined;
      const actorType = req.query.actorType as string || undefined;
      const logs = storage.getActivityLogs({ limit, offset, action, actorType });
      const total = storage.getActivityLogsCount({ action, actorType });
      res.json({ logs, total });
    } catch (error) {
      console.error("Get activity logs error:", error);
      res.status(500).json({ message: "Erro ao buscar logs de atividade" });
    }
  });

  // ============================================
  // GUINCHO ROUTES
  // ============================================

  // Public: list active guinchos with optional city/state filters
  app.get("/api/guinchos", async (req, res) => {
    try {
      const city = req.query.city as string | undefined;
      const state = req.query.state as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 100);
      const offset = parseInt(req.query.offset as string || "0");
      const guinchos = storage.listGuinchos({ status: "active", city, state, limit, offset });
      const total = storage.countGuinchos({ status: "active", city, state });
      res.json({ guinchos, total });
    } catch (error) {
      console.error("List guinchos error:", error);
      res.status(500).json({ message: "Erro ao buscar guinchos" });
    }
  });

  // Public: validate CNPJ against external API
  app.post("/api/guinchos/validate-cnpj", async (req, res) => {
    try {
      const { cnpj } = req.body;
      if (!cnpj || !/^\d{14}$/.test(cnpj)) {
        return res.status(400).json({ valid: false, message: "CNPJ inválido" });
      }
      const existing = storage.getGuinchoByCnpj(cnpj);
      if (existing) {
        return res.status(400).json({ valid: false, message: "CNPJ já cadastrado" });
      }
      try {
        const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
          headers: { "Accept": "application/json" },
          signal: AbortSignal.timeout(10000),
        });
        if (!resp.ok) {
          return res.json({ valid: true, warning: "Não foi possível validar situação cadastral agora" });
        }
        const data = await resp.json() as any;
        // situacao_cadastral: 2 = Ativa, 1 = Nula, 3 = Suspensa, 4 = Inapta, 8 = Baixada
        // Use Number() to handle both numeric and string returns from the API
        if (Number(data.situacao_cadastral) !== 2) {
          const labels: Record<number, string> = { 1: "Nula", 3: "Suspensa", 4: "Inapta", 8: "Baixada" };
          const situLabel = labels[Number(data.situacao_cadastral)] ?? data.descricao_situacao_cadastral ?? String(data.situacao_cadastral);
          return res.status(400).json({ valid: false, message: `CNPJ não está ATIVO (situação: ${situLabel})` });
        }
        res.json({ valid: true, companyName: data.razao_social, tradingName: data.nome_fantasia || data.razao_social });
      } catch {
        res.json({ valid: true, warning: "Não foi possível validar situação cadastral agora" });
      }
    } catch (error) {
      console.error("Validate CNPJ error:", error);
      res.status(500).json({ message: "Erro ao validar CNPJ" });
    }
  });

  // Public: register a guincho
  app.post("/api/guinchos/register", async (req, res) => {
    try {
      const data = schema.insertGuinchoSchema.parse(req.body);
      const existingEmail = storage.getGuinchoByEmail(data.email);
      if (existingEmail) {
        return res.status(400).json({ message: "E-mail já cadastrado" });
      }
      if (data.documentType === "cpf") {
        if (data.cpf) {
          const existingCpf = storage.getGuinchoByCpf(data.cpf);
          if (existingCpf) {
            return res.status(400).json({ message: "CPF já cadastrado" });
          }
        }
      } else {
        if (data.cnpj) {
          const existingCnpj = storage.getGuinchoByCnpj(data.cnpj);
          if (existingCnpj) {
            return res.status(400).json({ message: "CNPJ já cadastrado" });
          }
          // Enforce CNPJ "ATIVA" rule server-side
          try {
            const cnpjResp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${data.cnpj}`, {
              headers: { "Accept": "application/json" },
              signal: AbortSignal.timeout(10000),
            });
            if (cnpjResp.ok) {
              const cnpjData = await cnpjResp.json() as any;
              // situacao_cadastral: 2 = Ativa, 1 = Nula, 3 = Suspensa, 4 = Inapta, 8 = Baixada
              // Use Number() to handle both numeric and string returns from the API
              if (Number(cnpjData.situacao_cadastral) !== 2) {
                const labels: Record<number, string> = { 1: "Nula", 3: "Suspensa", 4: "Inapta", 8: "Baixada" };
                const situLabel = labels[Number(cnpjData.situacao_cadastral)] ?? cnpjData.descricao_situacao_cadastral ?? String(cnpjData.situacao_cadastral);
                return res.status(400).json({
                  message: `CNPJ não está ATIVO na Receita Federal (situação: ${situLabel}). Só é possível cadastrar CNPJs com situação ATIVA.`,
                });
              }
            }
            // If API is unavailable/non-200, allow registration (outage tolerance)
          } catch {
            // External API unavailable — allow registration to proceed
          }
        }
      }
      const guincho = await storage.createGuincho(data);
      storage.logActivity({
        action: "guincho_registered",
        actorType: "system",
        actorId: guincho.id,
        actorName: guincho.trading_name,
        description: `Novo guincho cadastrado: ${guincho.trading_name} (${data.documentType === "cpf" ? "CPF" : "CNPJ"}: ${data.documentType === "cpf" ? guincho.cpf : guincho.cnpj})`,
      });
      const token = jwt.sign(
        { id: guincho.id, email: guincho.email, type: "guincho" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.status(201).json({
        token,
        user: {
          id: guincho.id,
          name: guincho.trading_name,
          email: guincho.email,
          phone: guincho.phone,
          type: "guincho",
          status: guincho.status,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Dados inválidos", errors: error.issues });
      }
      console.error("Register guincho error:", error);
      res.status(500).json({ message: "Erro no cadastro" });
    }
  });

  // Guincho login
  app.post("/api/guinchos/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "E-mail e senha são obrigatórios" });
      }
      const guincho = storage.getGuinchoByEmail(email);
      if (!guincho) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      const valid = await storage.verifyPassword(password, guincho.password);
      if (!valid) {
        return res.status(401).json({ message: "Credenciais inválidas" });
      }
      const token = jwt.sign(
        { id: guincho.id, email: guincho.email, type: "guincho" },
        JWT_SECRET,
        { expiresIn: "7d" }
      );
      res.json({
        token,
        user: {
          id: guincho.id,
          name: guincho.trading_name,
          email: guincho.email,
          phone: guincho.phone,
          type: "guincho",
          status: guincho.status,
        },
      });
    } catch (error) {
      console.error("Guincho login error:", error);
      res.status(500).json({ message: "Erro no login" });
    }
  });

  // Guincho: get my profile
  app.get("/api/guinchos/me", authMiddleware, requireType(["guincho"]), async (req, res) => {
    try {
      const guincho = storage.getGuinchoById((req as any).user.id);
      if (!guincho) return res.status(404).json({ message: "Não encontrado" });
      res.json({
        id: guincho.id,
        name: guincho.name,
        tradingName: guincho.trading_name,
        cnpj: guincho.cnpj,
        email: guincho.email,
        phone: guincho.phone,
        whatsapp: guincho.whatsapp,
        description: guincho.description,
        zipCode: guincho.zip_code,
        street: guincho.street,
        number: guincho.number,
        neighborhood: guincho.neighborhood,
        city: guincho.city,
        state: guincho.state,
        serviceRadius: guincho.service_radius,
        photoUrl: guincho.photo_url,
        latitude: guincho.latitude,
        longitude: guincho.longitude,
        status: guincho.status,
        rejectionReason: guincho.rejection_reason,
        type: "guincho",
      });
    } catch (error) {
      console.error("Get guincho me error:", error);
      res.status(500).json({ message: "Erro ao buscar perfil" });
    }
  });

  // Guincho: update my profile (including address)
  app.patch("/api/guinchos/me", authMiddleware, requireType(["guincho"]), async (req, res) => {
    try {
      const id = (req as any).user.id;
      const { name, tradingName, phone, whatsapp, description, serviceRadius, zipCode, street, number, neighborhood, city, state, photoUrl } = req.body;
      const updated = await storage.updateGuinchoProfile(id, { name, tradingName, phone, whatsapp, description, serviceRadius, zipCode, street, number, neighborhood, city, state, photoUrl });
      if (!updated) return res.status(404).json({ message: "Não encontrado" });
      res.json({
        id: updated.id,
        name: updated.name,
        tradingName: updated.trading_name,
        phone: updated.phone,
        whatsapp: updated.whatsapp,
        description: updated.description,
        serviceRadius: updated.service_radius,
        zipCode: updated.zip_code,
        street: updated.street,
        number: updated.number,
        neighborhood: updated.neighborhood,
        city: updated.city,
        state: updated.state,
        photoUrl: updated.photo_url,
        latitude: updated.latitude,
        longitude: updated.longitude,
        status: updated.status,
        type: "guincho",
      });
    } catch (error) {
      console.error("Update guincho error:", error);
      res.status(500).json({ message: "Erro ao atualizar perfil" });
    }
  });

  // Admin: list all guinchos
  app.get("/api/admin/guinchos", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const city = req.query.city as string | undefined;
      const state = req.query.state as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string || "50"), 200);
      const offset = parseInt(req.query.offset as string || "0");
      const guinchos = storage.listGuinchos({ status, city, state, limit, offset });
      const total = storage.countGuinchos({ status });
      res.json({ guinchos, total });
    } catch (error) {
      console.error("Admin list guinchos error:", error);
      res.status(500).json({ message: "Erro ao buscar guinchos" });
    }
  });

  // Admin: update guincho status
  app.patch("/api/admin/guinchos/:id/status", authMiddleware, requireType(["admin"]), async (req, res) => {
    try {
      const { id } = req.params as { id: string };
      const { status, rejectionReason } = req.body;
      const allowed = ["active", "rejected", "inactive", "pending"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ message: "Status inválido" });
      }
      const guincho = storage.getGuinchoById(id);
      if (!guincho) return res.status(404).json({ message: "Guincho não encontrado" });
      storage.updateGuinchoStatus(id, status, rejectionReason);
      storage.logActivity({
        action: `guincho_status_${status}`,
        actorType: "admin",
        actorId: (req as any).user.id,
        actorName: (req as any).user.email,
        targetType: "guincho",
        targetId: id,
        description: `Guincho ${guincho.trading_name} → ${status}${rejectionReason ? `: ${rejectionReason}` : ""}`,
      });
      res.json({ message: "Status atualizado" });
    } catch (error) {
      console.error("Admin update guincho status error:", error);
      res.status(500).json({ message: "Erro ao atualizar status" });
    }
  });

  // Load Asaas config from DB before any scheduled jobs (overrides env var if set in admin panel)
  const savedApiKey = await storage.getSystemSetting("asaasApiKey");
  const savedEnv = await storage.getSystemSetting("asaasEnvironment");
  if (savedApiKey) {
    asaas.setAsaasConfig(savedApiKey, savedEnv || "sandbox");
    console.log(`Asaas configured from DB (${savedEnv || "sandbox"})`);
  }

  // Run auto-expire on startup and every hour
  runAutoExpire();
  setInterval(runAutoExpire, 60 * 60 * 1000);

  // Run monthly cycle close on startup and every hour (after Asaas config is loaded)
  runMonthlyCycleClose();
  setInterval(runMonthlyCycleClose, 60 * 60 * 1000);
}
