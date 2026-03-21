
import React from 'react';
import { Layout } from '../components/Layout';
import { AiAssistant } from '../components/AiAssistant';
import { TranslationModule } from '../components/TranslationModule';

export const AiPage: React.FC = () => {
  return (
    <Layout title="Assistant IA">
      <div className="pb-4">
        <AiAssistant />
        
        <div className="mt-4 p-4 bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-800 dark:text-white mb-2 text-sm">Conseils d'utilisation</h3>
            <ul className="text-xs text-slate-500 dark:text-slate-400 space-y-2 list-disc pl-4">
                <li>Utilisez le micro pour dicter vos observations rapidement.</li>
                <li>Ne donnez jamais d'identité réelle (RGPD).</li>
                <li>En cas de doute, référez-vous toujours au Centre 15.</li>
            </ul>
        </div>
        
        <div className="mt-4">
          <TranslationModule />
        </div>
      </div>
    </Layout>
  );
};
