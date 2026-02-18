
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getWalletBalance, getWalletTransactions, getPayoutRequests, WalletTransaction, PayoutRequest } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUpRight, ArrowDownLeft, Wallet, Clock, CheckCircle2, XCircle, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import RequestPayoutDialog from "@/components/chat/RequestPayoutDialog";

const WalletPage = () => {
    // Set page title
    useEffect(() => {
        document.title = "Wallet - Vesper";
    }, []);
    const { user } = useAuth();
    const [balance, setBalance] = useState(0);
    const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
    const [payoutRequests, setPayoutRequests] = useState<PayoutRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPayoutOpen, setIsPayoutOpen] = useState(false);

    const loadData = async () => {
        try {
            const [balanceData, txData, payoutData] = await Promise.all([
                getWalletBalance(),
                getWalletTransactions(),
                getPayoutRequests()
            ]);
            setBalance(balanceData.balance);
            setTransactions(txData);
            setPayoutRequests(payoutData);
        } catch (error) {
            console.error("Failed to load wallet data:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR'
        }).format(amount);
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
                return <Badge className="bg-green-500 hover:bg-green-600"><CheckCircle2 className="w-3 h-3 mr-1" /> Paid</Badge>;
            case 'pending':
                return <Badge variant="outline" className="text-yellow-500 border-yellow-500"><Clock className="w-3 h-3 mr-1" /> Pending</Badge>;
            case 'processing':
                return <Badge variant="secondary" className="bg-blue-100 text-blue-800"><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Processing</Badge>;
            case 'failed':
            case 'cancelled':
                return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" /> Failed</Badge>;
            default:
                return <Badge variant="outline">{status}</Badge>;
        }
    };

    return (
        <div className="container max-w-4xl mx-auto p-4 md:p-6 space-y-6 pb-20 md:pb-6">
            <h1 className="text-3xl font-bold flex items-center gap-2">
                <Wallet className="h-8 w-8 text-primary" />
                My Wallet
            </h1>

            {/* Balance Card */}
            <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground">Available Balance</CardTitle>
                    <div className="flex items-end justify-between">
                        <div className="space-y-1">
                            <span className="text-4xl font-bold text-primary">
                                {formatCurrency(balance)}
                            </span>
                            <p className="text-xs text-muted-foreground">
                                Minimum payout amount: ₹500.00
                            </p>
                        </div>
                        <Button
                            onClick={() => setIsPayoutOpen(true)}
                            disabled={balance < 500}
                        >
                            Request Payout
                        </Button>
                    </div>
                </CardHeader>
            </Card>

            <Tabs defaultValue="transactions" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="transactions">Transactions</TabsTrigger>
                    <TabsTrigger value="payouts">Payout Requests</TabsTrigger>
                </TabsList>

                {/* Transactions Tab */}
                <TabsContent value="transactions">
                    <Card>
                        <CardHeader>
                            <CardTitle>Transaction History</CardTitle>
                            <CardDescription>Recent activity in your wallet</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                {transactions.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No transactions yet
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {transactions.map((tx) => (
                                            <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg bg-secondary/20">
                                                <div className="flex items-start gap-3">
                                                    <div className={`p-2 rounded-full ${tx.amount > 0 ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                                        {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                                    </div>
                                                    <div>
                                                        <p className="font-medium text-sm">{tx.description}</p>
                                                        <p className="text-xs text-muted-foreground">{formatDate(tx.createdAt)}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className={`font-bold ${tx.amount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                        {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        Bal: {formatCurrency(tx.balance)}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payouts Tab */}
                <TabsContent value="payouts">
                    <Card>
                        <CardHeader>
                            <CardTitle>Payout Requests</CardTitle>
                            <CardDescription>Status of your withdrawal requests</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ScrollArea className="h-[400px] pr-4">
                                {payoutRequests.length === 0 ? (
                                    <div className="text-center py-8 text-muted-foreground">
                                        No payout requests yet
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {payoutRequests.map((req) => (
                                            <div key={req.id} className="border rounded-lg p-4">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-bold text-lg">{formatCurrency(req.amount)}</span>
                                                        {getStatusBadge(req.status)}
                                                    </div>
                                                    <span className="text-xs text-muted-foreground">{formatDate(req.requestedAt)}</span>
                                                </div>
                                                <div className="text-sm text-muted-foreground mb-2">
                                                    <p>Bank: {req.bankAccount} ({req.ifscCode})</p>
                                                    <p>Name: {req.accountName}</p>
                                                </div>
                                                {req.adminNote && (
                                                    <div className="mt-2 p-2 bg-secondary/30 rounded text-xs">
                                                        <span className="font-semibold">Admin Note:</span> {req.adminNote}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ScrollArea>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            <RequestPayoutDialog
                open={isPayoutOpen}
                onOpenChange={setIsPayoutOpen}
                maxAmount={balance}
                onSuccess={loadData}
            />
        </div>
    );
};

export default WalletPage;
