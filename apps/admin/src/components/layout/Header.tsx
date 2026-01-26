import { useAuthStore } from '@/stores/authStore';
import { StoreSelector } from '../StoreSelector';

export function Header() {
  const { user } = useAuthStore();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-lg font-semibold text-gray-900">Admin Panel</h2>
      {user && (
        <div className="flex items-center gap-4">
          {user.role === 'admin' && (
            <div className="flex items-center gap-2">
              <StoreSelector />
            </div>
          )}
          <div className="text-sm text-gray-600">
            <span className="font-medium text-gray-900">{user.name}</span>
            <span className="mx-2">•</span>
            <span className="capitalize">{user.role}</span>
          </div>
        </div>
      )}
    </header>
  );
}
