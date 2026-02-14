import { Monitor, LogOut } from 'lucide-react';

interface User {
  id: string;
  name: string;
  role: 'manager' | 'cashier';
  lastLoginAt: string | null;
}

interface UserSelectionScreenProps {
  users: User[];
  onSelectUser: (userId: string) => void;
  onSwitchDevice: () => void;
  deviceName: string;
  storeName: string;
  isLoading: boolean;
}

export function UserSelectionScreen({
  users,
  onSelectUser,
  onSwitchDevice,
  deviceName,
  storeName,
  isLoading,
}: UserSelectionScreenProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatLastLogin = (lastLoginAt: string | null) => {
    if (!lastLoginAt) return 'Never logged in';
    
    const date = new Date(lastLoginAt);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'manager':
        return 'Store Manager';
      case 'cashier':
        return 'Cashier';
      default:
        return role;
    }
  };

  // Sort users: manager first, then by name
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === 'manager' && b.role !== 'manager') return -1;
    if (a.role !== 'manager' && b.role === 'manager') return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Majumapan POS</h1>
          <div className="mt-2 flex items-center justify-center gap-2 text-gray-500">
            <Monitor className="w-4 h-4" />
            <span>{deviceName}</span>
            <span className="text-gray-300">|</span>
            <span>{storeName}</span>
          </div>
        </div>

        <div className="border-t border-gray-200 my-4" />

        <p className="text-sm font-medium text-gray-700 mb-4">Select Your Profile:</p>

        {/* User List */}
        <div className="space-y-3">
          {sortedUsers.map((user) => (
            <button
              key={user.id}
              onClick={() => onSelectUser(user.id)}
              disabled={isLoading}
              className="w-full flex items-center gap-4 p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors text-left disabled:opacity-50"
            >
              <div className="w-12 h-12 rounded-full bg-primary-600 text-white flex items-center justify-center text-lg font-semibold shrink-0">
                {getInitials(user.name)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900">{user.name}</div>
                <div className="text-sm text-gray-500">
                  {getRoleLabel(user.role)}
                </div>
                <div className="text-xs text-gray-400">
                  {formatLastLogin(user.lastLoginAt)}
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Switch Device */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <button
            onClick={onSwitchDevice}
            className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-900 py-2"
          >
            <LogOut className="w-4 h-4" />
            Switch Device
          </button>
        </div>
      </div>
    </div>
  );
}
