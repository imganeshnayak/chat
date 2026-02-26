import React from "react";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md animate-in fade-in duration-500">
            <div className="relative flex flex-col items-center gap-4">
                {/* Animated App Logo/Icon Container */}
                <div className="relative h-20 w-20 flex items-center justify-center">
                    <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping duration-[2000ms]" />
                    <div className="absolute inset-2 rounded-full bg-primary/40 animate-pulse duration-[1500ms]" />
                    <div className="relative z-10 flex items-center justify-center h-12 w-12 rounded-xl bg-primary text-primary-foreground shadow-xl">
                        <span className="text-2xl font-bold italic">K</span>
                    </div>
                </div>

                {/* Loading Text and Spinner */}
                <div className="flex flex-col items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-foreground">Krovaa</h2>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        <span className="text-sm font-medium animate-pulse">Initializing components...</span>
                    </div>
                </div>
            </div>

            {/* Bottom accent (optional) */}
            <div className="absolute bottom-10 left-0 right-0 flex justify-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] opacity-50">Secure Communication Layer</p>
            </div>
        </div>
    );
};

export default LoadingScreen;
