import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { FilterBar } from './FilterBar';
import { Footer } from './Footer';
import { Chatbot } from './Chatbot';

export function Layout() {
  const loc = useLocation();
  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-night-bg">
      <TopNav />
      <FilterBar />
      <main
        key={loc.pathname}
        className="flex-1 px-4 sm:px-6 py-7 max-w-[1320px] w-full mx-auto animate-page-in"
      >
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </div>
  );
}
