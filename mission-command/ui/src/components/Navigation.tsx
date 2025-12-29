import { Link, useLocation } from 'react-router-dom';
import { MissionCommandRole } from '@mastra/auth';
import { useAuth } from '../providers/AuthProvider';

export function Navigation() {
  const { user, role, logout } = useAuth();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Catalog', accessibleTo: ['admin', 'operator', 'viewer'] as MissionCommandRole[] },
    { path: '/runs', label: 'Mission Runs', accessibleTo: ['admin', 'operator', 'viewer'] as MissionCommandRole[] },
    { path: '/approvals', label: 'Approvals', accessibleTo: ['admin', 'operator'] as MissionCommandRole[] },
  ];

  const accessibleNavItems = role
    ? navItems.filter(item => item.accessibleTo.includes(role))
    : [];

  return (
    <nav className="bg-mastra-bg-2 border-b border-mastra-el-border">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* App Name */}
          <div className="flex items-center">
            <Link to="/" className="text-xl font-bold text-mastra-el-text">
              Mission Command Centre
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-6">
            {accessibleNavItems.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`text-sm font-medium transition-colors hover:text-mastra-el-text-hover ${
                  location.pathname === item.path
                    ? 'text-mastra-el-accent'
                    : 'text-mastra-el-text-muted'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>

          {/* User Info and Logout */}
          <div className="flex items-center gap-3">
            {/* User Role Badge */}
            {role && (
              <span className="px-3 py-1 text-xs font-medium rounded-full bg-mastra-el-3 text-mastra-el-text border border-mastra-el-border">
                {role}
              </span>
            )}

            {/* User Email */}
            {user?.email && (
              <span className="text-sm text-mastra-el-text-muted hidden sm:inline-block">
                {user.email}
              </span>
            )}

            {/* Logout Button */}
            <button
              onClick={logout}
              className="px-3 py-1 text-sm font-medium rounded-md bg-mastra-el-3 text-mastra-el-text hover:bg-mastra-el-3/80 transition-colors"
              title="Logout"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
