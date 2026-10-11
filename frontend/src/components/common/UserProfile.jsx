/**
 * DirectMarket - Componente UserProfile
 *
 * Muestra el perfil publico de un usuario con su reputacion
 * acumulada de calificaciones.
 *
 * Trazabilidad:
 *   RF-09: sistema de calificaciones y reputacion
 */

import { Star, ShoppingBag, Package, Award } from 'lucide-react';
import { StarRating, Badge } from '../common';
import { formatDate, getInitials } from '../../utils';
import clsx from 'clsx';

/**
 * @param {Object} props
 * @param {Object} props.user     - Datos del usuario
 * @param {Array}  props.ratings  - Calificaciones recibidas (opcional)
 * @param {string} props.size     - 'sm' | 'md' | 'lg'
 */
export default function UserProfile({ user, ratings = [], size = 'md' }) {
  if (!user) return null;

  const reputationScore = parseFloat(user.reputation_score || 0);
  const totalRatings    = user.total_ratings || 0;

  const reputationLabel =
    totalRatings === 0   ? 'Sin calificaciones' :
    reputationScore >= 4.5 ? 'Excelente'         :
    reputationScore >= 3.5 ? 'Muy bueno'         :
    reputationScore >= 2.5 ? 'Bueno'             :
    reputationScore >= 1.5 ? 'Regular'           : 'Bajo';

  const reputationColor =
    totalRatings === 0   ? 'text-neutral-400' :
    reputationScore >= 4.5 ? 'text-success-600' :
    reputationScore >= 3.5 ? 'text-success-500' :
    reputationScore >= 2.5 ? 'text-warning-600' :
    reputationScore >= 1.5 ? 'text-warning-500' : 'text-danger-600';

  if (size === 'sm') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
          <span className="text-brand-700 text-xs font-bold">{getInitials(user.name)}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-800 truncate">{user.name}</p>
          {totalRatings > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-warning-400 text-warning-400" />
              <span className="text-xs text-neutral-500">
                {reputationScore.toFixed(1)} ({totalRatings})
              </span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={clsx('card p-5 space-y-4', size === 'lg' && 'p-6')}>
      {/* Avatar y datos principales */}
      <div className="flex items-start gap-4">
        <div className={clsx(
          'bg-brand-100 rounded-2xl flex items-center justify-center flex-shrink-0',
          size === 'lg' ? 'w-16 h-16' : 'w-12 h-12'
        )}>
          <span className={clsx(
            'text-brand-700 font-bold',
            size === 'lg' ? 'text-xl' : 'text-base'
          )}>
            {getInitials(user.name)}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <h3 className={clsx(
            'font-semibold text-neutral-900 truncate',
            size === 'lg' ? 'text-lg' : 'text-base'
          )}>
            {user.name}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant={user.role === 'seller' ? 'brand' : 'neutral'}>
              {user.role === 'seller' ? 'Vendedor' : user.role === 'admin' ? 'Admin' : 'Comprador'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Reputacion */}
      <div className="bg-neutral-50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-neutral-600">Reputacion</p>
          <span className={clsx('text-sm font-semibold', reputationColor)}>
            {reputationLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <StarRating value={Math.round(reputationScore)} readonly size="sm" />
          <span className="text-sm text-neutral-500">
            {totalRatings > 0
              ? `${reputationScore.toFixed(1)} / 5 (${totalRatings} calificacion${totalRatings !== 1 ? 'es' : ''})`
              : 'Sin calificaciones aun'}
          </span>
        </div>

        {/* Barra de reputacion */}
        {totalRatings > 0 && (
          <div className="mt-3 h-1.5 bg-neutral-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full rounded-full transition-all duration-500',
                reputationScore >= 4.5 ? 'bg-success-500' :
                reputationScore >= 3.5 ? 'bg-success-400' :
                reputationScore >= 2.5 ? 'bg-warning-400' : 'bg-danger-400'
              )}
              style={{ width: `${(reputationScore / 5) * 100}%` }}
              aria-label={`Reputacion: ${reputationScore.toFixed(1)} de 5`}
            />
          </div>
        )}
      </div>

      {/* Historial de calificaciones recibidas */}
      {ratings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-neutral-700">
            Calificaciones recientes
          </h4>
          {ratings.slice(0, 3).map((rating) => (
            <div key={rating.id} className="border-b border-neutral-100 pb-3 last:border-0 last:pb-0">
              <div className="flex items-center justify-between mb-1">
                <StarRating value={rating.score} readonly size="sm" />
                <span className="text-xs text-neutral-400">
                  {formatDate(rating.created_at)}
                </span>
              </div>
              {rating.comment && (
                <p className="text-xs text-neutral-600 leading-relaxed">{rating.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
