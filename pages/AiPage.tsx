
import React from 'react';
import { Layout } from '../components/Layout';
import { AiAssistant } from '../components/AiAssistant';
import { TranslationModule } from '../components/TranslationModule';

export const AiPage: React.FC = () => {
  return (
    <Layout title="Assistant IA">
      <div className="pb-4 space-y-4">
        <AiAssistant />
        <TranslationModule />
      </div>
    </Layout>
  );
};

