/**
 * DirectMarket - Paginas del Flujo de Pago y Escrow
 *
 * frm_checkout / frm_codigo_liberacion / frm_ingresar_codigo / frm_estado_transaccion
 *
 * Trazabilidad:
 *   RF-03: elegir modalidad de pago
 *   RF-04: pactar encuentro fisico (CP-006: fecha no puede ser en el pasado)
 *   RF-05: mostrar codigo de liberacion generado (CP-007: solo al comprador)
 *   RF-06: mostrar estado del escrow / dinero retenido
 *   RF-07: vendedor ingresa codigo para liberar (CP-008: max 3 intentos)
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Shield, AlertCircle, CheckCircle, Clock, MapPin, Calendar, Lock } from 'lucide-react';
import { transactionsAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import {
  Button, Alert, Input, SecureBadge, CountdownTimer,
  TransactionStatusBadge, PageLoader, Modal
} from '../../components/common';

// ---------------------------------------------------------------------------
// CHECKOUT - frm_checkout
// RF-03: confirmar modalidad de pago
// RF-06: activar el escrow
// ---------------------------------------------------------------------------

export function CheckoutPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [transaction, setTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  const [releaseCode, setReleaseCode] = useState(null);

  useEffect(() => {
    // En produccion se obtendria el detalle de la transaccion
    // Aqui simulamos la carga del estado
    setTimeout(() => setLoading(false), 500);
  }, [transactionId]);

  // RF-06: confirmar pago virtual -> activa escrow + genera codigo
  const handleConfirmVirtualPayment = async () => {
    setError('');
    setConfirming(true);
    try {
      // En produccion gatewayRef viene del resultado de la pasarela de pagos
      const mockGatewayRef = `GW-${Date.now()}`;
      const res = await transactionsAPI.confirmPayment(transactionId, mockGatewayRef);

      // CP-007: el codigo de liberacion se muestra SOLO al comprador autenticado
      // y solo en este momento (una sola vez en texto plano)
      setReleaseCode(res.data.releaseCode);
    } catch (err) {
      setError(err.message || 'Error al confirmar el pago.');
    } finally {
      setConfirming(false);
    }
  };

  if (loading) return <PageLoader />;

  // Si ya se genero el codigo, mostrar la pantalla del codigo de liberacion
  if (releaseCode) {
    return <ReleaseCodeDisplay releaseCode={releaseCode} transactionId={transactionId} />;
  }

  return (
    <div className="page-container max-w-xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Confirmar compra</h1>
        <p className="text-neutral-500 mt-1">Transaccion #{transactionId?.slice(0, 8)}</p>
      </div>

      <div className="space-y-4">
        {error && <Alert type="danger">{error}</Alert>}

        {/* Indicador de seguridad - checklist item 11 */}
        <div className="flex justify-center">
          <SecureBadge />
        </div>

        {/* Resumen del pago */}
        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-4">Resumen del pedido</h2>

          <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 mb-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-brand-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-brand-800">Pago protegido con escrow</p>
                <p className="text-xs text-brand-600 mt-0.5">
                  Tu dinero quedara retenido de forma segura hasta que confirmes la
                  recepcion del producto con tu codigo de liberacion.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-neutral-600">
              <span>Modalidad de pago</span>
              <span className="font-medium">Pago virtual (Escrow)</span>
            </div>
            <div className="flex justify-between text-neutral-600">
              <span>Estado del dinero</span>
              <span className="font-medium text-warning-600">Sera retenido en escrow</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-3">Como funciona el escrow</h2>
          <ol className="space-y-3">
            {[
              { n: 1, text: 'Confirmas el pago. El dinero queda retenido de forma segura.' },
              { n: 2, text: 'Recibes un codigo unico de 8 caracteres (visible solo para ti).' },
              { n: 3, text: 'Al recibir el producto, entregas el codigo al vendedor.' },
              { n: 4, text: 'El vendedor ingresa el codigo y el pago es liberado automaticamente.' }
            ].map(({ n, text }) => (
              <li key={n} className="flex items-start gap-3">
                <span className="w-6 h-6 bg-brand-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {n}
                </span>
                <span className="text-sm text-neutral-600">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={confirming}
          onClick={handleConfirmVirtualPayment}
        >
          <Lock className="w-5 h-5" />
          Confirmar pago seguro
        </Button>

        <Button
          variant="ghost"
          className="w-full"
          onClick={() => navigate(-1)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PANTALLA DEL CODIGO DE LIBERACION - frm_codigo_liberacion
// RF-05, CP-007: codigo visible solo al comprador autenticado
// RNF-02: countdown de 24 horas
// ---------------------------------------------------------------------------

function ReleaseCodeDisplay({ releaseCode, transactionId }) {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(releaseCode.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="page-container max-w-lg">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-success-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-success-600" />
        </div>
        <h1 className="text-2xl font-bold text-neutral-900">Pago confirmado</h1>
        <p className="text-neutral-500 mt-1.5">Tu dinero esta seguro en escrow</p>
      </div>

      <div className="card p-6 space-y-6">
        {/* Alerta de seguridad - CP-007 */}
        <Alert type="warning">
          <strong>Solo para ti:</strong> Este codigo es secreto. Entrégaselo al vendedor
          UNICAMENTE cuando hayas recibido y verificado el producto.
        </Alert>

        {/* Codigo de liberacion - CP-007 */}
        <div className="text-center">
          <p className="text-sm font-medium text-neutral-500 mb-3">Tu codigo de liberacion</p>
          <div className="escrow-code-display">{releaseCode.code}</div>

          <button
            onClick={handleCopy}
            className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium"
          >
            {copied ? 'Copiado!' : 'Copiar codigo'}
          </button>
        </div>

        {/* Countdown - RNF-02: expira en 24 horas */}
        <div className="bg-neutral-50 rounded-xl p-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-neutral-500" />
            <span className="text-sm text-neutral-600 font-medium">Tiempo de validez</span>
          </div>
          <CountdownTimer
            expiresAt={releaseCode.expiresAt}
            onExpired={() => {}}
          />
          <p className="text-xs text-neutral-500 mt-1">El codigo expira en 24 horas (RNF-02)</p>
        </div>

        <div className="text-center text-xs text-neutral-500 bg-neutral-50 rounded-xl p-3">
          El dinero permanecera en escrow hasta que el vendedor ingrese este codigo.
          Si hay problemas, puedes reportarlos desde "Mis compras".
        </div>

        <Button
          variant="primary"
          className="w-full"
          onClick={() => navigate('/my-purchases')}
        >
          Ver mis compras
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// INGRESO DE CODIGO POR EL VENDEDOR - frm_ingresar_codigo
// RF-07, CP-008: max 3 intentos; codigo expirado
// ---------------------------------------------------------------------------

export function ValidateCodePage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleValidate = async () => {
    const trimmed = code.trim().toUpperCase();

    // Validacion frontend del formato (8 chars)
    if (trimmed.length !== 8) {
      setError('El codigo debe tener exactamente 8 caracteres.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await transactionsAPI.validateCode(transactionId, trimmed);
      setResult(res.data);
    } catch (err) {
      setError(err.message || 'Error al validar el codigo.');
      // Si la respuesta incluye el resultado del intento fallido
      if (err.data) setResult(err.data);
    } finally {
      setLoading(false);
    }
  };

  // Resultado exitoso
  if (result?.success) {
    return (
      <div className="page-container max-w-lg">
        <div className="card p-8 text-center space-y-5">
          <div className="w-20 h-20 bg-success-50 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-neutral-900">Pago liberado</h1>
            <p className="text-neutral-500 mt-2">
              El codigo fue validado correctamente. El dinero ha sido transferido a tu cuenta.
            </p>
          </div>
          <Button variant="primary" className="w-full" onClick={() => navigate('/my-sales')}>
            Ver mis ventas
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Validar entrega</h1>
        <p className="text-neutral-500 mt-1">
          Ingresa el codigo de liberacion que te entrego el comprador
        </p>
      </div>

      <div className="card p-6 space-y-5">
        {error && <Alert type="danger">{error}</Alert>}

        {/* CP-008: mostrar intentos restantes */}
        {result && !result.success && result.attemptsRemaining !== undefined && (
          <Alert type="warning">
            Codigo incorrecto. Intentos restantes: <strong>{result.attemptsRemaining}</strong> de 3.
          </Alert>
        )}

        {/* CP-008: codigo bloqueado */}
        {result?.blocked && (
          <Alert type="danger">
            El proceso ha sido bloqueado por demasiados intentos fallidos.
            El administrador ha sido notificado.
          </Alert>
        )}

        <div>
          <label className="form-label">
            Codigo de liberacion <span className="text-danger-500">*</span>
          </label>
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 8))}
            placeholder="XXXXXXXX"
            className="form-input text-center font-mono text-xl tracking-widest uppercase"
            maxLength={8}
            disabled={result?.blocked}
            aria-label="Codigo de liberacion de 8 caracteres"
            aria-describedby="code-hint"
          />
          <p id="code-hint" className="form-hint">8 caracteres alfanumericos en mayusculas</p>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          onClick={handleValidate}
          disabled={code.length !== 8 || result?.blocked}
        >
          Validar codigo y liberar pago
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VISTA DEL ESTADO DE LA TRANSACCION - frm_estado_transaccion
// RF-06: visualizar el escrow
// RF-08: acceso rapido al reporte de problemas (checklist item 12: max 2 clics)
// ---------------------------------------------------------------------------

export function TransactionDetailPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [transaction, setTransaction] = useState(null);
  const [codeStatus, setCodeStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  useEffect(() => {
    // Cargar detalle de transaccion
    // En una implementacion real se llamaria transactionsAPI.getById(transactionId)
    setLoading(false);
  }, [transactionId]);

  if (loading) return <PageLoader />;

  const isBuyer  = transaction?.buyer_id === user?.id;
  const isSeller = transaction?.seller_id === user?.id;

  const timelineSteps = [
    { key: 'pending_payment', label: 'Pago iniciado' },
    { key: 'escrow_held',     label: 'Dinero en escrow' },
    { key: 'code_validated',  label: 'Codigo validado' },
    { key: 'completed',       label: 'Transaccion completada' }
  ];

  const STATUS_ORDER = ['pending_payment', 'escrow_held', 'code_validated', 'completed'];
  const currentStep = STATUS_ORDER.indexOf(transaction?.status);

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-neutral-900">
            Transaccion #{transactionId?.slice(0, 8)}
          </h1>
          {transaction?.status && <TransactionStatusBadge status={transaction.status} />}
        </div>
      </div>

      <div className="space-y-4">
        {/* Linea de tiempo del estado */}
        <div className="card p-6">
          <h2 className="font-semibold text-neutral-800 mb-5">Estado de la transaccion</h2>
          <div className="relative">
            {timelineSteps.map((step, idx) => {
              const isCompleted = idx <= currentStep;
              const isCurrent   = idx === currentStep;

              return (
                <div key={step.key} className="flex items-start gap-4 pb-5 last:pb-0">
                  <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5
                    ${isCompleted
                      ? 'bg-brand-600 border-brand-600 text-white'
                      : 'bg-white border-neutral-200 text-neutral-400'
                    }`}
                  >
                    {isCompleted ? <CheckCircle className="w-4 h-4" /> : <span className="text-xs">{idx + 1}</span>}
                  </div>
                  <div className="pt-1">
                    <p className={`text-sm font-medium ${isCompleted ? 'text-neutral-900' : 'text-neutral-400'}`}>
                      {step.label}
                    </p>
                    {isCurrent && <p className="text-xs text-brand-600 mt-0.5">Estado actual</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Estado del escrow - RF-06 */}
        {transaction?.status === 'escrow_held' && (
          <div className="card p-5 bg-brand-50 border-brand-100">
            <div className="flex items-center gap-3">
              <Shield className="w-6 h-6 text-brand-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-brand-800">Dinero en escrow</p>
                <p className="text-sm text-brand-600">
                  El pago sera liberado cuando el comprador entregue el codigo de liberacion al vendedor.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Acciones segun rol */}
        <div className="flex flex-wrap gap-3">
          {isSeller && transaction?.status === 'escrow_held' && (
            <Button
              variant="primary"
              onClick={() => navigate(`/transactions/${transactionId}/validate`)}
            >
              Ingresar codigo de liberacion
            </Button>
          )}

          {/* RF-08: acceso a reporte en max 2 clics desde la transaccion (checklist item 12) */}
          {isBuyer && ['escrow_held', 'completed'].includes(transaction?.status) && (
            <Button
              variant="danger"
              onClick={() => setShowDisputeModal(true)}
            >
              Reportar problema
            </Button>
          )}

          {(transaction?.status === 'completed') && (
            <Button
              variant="secondary"
              onClick={() => navigate(`/transactions/${transactionId}/rate`)}
            >
              Calificar
            </Button>
          )}
        </div>
      </div>

      {/* Modal de disputa - RF-08 */}
      {showDisputeModal && (
        <DisputeModal
          transactionId={transactionId}
          onClose={() => setShowDisputeModal(false)}
          onSuccess={() => { setShowDisputeModal(false); navigate('/my-purchases'); }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODAL DE DISPUTA - frm_reportar_problema
// RF-08, CP-009
// ---------------------------------------------------------------------------

function DisputeModal({ transactionId, onClose, onSuccess }) {
  const [problemType, setProblemType] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const PROBLEM_TYPES = [
    { value: 'not_received',    label: 'No recibi el producto' },
    { value: 'wrong_product',   label: 'Producto incorrecto' },
    { value: 'damaged_product', label: 'Producto danado' },
    { value: 'fraud',           label: 'Posible fraude' },
    { value: 'other',           label: 'Otro problema' }
  ];

  const handleSubmit = async () => {
    if (!problemType) { setError('Selecciona el tipo de problema.'); return; }
    if (description.trim().length < 20) {
      setError('La descripcion debe tener al menos 20 caracteres.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await transactionsAPI.openDispute(transactionId, { problem_type: problemType, description });
      onSuccess();
    } catch (err) {
      setError(err.message || 'Error al abrir la disputa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen title="Reportar un problema" onClose={onClose}>
      <div className="space-y-4">
        <Alert type="warning">
          Al reportar, el pago sera congelado hasta que el administrador resuelva la disputa.
        </Alert>

        {error && <Alert type="danger">{error}</Alert>}

        <div>
          <label className="form-label">Tipo de problema <span className="text-danger-500">*</span></label>
          <div className="space-y-2 mt-1">
            {PROBLEM_TYPES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-3 p-3 rounded-lg border border-neutral-200 hover:bg-neutral-50 cursor-pointer">
                <input
                  type="radio"
                  name="problemType"
                  value={value}
                  className="w-4 h-4"
                  checked={problemType === value}
                  onChange={() => setProblemType(value)}
                />
                <span className="text-sm text-neutral-700">{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="form-label">
            Descripcion detallada <span className="text-danger-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe detalladamente el problema (minimo 20 caracteres)..."
            rows={4}
            className="form-input resize-none"
          />
          <p className="form-hint">{description.length}/2000 caracteres</p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            loading={loading}
            onClick={handleSubmit}
          >
            Reportar problema
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// ENCUENTRO FISICO - frm_pactar_encuentro
// RF-04, CP-006
// ---------------------------------------------------------------------------

export function MeetingPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fecha minima: manana (no puede ser en el pasado - CP-006)
  const minDate = new Date();
  minDate.setDate(minDate.getDate() + 1);
  const minDateStr = minDate.toISOString().slice(0, 16);

  const handlePropose = async () => {
    if (!location.trim()) { setError('El lugar del encuentro es obligatorio.'); return; }
    if (!meetingDate) { setError('La fecha del encuentro es obligatoria.'); return; }

    // CP-006: validacion de fecha en el pasado (doble validacion frontend + backend)
    if (new Date(meetingDate) <= new Date()) {
      setError('La fecha del encuentro no puede ser en el pasado.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      await transactionsAPI.proposeMeeting(transactionId, {
        meetingDate,
        locationDescription: location,
        notes
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message || 'Error al proponer el encuentro.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="page-container max-w-lg">
        <div className="card p-8 text-center space-y-5">
          <CheckCircle className="w-16 h-16 text-success-500 mx-auto" />
          <h2 className="text-xl font-bold">Encuentro propuesto</h2>
          <p className="text-neutral-500">El vendedor recibira una notificacion con tu propuesta.</p>
          <Button variant="primary" className="w-full" onClick={() => navigate('/my-purchases')}>
            Ver mis compras
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container max-w-lg">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900">Pactar encuentro</h1>
        <p className="text-neutral-500 mt-1">Propone un lugar y hora para el encuentro fisico</p>
      </div>

      <div className="card p-6 space-y-5">
        {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

        <div>
          <label className="form-label">
            <MapPin className="inline w-4 h-4 mr-1" />
            Lugar del encuentro <span className="text-danger-500">*</span>
          </label>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ej: Centro Comercial El Tesoro, entrada principal"
            className="form-input"
          />
        </div>

        <div>
          <label className="form-label">
            <Calendar className="inline w-4 h-4 mr-1" />
            Fecha y hora <span className="text-danger-500">*</span>
          </label>
          <input
            type="datetime-local"
            value={meetingDate}
            onChange={(e) => setMeetingDate(e.target.value)}
            min={minDateStr}
            className="form-input"
          />
          <p className="form-hint">CP-006: La fecha no puede ser en el pasado.</p>
        </div>

        <div>
          <label className="form-label">Notas adicionales</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Descripcion adicional, referencias del lugar, etc."
            rows={3}
            className="form-input resize-none"
          />
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          loading={loading}
          onClick={handlePropose}
        >
          Proponer encuentro
        </Button>
      </div>
    </div>
  );
}
