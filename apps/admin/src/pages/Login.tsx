import { useAuthStore } from '@/stores/authStore';
import { api } from '@/services/api';
import { Button, Card, CardContent, Input } from '@pos/ui';
import { useToast } from '@pos/ui';
import { useState } from 'react';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

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

interface FieldErrors {
  email?: string;
  password?: string;
}

export default function Login() {
  const { setAuth, setLoading, isLoading } = useAuthStore();
  const { error: showToast } = useToast();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');

  const handleChange = (field: keyof LoginFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setErrors({});

    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as keyof FieldErrors;
        if (field) {
          fieldErrors[field] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        email: formData.email,
        password: formData.password,
      }, { skipAuth: true, skipAuthHandling: true });

      if (response.success && response.data) {
        const { user, accessToken, refreshToken } = response.data;

        if (user.role !== 'admin') {
          const accessError = 'Access denied. This panel is for administrators only. Please use the POS web application.';
          setError(accessError);
          showToast('Access Denied', accessError);
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
      } else {
        const errorMessage = response.error || 'Login failed';
        setError(errorMessage);
        showToast('Login Failed', errorMessage);
      }
    } catch (err) {
      const errorMessage = 'An unexpected error occurred';
      setError(errorMessage);
      showToast('Error', errorMessage);
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

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-gray-700">
                  Email address
                </label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange('email', e.target.value)}
                  placeholder="admin@example.com"
                  autoComplete="email"
                  disabled={isLoading}
                  className={errors.email ? 'border-red-500' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-red-500">{errors.email}</p>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  disabled={isLoading}
                  className={errors.password ? 'border-red-500' : ''}
                />
                {errors.password && (
                  <p className="text-sm text-red-500">{errors.password}</p>
                )}
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
          </CardContent>
        </Card>

        <p className="text-center text-primary-200 text-sm mt-6">
          Admin access required
        </p>
      </div>
    </div>
  );
}
