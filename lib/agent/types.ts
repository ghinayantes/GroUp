export type Channel = "whatsapp" | "simulator";

export type InboundMessage = {
  channel: Channel;
  senderKey: string;
  messageId: string;
  text: string;
  kind: "text" | "interactive" | "unsupported";
  replyId?: string;
  profileName?: string;
};

export type Reply =
  | { kind: "text"; body: string; aiGenerated: boolean }
  | { kind: "list"; body: string; button: string; rows: { id: string; title: string; description: string }[] }
  | { kind: "buttons"; body: string; buttons: { id: string; title: string }[] };

export const INTENTS = [
  "pesan_baru",
  "ubah_pesanan",
  "batal_pesanan",
  "cek_pesanan",
  "tanya_info",
  "tanya_harga_pasar",
  "catat_minat",
  "sapaan",
  "di_luar_topik",
] as const;

export type Intent = (typeof INTENTS)[number];

export type Frequency = "sekali" | "mingguan" | "bulanan";

export type ProposedAction =
  | { type: "confirm_join"; batchId: string; quantity: number }
  | { type: "ask_quantity"; batchId: string }
  | { type: "choose_batch"; candidateBatchIds: string[] }
  | { type: "confirm_change"; orderCode: string; quantity: number }
  | { type: "confirm_cancel"; orderCode: string }
  | { type: "list_orders" }
  | { type: "confirm_interest"; material: string; quantity: number | null; unit: string | null; frequency: Frequency | null }
  | { type: "answer"; text: string }
  | { type: "menu"; reason?: "greeting" | "off_topic" };

export type SessionStage =
  | "choose_batch"
  | "enter_quantity"
  | "confirm_order"
  | "confirm_change"
  | "confirm_cancel"
  | "confirm_interest";

export type AgentSession = {
  channel: Channel;
  senderKey: string;
  stage: SessionStage;
  batchId: string | null;
  quantity: number | null;
  customerName: string | null;
  pendingAction: ProposedAction | null;
  expiresAt: string;
};

export type TraceRecord = {
  stage: "fixed" | "stage1" | "stage2" | "fallback";
  intent: Intent | null;
  confidence: number | null;
  action: ProposedAction["type"] | "fixed";
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  slots?: unknown;
  tools?: string[];
};

export type EngineResult = { replies: Reply[]; trace: TraceRecord };

export const BUTTON = {
  ORDER_CONFIRM: "ORDER_CONFIRM",
  CHANGE_CONFIRM: "CHANGE_CONFIRM",
  CANCEL_CONFIRM: "CANCEL_CONFIRM",
  INTEREST_CONFIRM: "INTEREST_CONFIRM",
  DISMISS: "ACTION_DISMISS",
} as const;
