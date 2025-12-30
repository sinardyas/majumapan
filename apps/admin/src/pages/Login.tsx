import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button } from '@pos/ui';
import { useState } from 'react';

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    storeId: string | null;
  };
}

export default function Login() {
  const navigate = useNavigate();
  const { setAuth, setLoading, isLoading } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email,
        password,
      }, { skipAuth: true });

      if (response.success && response.data) {
        console.log('> response.data | Login.tsx line 40', { response: response.data })
        const { user, accessToken, refreshToken } = response.data;
        
        if (user.role !== 'admin') {
          setError('Access denied. This panel is for administrators only. Please use the POS web application.');
          setLoading(false);
          return;
        }

        setAuth(
          {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            storeId: user.storeId,
            pin: null,
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          accessToken,
          refreshToken
        );
        
        // navigate('/');
      } else {
        setError(response.error || 'Login failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-600 to-primary-800 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Majumapan</h1>
          <p className="text-primary-200">Admin Panel</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="label">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                placeholder="admin@example.com"
                required
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="label">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder="Enter your password"
                required
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Sign in as Admin
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 text-center mb-3">
              Demo credentials:
            </p>
            <div className="space-y-2 text-xs text-gray-600">
              <p><strong>Admin:</strong> admin@pos.local / admin123</p>
            </div>
          </div>
        </div>

        <p className="text-center text-primary-200 text-sm mt-6">
          Admin access required
        </p>
      </div>
    </div>
  );
}
