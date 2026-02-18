import { useToast } from "@/hooks/use-toast";

interface RazorpayOptions {
    key: string;
    amount: number;
    currency: string;
    name: string;
    description: string;
    order_id: string;
    handler: (response: RazorpayResponse) => void;
    prefill?: {
        name?: string;
        email?: string;
        contact?: string;
    };
    theme?: {
        color: string;
    };
    modal?: {
        ondismiss: () => void;
    };
}

interface RazorpayResponse {
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
}

declare global {
    interface Window {
        Razorpay: any;
    }
}

export function useRazorpay() {
    const { toast } = useToast();

    const openCheckout = ({
        orderId,
        amount,
        currency = "INR",
        name,
        description,
        onSuccess,
        onFailure,
        userDetails,
        keyId,
    }: {
        orderId: string;
        amount: number;
        currency?: string;
        name: string;
        description: string;
        onSuccess: (response: RazorpayResponse) => void;
        onFailure?: (error: any) => void;
        userDetails?: {
            name?: string;
            email?: string;
            contact?: string;
        };
        keyId?: string;
    }) => {
        if (!window.Razorpay) {
            toast({
                title: "Payment Error",
                description: "Payment system not loaded. Please refresh the page.",
                variant: "destructive",
            });
            return;
        }

        const options: RazorpayOptions = {
            key: keyId || import.meta.env.VITE_RAZORPAY_KEY_ID || "",
            amount,
            currency,
            name,
            description,
            order_id: orderId,
            handler: (response) => {
                toast({
                    title: "Payment Successful!",
                    description: "Processing your payment...",
                });
                onSuccess(response);
            },
            prefill: {
                name: userDetails?.name,
                email: userDetails?.email,
                contact: userDetails?.contact
            },
            theme: {
                color: "#4F46E5",
            },
            modal: {
                ondismiss: () => {
                    if (onFailure) {
                        onFailure(new Error("Payment cancelled by user"));
                    }
                },
            },
        };

        const razorpay = new window.Razorpay(options);

        razorpay.on("payment.failed", (response: any) => {
            toast({
                title: "Payment Failed",
                description: response.error.description || "Payment could not be processed.",
                variant: "destructive",
            });

            if (onFailure) {
                onFailure(response.error);
            }
        });

        razorpay.open();
    };

    return { openCheckout };
}
