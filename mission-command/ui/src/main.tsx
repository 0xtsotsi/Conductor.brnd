import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MastraReactProvider } from '@mastra/react';
import { AuthProvider } from './providers/AuthProvider';
import App from './App';
import './index.css';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

// Get API URL from environment
const MASTRA_API_URL = import.meta.env.VITE_MASTRA_API_URL || '';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <MastraReactProvider baseUrl={MASTRA_API_URL}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </MastraReactProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
