import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setRetailToken } from '@/store/authSlice';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export default function RetailLoginPage() {
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!token.trim()) {
      toast.error('Please enter a token');
      return;
    }

    setIsLoading(true);
    try {
      // Store token in Redux
      dispatch(setRetailToken(token));
      toast.success('Logged in successfully');
      navigate('/retail/dashboard');
    } catch (error) {
      toast.error('Failed to log in');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Retail Dashboard Login</CardTitle>
          <CardDescription>
            Enter your authentication token to access the retail dashboard
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="block text-sm font-medium mb-2">
                Authentication Token
              </label>
              <Input
                id="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your JWT token here"
                className="font-mono text-sm"
                disabled={isLoading}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Don't have a token? Contact your administrator.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

