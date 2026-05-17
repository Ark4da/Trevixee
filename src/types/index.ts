export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  createdAt: Date;
  subscription: "basic" | "premium" | "essential" | "pro";
}

export interface TradingAccount {
  id: string;
  userId: string;
  name: string;
  broker: string;
  accountNumber: string;
  balance: number;
  currency: string;
  isDefault: boolean;
  createdAt: Date;
}

export interface Trade {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  entryDate: Date;
  exitDate: Date;
  pnl: number;
  pnlPercent: number;
  fees: number;
  netPnl: number;
  rMultiple: number;
  duration: number;
  setup?: string;
  mistakes?: string[];
  tags?: string[];
  notes?: string;
  screenshots?: string[];
  rating?: number;
  emotionalState?: "confident" | "fearful" | "greedy" | "neutral" | "frustrated";
  strategy?: string;
  playbook?: string;
  timeframe?: string;
  market: "stocks" | "forex" | "futures" | "crypto" | "options";
  status: "open" | "closed";
  createdAt: Date;
  updatedAt: Date;
}

export interface DailyStats {
  date: string;
  trades: number;
  pnl: number;
  winRate: number;
  grossProfit: number;
  grossLoss: number;
  biggestWin: number;
  biggestLoss: number;
  averageWin: number;
  averageLoss: number;
}

export interface Playbook {
  id: string;
  userId: string;
  name: string;
  description: string;
  rules: PlaybookRule[];
  market: string;
  timeframe: string;
  winRate: number;
  totalTrades: number;
  totalPnl: number;
  averageRMultiple: number;
  tags: string[];
  screenshots: string[];
  isActive: boolean;
  isReadOnly?: boolean;
  sourcePlaybookId?: string | null;
  pushedByUserId?: string | null;
  pushedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybookRule {
  id: string;
  description: string;
  type: "entry" | "exit" | "risk" | "general";
  isRequired: boolean;
}

export interface BacktestSession {
  id: string;
  userId: string;
  name: string;
  symbol: string;
  timeframe: string;
  startDate: Date;
  endDate: Date;
  trades: BacktestTrade[];
  totalPnl: number;
  winRate: number;
  totalTrades: number;
  profitFactor: number;
  maxDrawdown: number;
  sharpeRatio: number;
  status: "in_progress" | "completed";
  createdAt: Date;
}

export interface BacktestTrade {
  id: string;
  sessionId: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  pnl: number;
  entryDate: Date;
  exitDate: Date;
  notes?: string;
}

export interface OverviewStats {
  totalTrades: number;
  winRate: number;
  totalPnl: number;
  profitFactor: number;
  averageWin: number;
  averageLoss: number;
  biggestWin: number;
  biggestLoss: number;
  averageRMultiple: number;
  maxDrawdown: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  sharpeRatio: number;
  averageDuration: number;
  totalFees: number;
  expectancy: number;
}

export interface Space {
  id: string;
  name: string;
  ownerId: string;
  members: SpaceMember[];
  description: string;
  createdAt: Date;
}

export interface SpaceMember {
  userId: string;
  name: string;
  role: "owner" | "mentor" | "member";
  joinedAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  isRead: boolean;
  createdAt: Date;
}
