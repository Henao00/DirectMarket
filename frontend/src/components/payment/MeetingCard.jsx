/**
 * DirectMarket - Componente MeetingCard
 *
 * Muestra y gestiona la propuesta de encuentro fisico entre
 * comprador y vendedor para transacciones en efectivo.
 *
 * Trazabilidad:
 *   RF-04  : pactar lugar, fecha y hora para encuentro fisico
 *   CP-006 : fecha no puede ser en el pasado
 */

import { useState } from 'react';
import { MapPin, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { transactionsAPI } from '../../services/api';
import { Button, Alert, Badge } from '../common';
import { formatDateTime, isDateInFuture } from '../../utils';
import clsx from 'clsx';

const STATUS_CONFIG = {
  proposed:         { label: 'Propuesta enviada',   variant: 'warning' },
  confirmed:        { label: 'Confirmado',           variant: 'success' },
  counter_proposed: { label: 'Contrapropuesta',      variant: 'brand'   },
  cancelled:        { label: 'Cancelado',            variant: 'neutral' }
};

/**
 * @param {Object}   props
 * @param {Object}   props.meeting       - Objeto del encuentro
 * @param {string}   props.currentUserId - ID del usuario autenticado
 * @param {string}   props.buyerId       - ID del comprador de la transaccion
 * @param {Function} props.onUpdated     - Callback tras actualizar el estado
 */
export default function MeetingCard({ meeting, currentUserId, buyerId, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  if (!meeting) return null;

  const isProposer    = meeting.proposed_by === currentUserId;
  const canRespond    = !isProposer && meeting.status === 'proposed';
  const isPast        = !isDateInFuture(meeting.meeting_date);
  const statusConfig  = STATUS_CONFIG[meeting.status] || STATUS_CONFIG.proposed;

  const handleRespond = async (action) => {
    setError('');
    setLoading(true);
    try {
      await transactionsAPI.respondToMeeting(meeting.id, action);
      onUpdated?.();
    } catch (err) {
      setError(err.message || 'Error al responder a la propuesta.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card p-5 space-y-4">
      {/* Encabezado */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4.5 h-4.5 text-brand-600" />
          </div>
          <div>
            <h3 className="font-semibold text-neutral-800 text-sm">Encuentro fisico</h3>
            <p className="text-xs text-neutral-500">
              {isProposer ? 'Tu propuesta' : 'Propuesta recibida'}
            </p>
          </div>
        </div>
        <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
      </div>

      {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

      {/* Detalles del encuentro */}
      <div className="space-y-3 bg-neutral-50 rounded-xl p-4">
        {/* Fecha y hora */}
        <div className="flex items-start gap-3">
          <Clock className={clsx('w-4 h-4 flex-shrink-0 mt-0.5', isPast ? 'text-danger-500' : 'text-brand-600')} />
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-0.5">Fecha y hora</p>
            <p className={clsx('text-sm font-medium', isPast ? 'text-danger-600 line-through' : 'text-neutral-800')}>
              {formatDateTime(meeting.meeting_date)}
            </p>
            {isPast && (
              <p className="text-xs text-danger-500 mt-0.5">Esta fecha ya paso.</p>
            )}
          </div>
        </div>

        {/* Lugar */}
        <div className="flex items-start gap-3">
          <MapPin className="w-4 h-4 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-medium text-neutral-500 mb-0.5">Lugar de encuentro</p>
            <p className="text-sm text-neutral-800">{meeting.location_description}</p>
          </div>
        </div>

        {/* Notas adicionales */}
        {meeting.notes && (
          <div className="pt-2 border-t border-neutral-200">
            <p className="text-xs font-medium text-neutral-500 mb-0.5">Notas</p>
            <p className="text-sm text-neutral-600">{meeting.notes}</p>
          </div>
        )}
      </div>

      {/* Acciones para la parte que no propuso */}
      {canRespond && !isPast && (
        <div className="flex gap-2">
          <Button
            variant="primary"
            size="sm"
            className="flex-1"
            loading={loading}
            onClick={() => handleRespond('confirm')}
          >
            <CheckCircle className="w-4 h-4" />
            Confirmar encuentro
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            loading={loading}
            onClick={() => handleRespond('reject')}
          >
            <XCircle className="w-4 h-4" />
            Rechazar
          </Button>
        </div>
      )}

      {/* Estado de confirmacion */}
      {meeting.status === 'confirmed' && (
        <div className="flex items-center gap-2 text-success-600 text-sm font-medium">
          <CheckCircle className="w-4 h-4" />
          Encuentro confirmado por ambas partes.
        </div>
      )}
    </div>
  );
}
