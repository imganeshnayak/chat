import React from 'react';
import { validatePassword } from '@/lib/passwordValidation';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PasswordStrengthProps {
    password: string;
}

const PasswordStrength: React.FC<PasswordStrengthProps> = ({ password }) => {
    if (!password) return null;

    const { requirements, score } = validatePassword(password);

    const getColor = () => {
        if (score <= 1) return 'bg-destructive';
        if (score <= 3) return 'bg-orange-500';
        return 'bg-green-500';
    };

    const labels = [
        { key: 'length', label: '8+ characters' },
        { key: 'upper', label: 'Uppercase letter' },
        { key: 'lower', label: 'Lowercase letter' },
        { key: 'number', label: 'Number' },
        { key: 'special', label: 'Special char' },
    ];

    return (
        <div className="mt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
            <div className="flex gap-1 h-1">
                {[...Array(4)].map((_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "flex-1 rounded-full transition-colors duration-500",
                            i < score ? getColor() : "bg-border"
                        )}
                    />
                ))}
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {labels.map(({ key, label }) => {
                    const met = requirements[key as keyof typeof requirements];
                    return (
                        <div key={key} className="flex items-center gap-1.5">
                            {met ? (
                                <Check className="h-3 w-3 text-green-500" />
                            ) : (
                                <X className="h-3 w-3 text-muted-foreground/50" />
                            )}
                            <span className={cn(
                                "text-[10px] uppercase font-medium tracking-wider transition-colors",
                                met ? "text-foreground" : "text-muted-foreground"
                            )}>
                                {label}
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PasswordStrength;
