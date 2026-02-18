import React, { useState, useEffect } from "react";
import { X, Send, FileText, Image as ImageIcon, Film, Loader2, Eye, EyeOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface FilePreviewDialogProps {
    file: File | null;
    isOpen: boolean;
    onClose: () => void;
    onSend: (caption: string, isViewOnce: boolean) => void;
    isUploading?: boolean;
}

const FilePreviewDialog = ({ file, isOpen, onClose, onSend, isUploading = false }: FilePreviewDialogProps) => {
    const [caption, setCaption] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isViewOnce, setIsViewOnce] = useState(false);

    useEffect(() => {
        if (file && file.type.startsWith("image/")) {
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            return () => URL.revokeObjectURL(url);
        } else {
            setPreviewUrl(null);
        }
    }, [file]);

    const handleSend = () => {
        onSend(caption, isViewOnce);
        setCaption("");
        setIsViewOnce(false);
        onClose();
    };

    if (!file) return null;

    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card border-border">
                <DialogHeader className="p-4 border-b border-border flex flex-row items-center justify-between">
                    <DialogTitle className="text-foreground">{isUploading ? "Uploading..." : "Preview File"}</DialogTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full" disabled={isUploading}>
                        <X className="h-4 w-4" />
                    </Button>
                </DialogHeader>

                <div className="p-6 flex flex-col items-center justify-center min-h-[300px] bg-secondary/30">
                    {isImage && previewUrl ? (
                        <div className="relative w-full aspect-square max-h-[350px] rounded-lg overflow-hidden shadow-lg border border-border">
                            <img src={previewUrl} alt="Preview" className="w-full h-full object-contain bg-black/5" />
                        </div>
                    ) : isVideo ? (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="p-6 rounded-full bg-primary/10">
                                <Film className="h-12 w-12 text-primary" />
                            </div>
                            <p className="text-xs">Video file ({(file.size / (1024 * 1024)).toFixed(2)} MB)</p>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-4 text-muted-foreground">
                            <div className="p-6 rounded-full bg-secondary">
                                <FileText className="h-12 w-12" />
                            </div>
                            <p className="font-medium text-foreground text-center px-4">{file.name}</p>
                            <p className="text-xs">{(file.size / 1024).toFixed(2)} KB</p>
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-4">
                    <div className="relative">
                        <Input
                            placeholder="Add a caption..."
                            value={caption}
                            onChange={(e) => setCaption(e.target.value)}
                            className="bg-secondary border-border pl-4 pr-10 py-6"
                            onKeyDown={(e) => e.key === "Enter" && !isUploading && handleSend()}
                            disabled={isUploading}
                            autoFocus
                        />
                        {(isImage || isVideo) && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-full transition-colors ${isViewOnce ? 'text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary' : 'text-muted-foreground hover:bg-secondary'}`}
                                onClick={() => setIsViewOnce(!isViewOnce)}
                                title={isViewOnce ? "View Once Active" : "View Once"}
                                disabled={isUploading}
                            >
                                {isViewOnce ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        )}
                    </div>
                </div>

                <DialogFooter className="p-4 bg-secondary/50 border-t border-border sm:justify-end">
                    <Button variant="ghost" onClick={onClose} disabled={isUploading}>Cancel</Button>
                    <Button onClick={handleSend} className="gap-2" disabled={isUploading}>
                        {isUploading ? (
                            <>
                                <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                            </>
                        ) : (
                            <>
                                <Send className="h-4 w-4" /> Send
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default FilePreviewDialog;
