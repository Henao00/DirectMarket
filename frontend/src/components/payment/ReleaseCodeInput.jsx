/**
 * DirectMarket - Componente ReleaseCodeInput
 *
 * Formulario para que el vendedor ingrese el codigo de liberacion.
 * Implementa el control de intentos y muestra el estado en tiempo real.
 *
 * Trazabilidad:
 *   RF-07  : liberar el pago al validar el codigo correcto
 *   CP-008 : maximo 3 intentos, bloqueo y notificacion al admin
 *   RNF-02 : rechazo si el codigo expiro
 *   Gherkin RF-07: "codigo correcto libera pago" y "bloqueo por intentos fallidos"
 */

import { useState } from 'react';
import { CheckCircle, AlertCircle, Lock, ShieldOff } from 'lucide-react';
import { transactionsAPI } from '../../services/api';
import { Button, Alert } from '../common';
import { isValidReleaseCode, ESCROW_RULES } from '../../utils';
import clsx from 'clsx';

/**
 * @param {Object}   props
 * @param {string}   props.transactionId  - UUID de la transaccion
 * @param {Function} props.onSuccess      - Callback cuando el pago es liberado
 */
export default function ReleaseCodeInput({ transactionId, onSuccess }) {
  const [code, setCode]         = useState('');
  const [loading, setLoading]   = useState(false);
  const [result, setResult]     = useState(null); // respuesta del ultimo intento
  const [error, setError]       = useState('');

  /**
   * Maneja el cambio del input: solo permite los caracteres del charset
   * del codigo (A-Z excluyendo O/I, 2-9 excluyendo 0/1).
   */
  const handleCodeChange = (e) => {
    const value = e.target.value
      .toUpperCase()
      .replace(/[^A-HJ-NP-Z2-9]/g, '')   // charset del generador
      .slice(0, ESCROW_RULES.CODE_LENGTH);
    setCode(value);
    setError('');
  };

  const handleSubmit = async () => {
    if (!isValidReleaseCode(code)) {
      setError(`El codigo debe tener exactamente ${ESCROW_RULES.CODE_LENGTH} caracteres alfanumericos.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await transactionsAPI.validateCode(transactionId, code);
      setResult(res.data);

      if (res.data.success) {
        onSuccess?.();
      }
    } catch (err) {
      // El backend retorna el resultado del intento en el cuerpo del error
      if (err.data) {
        setResult(err.data);
      } else {
        setError(err.message || 'Error al validar el codigo.');
      }
    } finally {
      setLoading(false);
      if (!result?.success) {
        // Limpiar el campo para el siguiente intento
        setCode('');
      }
    }
  };

  // Estado: codigo ya utilizado con exito
  if (result?.success) {
    return (
      <div className="card p-6 text-center space-y-4">
        <div className="w-16 h-16 bg-success-50 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-8 h-8 text-success-600" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900">Pago liberado</h3>
          <p className="text-sm text-neutral-500 mt-1">
            El codigo fue validado correctamente. El dinero ha sido transferido a tu cuenta.
          </p>
        </div>
      </div>
    );
  }

  // Estado: codigo bloqueado por demasiados intentos (CP-008)
  if (result?.blocked) {
    return (
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-danger-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldOff className="w-6 h-6 text-danger-600" />
          </div>
          <div>
            <h3 className="font-semibold text-danger-700">Proceso bloqueado</h3>
            <p className="text-sm text-neutral-500">Se agotaron los intentos permitidos.</p>
          </div>
        </div>
        <Alert type="danger">
          Se han realizado {ESCROW_RULES.MAX_ATTEMPTS} intentos incorrectos consecutivos.
          El proceso ha sido bloqueado y el comprador y el administrador han sido notificados
          automaticamente.
        </Alert>
        <p className="text-sm text-neutral-600">
          Para continuar, contacta al administrador o pide al comprador que abra una disputa
          para resolver la situacion.
        </p>
      </div>
    );
  }

  const attemptsUsed      = ESCROW_RULES.MAX_ATTEMPTS - (result?.attemptsRemaining ?? ESCROW_RULES.MAX_ATTEMPTS);
  const attemptsRemaining = result?.attemptsRemaining ?? ESCROW_RULES.MAX_ATTEMPTS;
  const isLastAttempt     = attemptsRemaining === 1;

  return (
    <div className="card p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-50 rounded-xl flex items-center justify-center flex-shrink-0">
          <Lock className="w-5 h-5 text-brand-600" />
        </div>
        <div>
          <h3 className="font-semibold text-neutral-900">Ingresar codigo de liberacion</h3>
          <p className="text-sm text-neutral-500">
            Solicita el codigo al comprador para recibir el pago.
          </p>
        </div>
      </div>

      {/* Alerta de intento fallido previo */}
      {result && !result.success && !result.blocked && (
        <Alert type="warning">
          Codigo incorrecto. Intentos restantes:{' '}
          <strong>{attemptsRemaining}</strong> de {ESCROW_RULES.MAX_ATTEMPTS}.
          {isLastAttempt && (
            <span className="block mt-1 font-medium text-warning-700">
              Atencion: este es tu ultimo intento. Un error mas bloqueara el proceso.
            </span>
          )}
        </Alert>
      )}

      {/* Alerta de codigo expirado */}
      {result?.message?.includes('expirado') && (
        <Alert type="danger">
          El codigo de liberacion ha expirado. Pide al comprador que solicite uno nuevo
          desde "Mis compras".
        </Alert>
      )}

      {error && <Alert type="danger">{error}</Alert>}

      {/* Input del codigo */}
      <div>
        <label className="form-label">
          Codigo de liberacion
          <span className="text-danger-500 ml-0.5">*</span>
        </label>
        <input
          type="text"
          value={code}
          onChange={handleCodeChange}
          placeholder={'X'.repeat(ESCROW_RULES.CODE_LENGTH)}
          className={clsx(
            'form-input text-center font-mono text-2xl tracking-[0.5em] uppercase',
            isLastAttempt && 'border-warning-400 focus:ring-warning-400'
          )}
          maxLength={ESCROW_RULES.CODE_LENGTH}
          disabled={loading}
          aria-label="Codigo de liberacion de 8 caracteres"
          aria-describedby="code-help attempts-info"
          autoComplete="off"
          spellCheck={false}
        />
        <p id="code-help" className="form-hint">
          {ESCROW_RULES.CODE_LENGTH} caracteres alfanumericos en mayusculas.
        </p>

        {/* Indicador visual de intentos (CP-008) */}
        {attemptsUsed > 0 && (
          <div id="attempts-info" className="flex items-center gap-1.5 mt-2">
            {Array.from({ length: ESCROW_RULES.MAX_ATTEMPTS }).map((_, i) => (
              <div
                key={i}
                className={clsx(
                  'h-1.5 flex-1 rounded-full',
                  i < attemptsUsed ? 'bg-danger-400' : 'bg-neutral-200'
                )}
                aria-hidden="true"
              />
            ))}
            <span className="text-xs text-neutral-500 ml-1 whitespace-nowrap">
              {attemptsRemaining} restante{attemptsRemaining !== 1 ? 's' : ''}
            </span>
          </div>
        )}
      </div>

      <Button
        variant={isLastAttempt ? 'danger' : 'primary'}
        size="lg"
        className="w-full"
        loading={loading}
        onClick={handleSubmit}
        disabled={code.length !== ESCROW_RULES.CODE_LENGTH}
      >
        {isLastAttempt ? 'Validar (ultimo intento)' : 'Validar codigo y liberar pago'}
      </Button>
    </div>
  );
}
