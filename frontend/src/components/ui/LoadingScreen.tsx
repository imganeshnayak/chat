import React from "react";
import { Loader2 } from "lucide-react";

const LoadingScreen = () => {
    return (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#050810] backdrop-blur-3xl animate-in fade-in duration-500">
            <div className="flex flex-col items-center gap-6">
                <h1 style={{ fontFamily: "'Syne', sans-serif" }} className="text-5xl font-bold tracking-tight text-white animate-pulse">Krovaa</h1>
                <div className="flex items-center gap-2 text-white/30">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    <span className="text-sm font-medium tracking-widest uppercase opacity-50">Initializing Secure Layer</span>
                </div>
            </div>
        </div>
    );

};

export default LoadingScreen;
