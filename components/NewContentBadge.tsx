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
        const hasBg = className.includes('bg-');
        const bgClass = hasBg ? '' : (text ? 'bg-gradient-to-r from-amber-500 to-orange-600 dark:from-amber-600 dark:to-orange-700' : 'bg-red-500 dark:bg-rose-600');
        return (
            <span className={`inline-flex items-center justify-center px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-tight leading-none text-white rounded-full shadow-xs shrink-0 ${bgClass} ${className}`}>
                {text || 'NEW'}
            </span>
        );
    }

    const hasPosition = className.includes('absolute') || className.includes('fixed') || className.includes('relative');

    return (
        <span className={`${hasPosition ? '' : 'relative'} inline-flex items-center justify-center shrink-0 w-3 h-3 ${className}`} id="new-content-badge">
            {animate && (
                <span className="animate-ping absolute inset-0 rounded-full bg-red-500 opacity-75 pointer-events-none"></span>
            )}
            <span className="relative inline-block w-2.5 h-2.5 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900 shadow-xs shrink-0"></span>
        </span>
    );
};
