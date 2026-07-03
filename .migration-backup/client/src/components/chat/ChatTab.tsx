import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { getToken } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Send,
  Loader2,
  Car,
  ChevronLeft,
  Package,
} from "lucide-react";

interface Room {
  id: string;
  proposalId: string;
  orderId: string;
  clientId: string;
  desmancheId: string;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  order?: { title: string; vehicleBrand: string; vehicleModel: string; vehicleYear: number };
  desmanche?: { tradingName: string; companyName: string; phone: string };
  client?: { name: string };
  messages?: Array<{ content: string; senderType: string }>;
}

interface Message {
  id: string;
  roomId: string;
  senderId: string;
  senderType: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

function timeStr(dateStr: string | number | null): string {
  if (!dateStr) return "";
  const date = typeof dateStr === "number" ? new Date(dateStr * 1000) : new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Agora";
  if (diffMin < 60) return `${diffMin} min`;
  const h = Math.floor(diffMin / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Ontem";
  if (d < 7) return `${d} dias`;
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

function msgTime(dateStr: string | number): string {
  const date = typeof dateStr === "number" ? new Date(dateStr * 1000) : new Date(dateStr);
  return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function ChatTab() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [showMobileList, setShowMobileList] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const userType = user?.type === "desmanche" ? "desmanche" : "client";

  const { data: rooms = [], isLoading: loadingRooms } = useQuery<Room[]>({
    queryKey: ["/api/chat/rooms"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/chat/rooms");
      return res.json();
    },
    enabled: !!getToken() && !!user,
    staleTime: 0,
    refetchInterval: 5000,
  });

  const { data: messages = [], isLoading: loadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/chat/messages", selectedRoomId],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/chat/rooms/${selectedRoomId}/messages`);
      return res.json();
    },
    enabled: !!selectedRoomId && !!getToken(),
    staleTime: 0,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      const res = await apiRequest("POST", `/api/chat/rooms/${selectedRoomId}/messages`, { content });
      return res.json();
    },
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", selectedRoomId] });
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
    },
    onError: () => {
      toast({ title: "Erro ao enviar mensagem", variant: "destructive" });
    },
  });

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    if (selectedRoomId) {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/rooms"] });
    }
  }, [selectedRoomId]);

  const handleSend = () => {
    const trimmed = message.trim();
    if (!trimmed || sendMutation.isPending) return;
    sendMutation.mutate(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);
  const totalUnread = rooms.reduce((s, r) => s + (r.unreadCount || 0), 0);

  const getRoomTitle = (room: Room) => {
    if (userType === "client") return room.desmanche?.tradingName || "Desmanche";
    return room.client?.name || "Cliente";
  };

  const getRoomSubtitle = (room: Room) => {
    return room.order?.title || "Pedido";
  };

  const getLastMessage = (room: Room) => {
    const m = room.messages?.[0];
    if (!m) return "Conversa iniciada";
    return m.content.length > 50 ? m.content.substring(0, 47) + "..." : m.content;
  };

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-mono text-slate-900 tracking-tight">Mensagens</h1>
          <p className="text-slate-500 mt-1">
            {totalUnread > 0
              ? `${totalUnread} mensage${totalUnread > 1 ? "ns não lidas" : "m não lida"}`
              : "Suas conversas com os contatos da plataforma"}
          </p>
        </div>
      </div>

      {loadingRooms ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-slate-200">
          <MessageCircle className="h-14 w-14 text-slate-200 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-600 mb-1">Nenhuma conversa ainda</h3>
          <p className="text-slate-400 text-sm max-w-xs mx-auto">
            {userType === "desmanche"
              ? "Quando você enviar uma proposta, uma conversa será aberta automaticamente com o cliente."
              : "Quando um desmanche enviar uma proposta para você, uma conversa será aberta aqui."}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex h-[600px]">
          {/* ── Room List ───────────────────────────────────── */}
          <div
            className={`w-full md:w-80 border-r border-slate-200 flex flex-col shrink-0 ${
              !showMobileList && selectedRoomId ? "hidden md:flex" : "flex"
            }`}
          >
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Conversas ({rooms.length})
              </p>
            </div>
            <ScrollArea className="flex-1">
              {rooms.map((room) => {
                const isActive = room.id === selectedRoomId;
                return (
                  <button
                    key={room.id}
                    onClick={() => {
                      setSelectedRoomId(room.id);
                      setShowMobileList(false);
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors flex gap-3 items-start ${
                      isActive ? "bg-primary/5 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 mt-0.5">
                      {getRoomTitle(room)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <span className="font-semibold text-sm text-slate-800 truncate">
                          {getRoomTitle(room)}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {timeStr(room.lastMessageAt || room.createdAt)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Car className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="text-xs text-slate-500 truncate">{getRoomSubtitle(room)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400 truncate">{getLastMessage(room)}</span>
                        {room.unreadCount > 0 && (
                          <Badge className="bg-primary text-white text-[10px] px-1.5 py-0 min-w-[18px] text-center shrink-0">
                            {room.unreadCount}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </ScrollArea>
          </div>

          {/* ── Chat View ───────────────────────────────────── */}
          <div
            className={`flex-1 flex flex-col min-w-0 ${
              showMobileList && !selectedRoomId ? "hidden md:flex" : "flex"
            }`}
          >
            {!selectedRoomId ? (
              <div className="flex-1 flex items-center justify-center flex-col gap-3 text-slate-400 p-8">
                <MessageCircle className="h-12 w-12 text-slate-200" />
                <p className="text-sm text-center">Selecione uma conversa para começar</p>
              </div>
            ) : (
              <>
                {/* Chat Header */}
                <div className="p-3 border-b border-slate-200 bg-white flex items-center gap-3">
                  <button
                    onClick={() => { setShowMobileList(true); setSelectedRoomId(null); }}
                    className="md:hidden p-1 rounded hover:bg-slate-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
                    {selectedRoom ? getRoomTitle(selectedRoom)[0]?.toUpperCase() : "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-800">
                      {selectedRoom ? getRoomTitle(selectedRoom) : ""}
                    </p>
                    {selectedRoom?.order && (
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {selectedRoom.order.title}
                      </p>
                    )}
                  </div>
                </div>

                {/* Messages */}
                <ScrollArea className="flex-1 p-4">
                  {loadingMessages ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                      <MessageCircle className="h-8 w-8 mx-auto mb-2 text-slate-200" />
                      <p className="text-sm">Nenhuma mensagem ainda. Diga olá!</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {messages.map((msg, i) => {
                        const isMe = msg.senderId === user?.id;
                        const prevMsg = i > 0 ? messages[i - 1] : null;
                        const showDate =
                          !prevMsg ||
                          new Date(typeof msg.createdAt === "number" ? (msg.createdAt as number) * 1000 : msg.createdAt).toDateString() !==
                            new Date(typeof prevMsg.createdAt === "number" ? (prevMsg.createdAt as number) * 1000 : prevMsg.createdAt).toDateString();

                        return (
                          <div key={msg.id}>
                            {showDate && (
                              <div className="text-center my-3">
                                <span className="text-[10px] bg-slate-100 text-slate-500 px-3 py-1 rounded-full">
                                  {new Date(
                                    typeof msg.createdAt === "number" ? (msg.createdAt as number) * 1000 : msg.createdAt
                                  ).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                                </span>
                              </div>
                            )}
                            <div className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                              <div
                                className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                                  isMe
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-slate-100 text-slate-800 rounded-bl-sm"
                                }`}
                              >
                                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                                  {msg.content}
                                </p>
                                <div
                                  className={`flex items-center gap-1 mt-1 ${isMe ? "justify-end" : "justify-start"}`}
                                >
                                  <span
                                    className={`text-[10px] ${
                                      isMe ? "text-primary-foreground/70" : "text-slate-400"
                                    }`}
                                  >
                                    {msgTime(msg.createdAt)}
                                  </span>
                                  {isMe && msg.readAt && (
                                    <span className="text-[10px] text-primary-foreground/70">✓✓</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>

                {/* Input */}
                <div className="p-3 border-t border-slate-200 bg-white">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      ref={textareaRef}
                      placeholder="Digite uma mensagem... (Enter para enviar)"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="resize-none min-h-[42px] max-h-[120px] text-sm"
                      rows={1}
                    />
                    <Button
                      size="icon"
                      onClick={handleSend}
                      disabled={!message.trim() || sendMutation.isPending}
                      className="h-10 w-10 shrink-0"
                    >
                      {sendMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 text-center">
                    Enter para enviar • Shift+Enter para nova linha
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
