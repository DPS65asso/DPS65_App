import React, { useEffect, useState, useRef } from 'react';
import { Layout } from '../../components/Layout';
import { storageService } from '../../services/storageService';
import { Mission, UserProfile } from '../../types';
import { authService } from '../../services/authService';
import { useAuth } from '../../context/AuthContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Download, Loader2 } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { addHeaderLogo } from '../../services/pdfUtils';

export const DashboardPage: React.FC = () => {
    const { isAdmin } = useAuth();
    const [missions, setMissions] = useState<Mission[]>([]);
    const [profiles, setProfiles] = useState<UserProfile[]>([]);
    const [isExporting, setIsExporting] = useState(false);
    const dashboardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        const data = await storageService.getMissions();
        setMissions(data);
        const allProfiles = await authService.getProfiles();
        setProfiles(allProfiles);
    };

    const exportPDF = async () => {
        if (!dashboardRef.current) return;
        setIsExporting(true);
        
        try {
            const canvas = await html2canvas(dashboardRef.current, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#f8fafc' // Slate-50 to match layout
            });
            
            const imgData = canvas.toDataURL('image/png');
            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const imgWidth = pageWidth - 20;
            const imgHeight = (canvas.height * imgWidth) / canvas.width;
            
            // Logo
            await addHeaderLogo(doc);
            
            // Header
            doc.setFontSize(18);
            doc.setTextColor(30, 41, 59); // Slate-800
            doc.text('Rapport de Performance DPS 65', 10, 15);
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139); // Slate-500
            doc.text(`Généré le ${new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short' }).format(new Date())}`, 10, 22);
            
            // Text Summary
            doc.setFontSize(12);
            doc.setTextColor(30, 41, 59);
            doc.text('Résumé des données :', 10, 35);
            doc.setFontSize(10);
            doc.text(`- Missions totales : ${missions.length}`, 15, 42);
            doc.text(`- Membres actifs : ${profiles.length}`, 15, 48);
            doc.text(`- Moyenne missions/membre : ${profiles.length > 0 ? (missions.length / profiles.length).toFixed(1) : 0}`, 15, 54);
            
            // Monthly Evolution Text
            doc.setFontSize(12);
            doc.text('Évolution mensuelle :', 10, 65);
            doc.setFontSize(10);
            monthlyEvolutionData.forEach((d, i) => {
                const col = i < 6 ? 0 : 1;
                const row = i % 6;
                doc.text(`${d.name}: ${d.missions} missions`, 15 + (col * 60), 72 + (row * 6));
            });

            // Member Performance Text
            doc.setFontSize(12);
            doc.text('Performance par membre (Top 10) :', 10, 115);
            doc.setFontSize(10);
            memberPerformanceData.forEach((d, i) => {
                const pct = missions.length > 0 ? ((d.missions / missions.length) * 100).toFixed(1) : 0;
                doc.text(`${i + 1}. ${d.firstName}: ${d.missions} missions (${pct}%)`, 15, 122 + (i * 6));
            });
            
            // Visual Charts
            doc.addPage();
            doc.setFontSize(14);
            doc.text('Visualisations Graphiques', 10, 15);
            doc.addImage(imgData, 'PNG', 10, 25, imgWidth, imgHeight);
            
            doc.save(`Rapport_Performance_${new Date().toISOString().split('T')[0]}.pdf`);
        } catch (error) {
            console.error('Export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const data = [
        { name: 'Missions', count: missions.length },
        { name: 'Utilisateurs', count: profiles.length },
    ];

    const memberPerformanceData = profiles.map(p => {
        const missionCount = missions.filter(m => (m.registeredUserIds || []).includes(p.id)).length;
        return {
            firstName: p.firstName,
            missions: missionCount,
        };
    }).sort((a, b) => b.missions - a.missions).slice(0, 10); // Top 10 for visibility

    const currentYear = new Date().getFullYear();
    const monthlyEvolutionData = Array.from({ length: 12 }, (_, i) => {
        const month = i;
        const count = missions.filter(m => {
            const d = new Date(m.date);
            return d.getMonth() === month && d.getFullYear() === currentYear;
        }).length;
        return {
            name: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(new Date(currentYear, month, 1)),
            missions: count
        };
    });

    return (
        <Layout title="Tableau de bord" showBack="/management" hideSync={true}>
            <div className="p-4 space-y-8 pb-20" ref={dashboardRef}>
                <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Statistiques Globales</h2>
                    {isAdmin && (
                        <button 
                            onClick={exportPDF} 
                            disabled={isExporting}
                            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-500/30 disabled:opacity-50"
                        >
                            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                            {isExporting ? 'Exportation...' : 'Exporter PDF'}
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Évolution Mensuelle ({currentYear})</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={monthlyEvolutionData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} style={{fontSize: '10px'}} />
                                    <YAxis axisLine={false} tickLine={false} style={{fontSize: '10px'}} />
                                    <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                                    <Line type="monotone" dataKey="missions" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Missions par Membre (Top 10)</h3>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={memberPerformanceData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="firstName" type="category" axisLine={false} tickLine={false} width={80} style={{fontSize: '10px', fontWeight: 'bold'}} />
                                    <Tooltip 
                                        cursor={{fill: '#f8fafc'}} 
                                        contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                        formatter={(value: any) => [`${value} missions (${missions.length > 0 ? ((Number(value) / missions.length) * 100).toFixed(1) : 0}%)`, 'Missions']}
                                    />
                                    <Bar dataKey="missions" fill="#10b981" radius={[0, 4, 4, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-4">Résumé des données</h3>
                    <div className="space-y-2">
                        <p className="text-xs text-blue-700 dark:text-blue-400 flex justify-between">
                            <span>Missions totales :</span>
                            <span className="font-bold">{missions.length}</span>
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 flex justify-between">
                            <span>Membres actifs :</span>
                            <span className="font-bold">{profiles.length}</span>
                        </p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 flex justify-between">
                            <span>Moyenne missions/membre :</span>
                            <span className="font-bold">{profiles.length > 0 ? (missions.length / profiles.length).toFixed(1) : 0}</span>
                        </p>
                    </div>
                </div>
            </div>
        </Layout>
    );
};
