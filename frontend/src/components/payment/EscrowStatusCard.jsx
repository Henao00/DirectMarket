/**
 * DirectMarket - Componente EscrowStatusCard
 *
 * Muestra la linea de tiempo del estado del escrow para una transaccion.
 * Visible tanto para compradores como vendedores.
 *
 * Trazabilidad:
 *   RF-06: visualizar el dinero retenido en escrow
 *   RF-07: indicar cuando el codigo fue validado y el pago liberado
 *   frm_estado_transaccion del catalogo de mockups
 */

import { Shield, CheckCircle, Clock, AlertTriangle } from 'lucide-react';
import clsx from 'clsx';
import { Alert, TransactionStatusBadge, CountdownTimer } from '../common';
import { formatDateTime, formatPrice } from '../../utils';

/**
 * Linea de tiempo de los estados del escrow.
 *
 * @param {Object} props
 * @param {Object} props.transaction - Objeto de la transaccion
 * @param {Object} props.codeStatus  - Estado del codigo (solo si es comprador)
 * @param {boolean} props.isBuyer    - Si el usuario actual es el comprador
 */
export default function EscrowStatusCard({ transaction, codeStatus, isBuyer }) {
  if (!transaction) return null;

  const STATUS_ORDER = ['pending_payment', 'escrow_held', 'code_validated', 'completed'];
  const currentIndex = STATUS_ORDER.indexOf(transaction.status);

  const steps = [
    {
      key:   'pending_payment',
      label: 'Pago iniciado',
      desc:  'La transaccion fue creada y el pago esta pendiente.'
    },
    {
      key:   'escrow_held',
      label: 'Dinero en escrow',
      desc:  'El pago fue confirmado. El dinero esta retenido de forma segura.'
    },
    {
      key:   'code_validated',
      label: 'Codigo validado',
      desc:  'El vendedor ingreso el codigo de liberacion correctamente.'
    },
    {
      key:   'completed',
      label: 'Transaccion completada',
      desc:  'El pago fue liberado al vendedor. Transaccion finalizada.'
    }
  ];

  // Estados especiales que interrumpen el flujo normal
  const isDisputed = transaction.status === 'disputed';
  const isRefunded = transaction.status === 'refunded';
  const isCancelled = transaction.status === 'cancelled';

  return (
    <div className="card p-6 space-y-5">
      {/* Encabezado con estado y monto */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-semibold text-neutral-800 mb-1">Estado del escrow</h2>
          <p className="text-sm text-neutral-500">
            Transaccion #{transaction.id?.slice(0, 8).toUpperCase()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold text-neutral-900">{formatPrice(transaction.amount)}</p>
          <TransactionStatusBadge status={transaction.status} />
        </div>
      </div>

      {/* Alerta de disputa activa */}
      {isDisputed && (
        <Alert type="danger">
          <strong>Disputa abierta.</strong> El pago esta congelado hasta que el administrador
          resuelva la situacion.
        </Alert>
      )}

      {/* Alerta de reembolso */}
      {isRefunded && (
        <Alert type="info">
          <strong>Reembolso procesado.</strong> El pago fue devuelto al comprador por
          resolucion del administrador.
        </Alert>
      )}

      {/* Banner de dinero en escrow */}
      {transaction.status === 'escrow_held' && (
        <div className="flex items-start gap-3 bg-brand-50 border border-brand-100 rounded-xl p-4">
          <Shield className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-brand-800">
              {formatPrice(transaction.amount)} retenido en escrow
            </p>
            <p className="text-xs text-brand-600 mt-0.5">
              {isBuyer
                ? 'Entrega el codigo al vendedor cuando recibas el producto.'
                : 'Solicita el codigo al comprador e ingresalo para recibir el pago.'}
            </p>
          </div>
        </div>
      )}

      {/* Estado del codigo de liberacion - solo comprador (CP-007) */}
      {isBuyer && codeStatus?.hasCode && transaction.status === 'escrow_held' && (
        <div className="bg-neutral-50 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-700">Codigo de liberacion</p>
            <span className={clsx(
              'text-xs font-medium px-2 py-0.5 rounded-full',
              codeStatus.isExpired  ? 'bg-danger-50 text-danger-600' :
              codeStatus.isBlocked  ? 'bg-danger-50 text-danger-600' :
              codeStatus.isUsed     ? 'bg-success-50 text-success-600' :
                                      'bg-brand-50 text-brand-600'
            )}>
              {codeStatus.isUsed    ? 'Utilizado' :
               codeStatus.isBlocked ? 'Bloqueado' :
               codeStatus.isExpired ? 'Expirado'  : 'Activo'}
            </span>
          </div>

          {!codeStatus.isUsed && !codeStatus.isBlocked && !codeStatus.isExpired && (
            <CountdownTimer expiresAt={codeStatus.expiresAt} />
          )}

          {!codeStatus.isBlocked && !codeStatus.isExpired && !codeStatus.isUsed && (
            <p className="text-xs text-neutral-500">
              Intentos restantes del vendedor:{' '}
              <strong>{codeStatus.attemptsRemaining}</strong> de 3
            </p>
          )}
        </div>
      )}

      {/* Linea de tiempo - solo para el flujo normal */}
      {!isDisputed && !isRefunded && !isCancelled && (
        <div className="space-y-0">
          {steps.map((step, idx) => {
            const isCompleted = idx <= currentIndex;
            const isCurrent   = idx === currentIndex;
            const isLast      = idx === steps.length - 1;

            return (
              <div key={step.key} className="flex gap-4">
                {/* Indicador y linea vertical */}
                <div className="flex flex-col items-center">
                  <div className={clsx(
                    'w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                    isCompleted
                      ? 'bg-brand-600 border-brand-600'
                      : 'bg-white border-neutral-200'
                  )}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4 text-white" />
                    ) : (
                      <span className="text-xs text-neutral-400 font-medium">{idx + 1}</span>
                    )}
                  </div>
                  {!isLast && (
                    <div className={clsx(
                      'w-0.5 flex-1 my-1',
                      isCompleted ? 'bg-brand-200' : 'bg-neutral-100'
                    )} style={{ minHeight: '24px' }} />
                  )}
                </div>

                {/* Contenido del paso */}
                <div className={clsx('pb-5', isLast && 'pb-0')}>
                  <p className={clsx(
                    'text-sm font-medium',
                    isCompleted ? 'text-neutral-900' : 'text-neutral-400'
                  )}>
                    {step.label}
                    {isCurrent && !isCompleted && (
                      <span className="ml-2 text-xs font-normal text-brand-600">
                        Estado actual
                      </span>
                    )}
                  </p>
                  {(isCompleted || isCurrent) && (
                    <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">
                      {step.desc}
                    </p>
                  )}
                  {/* Fecha de liberacion */}
                  {step.key === 'completed' && transaction.released_at && (
                    <p className="text-xs text-success-600 mt-0.5">
                      Liberado el {formatDateTime(transaction.released_at)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
