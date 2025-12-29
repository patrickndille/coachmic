import { ReactNode } from 'react';
import Header from './Header';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Header />
      <main className="flex-1">
        {children}
      </main>
      <footer className="py-4 text-center text-sm text-gray-500 border-t border-gray-200">
        <p>CoachMic - Built for the Google Cloud AI Partner Catalyst Hackathon</p>
      </footer>
    </div>
  );
}
