export type Merchant = { id: string; name: string; walletAddress: string };

export type Invoice = {
  id: string;
  chainId?: number;
  description: string;
  customerName?: string;
  amount: string;
  status: string;
  createdAt: string;
  merchant: Merchant;
  payment?: { txHash: string; paidAt: string; blockNumber?: string } | null;
};

export type Stats = { total: number; paid: number; pending: number; totalReceived: string; totalOutstanding: string };
