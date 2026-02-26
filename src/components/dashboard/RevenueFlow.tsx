import React from 'react';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RevenueFlowProps {
    impressions: number;
    reach: number;
    clicks: number;
    conversions: number;
    // Optional extra metrics for the extended funnel
    compromisso?: number;
    decisao?: number;
    retencao?: number;
    currency?: string;
    className?: string;
    campaignFilter?: 'all' | 'active' | 'paused';
    onCampaignFilterChange?: (filter: 'all' | 'active' | 'paused') => void;
}

export function RevenueFlow({
    impressions,
    reach,
    clicks,
    conversions,
    compromisso = 0,
    decisao = 0,
    retencao = 0,
    currency = 'BRL',
    className,
    campaignFilter = 'all',
    onCampaignFilterChange,
}: RevenueFlowProps) {
    const formatNumber = (num: number) => {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
        return num.toLocaleString('pt-BR');
    };

    const calculateConversion = (val: number, nextVal: number) => {
        if (val === 0) return '0.0%';
        return ((nextVal / val) * 100).toFixed(1) + '%';
    };

    return (
        <div className={cn(
            "relative overflow-hidden rounded-xl p-4 md:p-6 shadow-lg md:px-8 md:py-8 transition-all duration-300",
            // Dark mode (User's specific aesthetic)
            "dark:bg-gradient-to-br dark:from-[#2a0a0a]/80 dark:via-[#1a0505]/60 dark:to-[#2a0a0a]/80 dark:backdrop-blur-sm dark:border-red-900/30 dark:shadow-[0_0_40px_rgba(139,0,0,0.3)]",
            // Light mode (Clean premium aesthetic)
            "bg-white border border-slate-200 shadow-slate-200/50",
            className
        )}>
            {/* Background decoration for dark mode */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden hidden dark:block">
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[100px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-red-900/10 blur-[100px] rounded-full"></div>
            </div>

            <div className="mb-8 flex flex-col items-center relative z-10">
                <div className="flex items-center justify-center gap-4 w-full relative">
                    <h3 className="text-slate-800 dark:text-white/80 uppercase tracking-wider font-bold text-lg sm:text-xl">Fluxo de RECEITA</h3>
                    {onCampaignFilterChange && (
                        <div className="absolute right-0">
                            <Select value={campaignFilter} onValueChange={(v) => onCampaignFilterChange(v as any)}>
                                <SelectTrigger className="h-7 text-[10px] w-[90px] bg-slate-100 dark:bg-red-950/40 border-slate-200 dark:border-red-900/50 text-slate-600 dark:text-white/70">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-red-950 border-slate-200 dark:border-red-900 text-slate-600 dark:text-white/70">
                                    <SelectItem value="all" className="text-xs">Todas</SelectItem>
                                    <SelectItem value="active" className="text-xs">Ativas</SelectItem>
                                    <SelectItem value="paused" className="text-xs">Pausadas</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <p className="text-slate-400 dark:text-white/50 text-[10px] sm:text-xs mt-1.5 font-medium flex items-center gap-2">
                    <span className="w-4 h-px bg-slate-300 dark:bg-white/20"></span>
                    O fluxo percorre da direita para a esquerda
                    <span className="w-4 h-px bg-slate-300 dark:bg-white/20"></span>
                </p>
            </div>

            <div className="flex items-center justify-between gap-1 overflow-x-auto pb-4 no-scrollbar relative z-10">

                {/* Retenção (Leftmost) */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Retenção</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-60 transition-all duration-500 group-hover:opacity-80 dark:shadow-[0_0_25px_rgba(239,68,68,0.6)]" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)', transform: 'scale(1.13826)', background: 'linear-gradient(to bottom right, rgba(239, 68, 68, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-red-500/80 bg-white dark:bg-gradient-to-br dark:from-red-500/30 dark:to-red-900/20 shadow-md dark:shadow-[0_0_25px_rgba(239,68,68,0.6)]" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)', transform: 'scale(1.03147)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0px 100%, 0px 0px)', background: 'radial-gradient(circle, rgba(239, 68, 68, 0.4), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-red-600 dark:text-red-400 drop-shadow-sm dark:drop-shadow-[0_0_15px_rgba(239,68,68,0.8)]">{formatNumber(retencao)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(decisao, retencao)}</span>
                            </div>
                        </div>
                        {retencao === 0 && <span className="text-red-600 dark:text-red-500 text-[9px] mt-1.5 font-bold uppercase tracking-widest animate-pulse">GARGALO</span>}
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 10px rgba(239,68,68,0.4))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" opacity="0.9" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#ef4444" opacity="0.9"></polygon>
                        </svg>
                        <div className="absolute w-2 h-2 rounded-full bg-red-500 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Decisão */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Decisão</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 90%, 0% 10%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(decisao)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(compromisso, decisao)}</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.3))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#f59e0b" opacity="0.8"></polygon>
                        </svg>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Compromisso */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Compromisso</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 80%, 0% 20%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(compromisso)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(conversions, compromisso)}</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.3))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#f59e0b" opacity="0.8"></polygon>
                        </svg>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Qualificação */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Qualificação</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 30%, 100% 70%, 0% 70%, 0% 30%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(conversions)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(clicks, conversions)}</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.3))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#f59e0b" opacity="0.8"></polygon>
                        </svg>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Interesse */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Interesse</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 20%, 100% 80%, 0% 70%, 0% 30%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(clicks)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(reach, clicks)}</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.3))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#f59e0b" opacity="0.8"></polygon>
                        </svg>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Atenção */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Atenção</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 10%, 100% 90%, 0% 80%, 0% 20%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(reach)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">{calculateConversion(impressions, reach)}</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>

                    <div className="flex flex-col items-center justify-center relative -mx-1">
                        <svg width="24" height="60" viewBox="0 0 24 60" className="relative z-10 px-0 mx-6 sm:mx-8 xl:mx-10" style={{ filter: 'drop-shadow(0 0 8px rgba(234,179,8,0.3))' }}>
                            <line x1="20" y1="30" x2="4" y2="30" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round" opacity="0.8" pathLength="1" strokeDashoffset="0" strokeDasharray="1 1"></line>
                            <polygon points="4,30 11,25 11,35" fill="#f59e0b" opacity="0.8"></polygon>
                        </svg>
                        <div className="absolute w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" style={{ transform: 'translateX(18px)' }}></div>
                    </div>
                </div>

                {/* Exposição (Rightmost) */}
                <div className="flex items-center group">
                    <div className="flex flex-col items-center relative">
                        <span className="text-slate-500 dark:text-white/70 text-[10px] mb-2 text-center font-semibold">Exposição</span>
                        <div className="absolute top-8 left-1/2 -translate-x-1/2 h-[120px] w-[90px] rounded-sm opacity-40 transition-all duration-500 group-hover:opacity-60 dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)', background: 'linear-gradient(to bottom right, rgba(234, 179, 8, 0.1), transparent)' }}></div>
                        <div className="flex items-center justify-center border-2 sm:border-3 transition-all h-[120px] w-[90px] relative z-10 border-amber-500/60 dark:border-yellow-500 bg-white dark:bg-gradient-to-br dark:from-yellow-500/20 dark:to-yellow-900/10 shadow-sm dark:shadow-[0_0_15px_rgba(234,179,8,0.3)]" style={{ clipPath: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)' }}>
                            <div className="absolute inset-0 opacity-10 dark:opacity-30" style={{ clipPath: 'polygon(100% 0%, 100% 100%, 0% 90%, 0% 10%)', background: 'radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent)', transform: 'scale(1.0068)' }}></div>
                            <div className="flex flex-col items-center z-10">
                                <span className="text-base sm:text-lg font-bold text-amber-600 dark:text-yellow-400 drop-shadow-sm dark:drop-shadow-[0_0_8px_rgba(234,179,8,0.5)]">{formatNumber(impressions)}</span>
                                <span className="text-slate-400 dark:text-white/40 text-[9px] mt-0.5 font-medium">100%</span>
                            </div>
                        </div>
                        <div className="mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-bold bg-slate-100 dark:bg-yellow-950/80 text-slate-600 dark:text-yellow-400 border border-slate-200 dark:border-transparent">Na Média</div>
                    </div>
                </div>

            </div>
        </div>
    );
}
