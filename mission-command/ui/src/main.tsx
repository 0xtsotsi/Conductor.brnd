import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MastraClientProvider } from '@mastra/react';
import App from './App';
import { AuthProvider } from './providers/AuthProvider';
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
const apiUrl = import.meta.env.VITE_MASTRA_API_URL || 'http://localhost:4111';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <MastraClientProvider baseUrl={apiUrl}>
        <AuthProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AuthProvider>
      </MastraClientProvider>
    </QueryClientProvider>
  </StrictMode>,
);
