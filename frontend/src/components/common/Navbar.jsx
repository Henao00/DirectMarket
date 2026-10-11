/**
 * DirectMarket - Barra de Navegacion Principal
 *
 * Presente en todas las pantallas.
 * Checklist item 1: logo visible y consistente.
 * Checklist item 10: boton de cierre de sesion siempre visible.
 */

import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ShoppingBag, Package, BarChart3, LogOut, User, Menu, X, Plus } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import useAuthStore from '../../store/authStore';
import { Button } from '../common';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = isAuthenticated
    ? [
        { to: '/products', label: 'Explorar', icon: ShoppingBag },
        { to: '/my-purchases', label: 'Mis compras', icon: Package },
        { to: '/my-sales', label: 'Mis ventas', icon: BarChart3 },
        ...(user?.role === 'admin'
          ? [{ to: '/admin/disputes', label: 'Admin', icon: BarChart3 }]
          : [])
      ]
    : [];

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-neutral-100 shadow-sm">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo - Checklist item 1 */}
          <Link
            to={isAuthenticated ? '/products' : '/'}
            className="flex items-center gap-2.5 no-underline"
          >
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <ShoppingBag className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-lg font-bold text-neutral-900 tracking-tight">
              Direct<span className="text-brand-600">Market</span>
            </span>
          </Link>

          {/* Links de escritorio */}
          {isAuthenticated && (
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ to, label }) => (
                <Link
                  key={to}
                  to={to}
                  className={clsx(
                    'px-3.5 py-2 rounded-lg text-sm font-medium transition-colors no-underline',
                    location.pathname.startsWith(to)
                      ? 'bg-brand-50 text-brand-700'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50'
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Acciones de escritorio */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate('/products/new')}
                >
                  <Plus className="w-4 h-4" />
                  Publicar
                </Button>

                <div className="flex items-center gap-2 pl-2 border-l border-neutral-100">
                  <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-700" />
                  </div>
                  <div className="text-sm">
                    <p className="font-medium text-neutral-800 leading-none">{user?.name}</p>
                    <p className="text-neutral-400 text-xs mt-0.5 capitalize">{user?.role}</p>
                  </div>
                </div>

                {/* Checklist item 10: boton de cierre de sesion visible */}
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-neutral-400 hover:text-danger-600 hover:bg-danger-50 transition-colors"
                  title="Cerrar sesion"
                  aria-label="Cerrar sesion"
                >
                  <LogOut className="w-4.5 h-4.5" />
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')}>
                  Ingresar
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')}>
                  Crear cuenta
                </Button>
              </div>
            )}
          </div>

          {/* Boton menu movil */}
          <button
            className="md:hidden p-2 rounded-lg text-neutral-500 hover:bg-neutral-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Menu movil */}
        {mobileOpen && (
          <div className="md:hidden py-3 border-t border-neutral-100 animate-fade-in">
            {navLinks.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-neutral-700 hover:bg-neutral-50 rounded-lg no-underline"
                onClick={() => setMobileOpen(false)}
              >
                <Icon className="w-4 h-4 text-neutral-400" />
                {label}
              </Link>
            ))}
            {isAuthenticated && (
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 px-3 py-2.5 text-sm text-danger-600 hover:bg-danger-50 rounded-lg w-full mt-2"
              >
                <LogOut className="w-4 h-4" />
                Cerrar sesion
              </button>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}
