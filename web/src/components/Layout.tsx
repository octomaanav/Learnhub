import { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({
  children
}: LayoutProps) => {
  return (
    <div className="min-h-screen bg-linear-to-br from-surface-50 via-primary-50/20 to-secondary-50/20">
      {children}
    </div>
  );
};
