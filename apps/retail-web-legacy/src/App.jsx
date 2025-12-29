import { Toaster } from 'sonner';
import { AppQueryClientProvider } from './app/providers/QueryClientProvider';
import { AuthProvider } from './app/providers/AuthProvider';
import { ReduxProvider } from './app/providers/ReduxProvider';
import { AppRouter } from './app/router';

function App() {
  return (
    <AppQueryClientProvider>
      <ReduxProvider>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" />
        </AuthProvider>
      </ReduxProvider>
    </AppQueryClientProvider>
  );
}

export default App;
