import { ReactNode } from 'react';
import { TabBar } from './TabBar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Content */}
      <main className="px-4 py-4">
        {children}
      </main>

      {/* Tab Bar */}
      <TabBar />
    </div>
  );
};
