
import React from 'react';

export const Sparkline: React.FC<{ data: number[], color: string, height?: number }> = ({ data, color, height = 20 }) => {
    if (data.length < 2) return null;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const width = 60;
    
    const points = data.map((val, i) => {
        const x = (i / (data.length - 1)) * width;
        const y = height - ((val - min) / range) * height;
        return `${x},${y}`;
    }).join(' ');

    return (
        <svg width={width} height={height} className="overflow-visible ml-2 opacity-80 flex-shrink-0">
            <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={(data.length-1)/(data.length-1)*width} cy={height - ((data[data.length-1] - min) / range) * height} r="2" fill={color} />
        </svg>
    );
};
