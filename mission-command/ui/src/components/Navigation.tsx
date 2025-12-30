import { Link, useLocation } from 'react-router-dom';
import { MissionCommandRole } from '@mastra/auth';

type NavigationProps = {
  currentUserRole: MissionCommandRole;
};

export function Navigation({ currentUserRole }: NavigationProps) {
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Catalog', accessibleTo: ['admin', 'operator', 'viewer'] as MissionCommandRole[] },
    { path: '/runs', label: 'Mission Runs', accessibleTo: ['admin', 'operator', 'viewer'] as MissionCommandRole[] },
    { path: '/approvals', label: 'Approvals', accessibleTo: ['admin', 'operator'] as MissionCommandRole[] },
    { path: '/profile', label: 'Profile', accessibleTo: ['admin', 'operator', 'viewer'] as MissionCommandRole[] },
    { path: '/audit', label: 'Audit Logs', accessibleTo: ['admin'] as MissionCommandRole[] },
    { path: '/admin/users', label: 'User Management', accessibleTo: ['admin'] as MissionCommandRole[] },
  ];

  const accessibleNavItems = navItems.filter(item =>
    item.accessibleTo.includes(currentUserRole)
  );

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

          {/* User Role Badge */}
          <div className="flex items-center">
            <span className="px-3 py-1 text-xs font-medium rounded-full bg-mastra-el-3 text-mastra-el-text border border-mastra-el-border">
              {currentUserRole}
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
