import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { requestPayout } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CreditCard, Smartphone } from "lucide-react";

interface RequestPayoutDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    maxAmount: number;
    onSuccess: () => void;
}

const RequestPayoutDialog = ({ open, onOpenChange, maxAmount, onSuccess }: RequestPayoutDialogProps) => {
    const { toast } = useToast();
    const [isLoading, setIsLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"bank" | "upi">("bank");
    const [amount, setAmount] = useState("");
    const [accountName, setAccountName] = useState("");

    // Bank details
    const [bankAccount, setBankAccount] = useState("");
    const [ifscCode, setIfscCode] = useState("");

    // UPI details
    const [upiVpa, setUpiVpa] = useState("");

    // Contact details
    const [phoneNumber, setPhoneNumber] = useState("");
    const [email, setEmail] = useState("");

    const validateForm = () => {
        const numAmount = parseFloat(amount);
        if (isNaN(numAmount) || numAmount < 500) {
            toast({
                title: "Invalid Amount",
                description: "Minimum payout amount is ₹500",
                variant: "destructive",
            });
            return false;
        }

        if (numAmount > maxAmount) {
            toast({
                title: "Insufficient Balance",
                description: "You cannot withdraw more than your wallet balance",
                variant: "destructive",
            });
            return false;
        }

        if (!accountName.trim()) {
            toast({
                title: "Missing Details",
                description: "Please enter account holder name",
                variant: "destructive",
            });
            return false;
        }

        if (paymentMethod === "bank") {
            if (!bankAccount.trim() || !ifscCode.trim()) {
                toast({
                    title: "Missing Details",
                    description: "Please fill in all bank account details",
                    variant: "destructive",
                });
                return false;
            }
        }

        if (!phoneNumber.trim() || phoneNumber.length < 10) {
            toast({
                title: "Invalid Phone Number",
                description: "Please enter a valid phone number for admin contact",
                variant: "destructive",
            });
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        try {
            await requestPayout({
                amount: parseFloat(amount),
                paymentMethod,
                bankAccount: paymentMethod === "bank" ? bankAccount : undefined,
                ifscCode: paymentMethod === "bank" ? ifscCode : undefined,
                accountName,
                upiVpa: paymentMethod === "upi" ? upiVpa : undefined,
                phoneNumber,
                email: email || undefined
            });

            toast({
                title: "Payout Requested",
                description: `Your payout request via ${paymentMethod === "bank" ? "Bank Transfer" : "UPI"} has been submitted for approval.`,
            });

            onOpenChange(false);
            onSuccess();

            // Reset form
            setAmount("");
            setBankAccount("");
            setIfscCode("");
            setAccountName("");
            setUpiVpa("");
        } catch (error) {
            toast({
                title: "Error",
                description: error instanceof Error ? error.message : "Failed to request payout",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Request Payout</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="amount">Amount (₹)</Label>
                        <Input
                            id="amount"
                            type="number"
                            placeholder="Enter amount"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            min="500"
                            max={maxAmount}
                            required
                        />
                        <p className="text-xs text-muted-foreground">
                            Available: ₹{maxAmount.toLocaleString('en-IN')} | Minimum: ₹500
                        </p>
                    </div>

                    <Tabs value={paymentMethod} onValueChange={(val) => setPaymentMethod(val as "bank" | "upi")}>
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="bank">
                                <CreditCard className="mr-2 h-4 w-4" />
                                Bank Account
                            </TabsTrigger>
                            <TabsTrigger value="upi">
                                <Smartphone className="mr-2 h-4 w-4" />
                                UPI
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="bank" className="space-y-3 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="accountName">Account Holder Name</Label>
                                <Input
                                    id="accountName"
                                    placeholder="e.g. John Doe"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="bankAccount">Bank Account Number</Label>
                                <Input
                                    id="bankAccount"
                                    placeholder="e.g. 1234567890"
                                    value={bankAccount}
                                    onChange={(e) => setBankAccount(e.target.value)}
                                    required={paymentMethod === "bank"}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="ifscCode">IFSC Code</Label>
                                <Input
                                    id="ifscCode"
                                    placeholder="e.g. HDFC0001234"
                                    value={ifscCode}
                                    onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                    required={paymentMethod === "bank"}
                                />
                            </div>
                        </TabsContent>

                        <TabsContent value="upi" className="space-y-3 mt-4">
                            <div className="space-y-2">
                                <Label htmlFor="accountNameUpi">Account Holder Name</Label>
                                <Input
                                    id="accountNameUpi"
                                    placeholder="e.g. John Doe"
                                    value={accountName}
                                    onChange={(e) => setAccountName(e.target.value)}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="upiVpa">UPI ID</Label>
                                <Input
                                    id="upiVpa"
                                    placeholder="e.g. 9876543210@paytm"
                                    value={upiVpa}
                                    onChange={(e) => setUpiVpa(e.target.value.toLowerCase())}
                                    required={paymentMethod === "upi"}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Enter your UPI ID (e.g., user@paytm, 1234567890@oksbi)
                                </p>
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="border-t pt-4 mt-2 space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="phoneNumber">Phone Number (Required for Admin Contact)</Label>
                            <Input
                                id="phoneNumber"
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="contactEmail">Contact Email (Optional)</Label>
                            <Input
                                id="contactEmail"
                                type="email"
                                placeholder="e.g. john@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-4">
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Submit Request
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default RequestPayoutDialog;
