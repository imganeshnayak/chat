import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Plus, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getEscrowDeals, createEscrowDeal, releaseEscrowPayment, EscrowDeal, initiateEscrowPayment, verifyPayment, deleteEscrowDeal } from "@/lib/api";
import { socketService } from "@/lib/socket";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { useRazorpay } from "@/hooks/useRazorpay";

function formatCurrency(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n);
}

const EscrowPage = () => {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { openCheckout } = useRazorpay();
  const [deals, setDeals] = useState<EscrowDeal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [releasePercent, setReleasePercent] = useState("");
  const [releaseNote, setReleaseNote] = useState("");
  const [selectedDeal, setSelectedDeal] = useState<number | null>(null);
  const [isReleasing, setIsReleasing] = useState(false);
  const [searchParams] = useSearchParams();
  const [isNewDealOpen, setIsNewDealOpen] = useState(false);
  // New deal form
  const [isCreating, setIsCreating] = useState(false);
  const [newDeal, setNewDeal] = useState({
    chatId: "",
    vendorId: "",
    title: "",
    description: "",
    totalAmount: ""
  });

  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login");
      return;
    }
    if (user) {
      loadDeals();
    }
  }, [user, authLoading, navigate]);

  // Handle query params for new escrow deal
  useEffect(() => {
    const chatId = searchParams.get("chatId");
    const vendorId = searchParams.get("vendorId");

    if (chatId && vendorId) {
      setNewDeal(prev => ({
        ...prev,
        chatId,
        vendorId
      }));
      setIsNewDealOpen(true);
    }
  }, [searchParams]);

  // Listen for real-time escrow updates
  useEffect(() => {
    if (!user) return;

    const cleanup = socketService.onNewMessage(() => {
      loadDeals(); // Refresh deals when messages arrive (might contain escrow updates)
    });

    return cleanup;
  }, [user]);

  const loadDeals = async () => {
    setIsLoading(true);
    try {
      const data = await getEscrowDeals();
      setDeals(data);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load escrow deals",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayForDeal = async (deal: EscrowDeal) => {
    if (deal.paymentStatus === 'paid') {
      toast({
        title: "Already Paid",
        description: "Payment has already been completed for this deal.",
      });
      return;
    }

    setIsCreating(true);
    try {
      // Initiate payment
      const paymentOrder = await initiateEscrowPayment(deal.id);

      // Open Razorpay checkout
      openCheckout({
        orderId: paymentOrder.orderId,
        amount: paymentOrder.amount,
        currency: paymentOrder.currency,
        name: "Escrow Payment",
        description: paymentOrder.title || deal.title,
        onSuccess: async (response) => {
          // Verify payment with backend
          try {
            await verifyPayment({
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
              type: "escrow",
              entityId: deal.id,
            });

            toast({
              title: "Payment Successful!",
              description: "Your escrow deal is now active.",
            });

            loadDeals();
          } catch (err) {
            toast({
              title: "Verification Failed",
              description: err instanceof Error ? err.message : "Failed to verify payment",
              variant: "destructive",
            });
          }
        },
        onFailure: (error) => {
          toast({
            title: "Payment Failed",
            description: error.message || "Payment could not be processed",
            variant: "destructive",
          });
        },
        userDetails: {
          name: user?.displayName,
          email: user?.email,
        },
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to initiate payment",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateDeal = async () => {
    if (!newDeal.chatId || !newDeal.vendorId || !newDeal.title || !newDeal.totalAmount) {
      toast({
        title: "Missing fields",
        description: !newDeal.chatId || !newDeal.vendorId
          ? "Please create escrow deals from within a chat conversation."
          : "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsCreating(true);
    try {
      toast({
        title: "Deal created!",
        description: "Proceeding to payment..."
      });

      const createdDeal = await createEscrowDeal({
        chatId: newDeal.chatId,
        vendorId: parseInt(newDeal.vendorId),
        title: newDeal.title,
        description: newDeal.description,
        totalAmount: parseFloat(newDeal.totalAmount)
      });

      setIsNewDealOpen(false);
      setNewDeal({ chatId: "", vendorId: "", title: "", description: "", totalAmount: "" });
      loadDeals();

      // Automatically trigger payment
      setTimeout(async () => {
        try {
          // Initiate payment
          const paymentOrder = await initiateEscrowPayment(createdDeal.id);

          // Open Razorpay checkout
          openCheckout({
            orderId: paymentOrder.orderId,
            amount: paymentOrder.amount,
            currency: paymentOrder.currency,
            name: "Escrow Payment",
            description: paymentOrder.title || createdDeal.title,
            onSuccess: async (response) => {
              // Verify payment with backend
              try {
                await verifyPayment({
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  type: "escrow",
                  entityId: createdDeal.id,
                });

                toast({
                  title: "Payment Successful!",
                  description: "Your escrow deal is now active.",
                });

                loadDeals();
              } catch (err) {
                toast({
                  title: "Verification Failed",
                  description: err instanceof Error ? err.message : "Failed to verify payment",
                  variant: "destructive",
                });
                // Delete the deal if payment verification fails
                await deleteEscrowDeal(createdDeal.id);
                loadDeals();
              }
            },
            onFailure: async (error) => {
              toast({
                title: "Payment Cancelled",
                description: "The deal has been removed since payment was not completed.",
                variant: "destructive",
              });
              // Delete the deal when payment is cancelled
              try {
                await deleteEscrowDeal(createdDeal.id);
                loadDeals();
              } catch (err) {
                console.error("Failed to delete deal:", err);
              }
            },
            userDetails: {
              name: user?.displayName,
              email: user?.email,
            },
          });
        } catch (err) {
          toast({
            title: "Error",
            description: err instanceof Error ? err.message : "Failed to initiate payment",
            variant: "destructive",
          });
          // Delete the deal if payment initiation fails
          try {
            await deleteEscrowDeal(createdDeal.id);
            loadDeals();
          } catch (deleteErr) {
            console.error("Failed to delete deal:", deleteErr);
          }
        }
      }, 500);
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create deal",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleRelease = async (dealId: number) => {
    const pct = parseFloat(releasePercent);
    if (!pct || pct < 1 || pct > 100) {
      toast({
        title: "Invalid percentage",
        description: "Enter a value between 1 and 100",
        variant: "destructive"
      });
      return;
    }

    setIsReleasing(true);
    try {
      await releaseEscrowPayment(dealId, {
        percent: pct,
        note: releaseNote || undefined
      });

      toast({
        title: "Payment released!",
        description: `${pct}% released successfully`
      });

      setReleasePercent("");
      setReleaseNote("");
      setSelectedDeal(null);
      loadDeals();
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to release payment",
        variant: "destructive"
      });
    } finally {
      setIsReleasing(false);
    }
  };

  if (authLoading || (isLoading && deals.length === 0)) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <Link to="/chat" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to chats
        </Link>

        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">Escrow Deals</h1>
          <Dialog open={isNewDealOpen} onOpenChange={setIsNewDealOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" /> New Deal
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader>
                <DialogTitle className="text-card-foreground">Create Escrow Deal</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-card-foreground">Chat ID</Label>
                  <Input
                    className="mt-1.5 bg-secondary border-border"
                    placeholder="chat_123_456_..."
                    value={newDeal.chatId}
                    onChange={(e) => setNewDeal({ ...newDeal, chatId: e.target.value })}
                    readOnly
                    disabled
                    title="Chat ID is automatically set from the conversation"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-populated from chat</p>
                </div>
                <div>
                  <Label className="text-card-foreground">Vendor ID</Label>
                  <Input
                    className="mt-1.5 bg-secondary border-border"
                    type="number"
                    placeholder="User ID of vendor"
                    value={newDeal.vendorId}
                    onChange={(e) => setNewDeal({ ...newDeal, vendorId: e.target.value })}
                    readOnly
                    disabled
                    title="Vendor ID is automatically set from the conversation"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Auto-populated from chat</p>
                </div>
                <div>
                  <Label className="text-card-foreground">Title</Label>
                  <Input
                    className="mt-1.5 bg-secondary border-border"
                    placeholder="Project name"
                    value={newDeal.title}
                    onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-card-foreground">Description</Label>
                  <Textarea
                    className="mt-1.5 bg-secondary border-border"
                    placeholder="Project details..."
                    value={newDeal.description}
                    onChange={(e) => setNewDeal({ ...newDeal, description: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-card-foreground">Total Amount (₹)</Label>
                  <Input
                    className="mt-1.5 bg-secondary border-border"
                    type="number"
                    placeholder="5000"
                    value={newDeal.totalAmount}
                    onChange={(e) => setNewDeal({ ...newDeal, totalAmount: e.target.value })}
                  />
                </div>
                <Button className="w-full" onClick={handleCreateDeal} disabled={isCreating}>
                  {isCreating ? "Creating..." : "Create Deal"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {deals.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No escrow deals yet. Create one to get started!</p>
            </CardContent>
          </Card>
        ) : (
          <ScrollArea className="h-[calc(100vh-160px)]">
            <div className="space-y-4">
              {deals.map((deal) => {
                const isClient = deal.clientId === user?.id;
                const otherParty = isClient ? deal.vendor : deal.client;
                const released = deal.totalAmount * (deal.releasedPercent / 100);
                const remaining = deal.totalAmount - released;

                return (
                  <Card key={deal.id} className="bg-card border-border">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg text-card-foreground">{deal.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">{deal.description}</p>
                          <p className="text-sm text-muted-foreground mt-1">
                            {isClient ? "Vendor" : "Client"}: {otherParty.displayName}
                          </p>
                        </div>
                        <Badge className={deal.status === "active" ? "bg-accent text-accent-foreground" : deal.status === "completed" ? "bg-green-500 text-white" : deal.status === "pending_payment" ? "bg-yellow-500 text-white" : "bg-muted text-muted-foreground"}>
                          {deal.status === "pending_payment" ? "Awaiting Payment" : deal.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {/* Amounts */}
                      <div className="grid grid-cols-3 gap-4 mb-4 text-center">
                        <div>
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="text-lg font-bold text-foreground">{formatCurrency(deal.totalAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Released</p>
                          <p className="text-lg font-bold text-primary">{formatCurrency(released)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Remaining</p>
                          <p className="text-lg font-bold text-coral">{formatCurrency(remaining)}</p>
                        </div>
                      </div>

                      {/* Progress */}
                      <div className="mb-4">
                        <div className="flex justify-between text-xs text-muted-foreground mb-1">
                          <span>Payment Progress</span>
                          <span>{deal.releasedPercent.toFixed(1)}%</span>
                        </div>
                        <Progress value={deal.releasedPercent} className="h-3" />
                      </div>

                      {/* Transactions */}
                      {deal.transactions.length > 0 && (
                        <div className="mb-4">
                          <h4 className="text-sm font-semibold text-card-foreground mb-2">Transaction History</h4>
                          <div className="space-y-2">
                            {deal.transactions.map((tx) => (
                              <div key={tx.id} className="flex items-center justify-between bg-secondary rounded-lg px-3 py-2">
                                <div>
                                  <p className="text-sm text-secondary-foreground">{tx.note || "Payment released"}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(tx.createdAt).toLocaleDateString()}
                                  </p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-semibold text-primary">{formatCurrency(tx.amount)}</p>
                                  <p className="text-xs text-muted-foreground">{tx.percent}%</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Release button - only for client and active deals */}
                      {isClient && deal.status === "active" && deal.releasedPercent < 100 && (
                        <Dialog open={selectedDeal === deal.id} onOpenChange={(open) => !open && setSelectedDeal(null)}>
                          <DialogTrigger asChild>
                            <Button className="w-full" onClick={() => setSelectedDeal(deal.id)}>
                              Release Payment
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-card border-border">
                            <DialogHeader>
                              <DialogTitle className="text-card-foreground">Release Payment</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label className="text-card-foreground">Percentage to Release</Label>
                                <Input
                                  className="mt-1.5 bg-secondary border-border"
                                  type="number"
                                  min="1"
                                  max={100 - deal.releasedPercent}
                                  placeholder={`Max ${(100 - deal.releasedPercent).toFixed(1)}%`}
                                  value={releasePercent}
                                  onChange={(e) => setReleasePercent(e.target.value)}
                                />
                              </div>
                              <div>
                                <Label className="text-card-foreground">Note</Label>
                                <Input
                                  className="mt-1.5 bg-secondary border-border"
                                  placeholder="Milestone completed..."
                                  value={releaseNote}
                                  onChange={(e) => setReleaseNote(e.target.value)}
                                />
                              </div>
                              <Button className="w-full" onClick={() => handleRelease(deal.id)} disabled={isReleasing}>
                                {isReleasing ? "Releasing..." : "Confirm Release"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* Payment button - for pending_payment deals */}
                      {isClient && deal.status === "pending_payment" && deal.paymentStatus !== "paid" && (
                        <Button className="w-full bg-primary" onClick={() => handlePayForDeal(deal)} disabled={isCreating}>
                          {isCreating ? "Processing..." : "Complete Payment"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
};

export default EscrowPage;
