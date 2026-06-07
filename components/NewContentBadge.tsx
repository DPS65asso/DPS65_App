import React from 'react';

interface NewContentBadgeProps {
    show?: boolean;
    animate?: boolean;
    className?: string;
    variant?: 'dot' | 'pill';
    text?: string;
}

export const NewContentBadge: React.FC<NewContentBadgeProps> = ({ 
    show = true, 
    animate = true, 
    className = '',
    variant = 'dot',
    text
}) => {
    if (!show) return null;

    if (variant === 'pill' || text) {
        return (
            <span className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-black uppercase tracking-tighter leading-none text-white bg-red-500 dark:bg-rose-600 rounded-full shadow-sm shadow-red-500/20 ${className}`}>
                {text || 'NEW'}
            </span>
        );
    }

    const isAbsolute = className.includes('absolute');
    const hasSize = className.includes('h-') || className.includes('w-');
    const sizeClasses = hasSize ? '' : 'h-3 w-3';

    return (
        <span className={`${isAbsolute ? '' : 'relative'} flex ${sizeClasses} shrink-0 rounded-full bg-red-500 dark:bg-rose-500 shadow-xs shadow-red-500/30 ${className}`} id="new-content-badge">
            {animate && (
                <span className="animate-ping absolute inset-0 rounded-full bg-red-400 dark:bg-rose-400 opacity-75"></span>
            )}
        </span>
    );
};
