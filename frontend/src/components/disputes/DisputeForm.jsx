/**
 * DirectMarket - Componente DisputeForm
 *
 * Formulario para reportar un problema en una transaccion.
 * Accesible en maximo 2 clics desde la vista de la transaccion
 * (checklist de mockups, item 12).
 *
 * Trazabilidad:
 *   RF-08  : reportar inconvenientes en la entrega
 *   CP-009 : congela el pago y notifica al administrador
 *   Gherkin RF-08: "el sistema congela la liberacion del pago,
 *                   abre ticket de disputa y notifica al administrador"
 */

import { useState } from 'react';
import { AlertTriangle, Upload, X } from 'lucide-react';
import { transactionsAPI } from '../../services/api';
import { Button, Alert } from '../common';
import { PROBLEM_TYPE_LABELS } from '../../utils';

const MIN_DESCRIPTION_LENGTH = 20;
const MAX_DESCRIPTION_LENGTH = 2000;

/**
 * @param {Object}   props
 * @param {string}   props.transactionId  - UUID de la transaccion
 * @param {Function} props.onSuccess      - Callback tras abrir la disputa
 * @param {Function} props.onCancel       - Callback para cancelar
 */
export default function DisputeForm({ transactionId, onSuccess, onCancel }) {
  const [problemType, setProblemType]   = useState('');
  const [description, setDescription]   = useState('');
  const [evidenceUrls, setEvidenceUrls] = useState([]);
  const [urlInput, setUrlInput]         = useState('');
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');

  const problemTypes = Object.entries(PROBLEM_TYPE_LABELS).map(([value, label]) => ({
    value,
    label
  }));

  const addEvidenceUrl = () => {
    const trimmed = urlInput.trim();
    if (!trimmed) return;
    if (!trimmed.startsWith('http')) {
      setError('La URL de evidencia debe comenzar con http o https.');
      return;
    }
    if (evidenceUrls.length >= 5) {
      setError('Puedes adjuntar un maximo de 5 URLs de evidencia.');
      return;
    }
    setEvidenceUrls([...evidenceUrls, trimmed]);
    setUrlInput('');
    setError('');
  };

  const removeEvidenceUrl = (index) => {
    setEvidenceUrls(evidenceUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    // Validaciones de negocio
    if (!problemType) {
      setError('Debes seleccionar el tipo de problema.');
      return;
    }

    if (description.trim().length < MIN_DESCRIPTION_LENGTH) {
      setError(`La descripcion debe tener al menos ${MIN_DESCRIPTION_LENGTH} caracteres.`);
      return;
    }

    setError('');
    setLoading(true);

    try {
      await transactionsAPI.openDispute(transactionId, {
        problem_type:  problemType,
        description:   description.trim(),
        evidence_urls: evidenceUrls
      });
      onSuccess?.();
    } catch (err) {
      setError(err.message || 'Error al abrir la disputa. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const descriptionLength = description.trim().length;
  const descriptionOk     = descriptionLength >= MIN_DESCRIPTION_LENGTH;

  return (
    <div className="space-y-5">
      {/* Advertencia de congelamiento - CP-009 */}
      <Alert type="warning">
        <strong>Atencion:</strong> Al reportar este problema, el pago sera congelado
        automaticamente hasta que el administrador resuelva la disputa. Esta accion
        no puede deshacerse.
      </Alert>

      {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

      {/* Tipo de problema - al menos uno requerido */}
      <fieldset>
        <legend className="form-label">
          Tipo de problema
          <span className="text-danger-500 ml-0.5">*</span>
        </legend>
        <div className="mt-1 space-y-2">
          {problemTypes.map(({ value, label }) => (
            <label
              key={value}
              className="flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer
                         transition-colors hover:bg-neutral-50"
              style={{
                borderColor: problemType === value ? 'rgb(79 70 229)' : 'rgb(229 231 235)',
                backgroundColor: problemType === value ? 'rgb(238 242 255)' : undefined
              }}
            >
              <input
                type="radio"
                name="problemType"
                value={value}
                checked={problemType === value}
                onChange={() => setProblemType(value)}
                className="w-4 h-4 text-brand-600"
              />
              <span className="text-sm text-neutral-700 font-medium">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Descripcion detallada */}
      <div>
        <label className="form-label">
          Descripcion detallada
          <span className="text-danger-500 ml-0.5">*</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, MAX_DESCRIPTION_LENGTH))}
          placeholder={`Describe el problema con detalle (minimo ${MIN_DESCRIPTION_LENGTH} caracteres)...
Ejemplo: "Recibi el producto equivocado. Pedi una camisa talla M azul y me enviaron una talla L roja."`}
          rows={5}
          className="form-input resize-none"
          aria-describedby="desc-counter desc-hint"
        />
        <div className="flex justify-between mt-1">
          <p
            id="desc-hint"
            className="form-hint"
            style={{ color: !descriptionOk && descriptionLength > 0 ? 'rgb(220 38 38)' : undefined }}
          >
            {!descriptionOk && descriptionLength > 0
              ? `Faltan ${MIN_DESCRIPTION_LENGTH - descriptionLength} caracteres mas.`
              : 'Sé especifico para acelerar la resolucion.'}
          </p>
          <span id="desc-counter" className="text-xs text-neutral-400">
            {descriptionLength}/{MAX_DESCRIPTION_LENGTH}
          </span>
        </div>
      </div>

      {/* URLs de evidencia (opcional) */}
      <div>
        <label className="form-label">
          Evidencias (opcional)
          <span className="text-neutral-400 ml-1 font-normal">- URLs de fotos o capturas</span>
        </label>

        <div className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://ejemplo.com/captura.jpg"
            className="form-input flex-1"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEvidenceUrl())}
          />
          <Button
            type="button"
            variant="secondary"
            onClick={addEvidenceUrl}
            disabled={!urlInput.trim()}
          >
            <Upload className="w-4 h-4" />
            Agregar
          </Button>
        </div>

        {evidenceUrls.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {evidenceUrls.map((url, index) => (
              <li
                key={index}
                className="flex items-center gap-2 text-xs text-neutral-600 bg-neutral-50 rounded-lg px-3 py-2"
              >
                <span className="flex-1 truncate">{url}</span>
                <button
                  type="button"
                  onClick={() => removeEvidenceUrl(index)}
                  className="text-neutral-400 hover:text-danger-500 transition-colors flex-shrink-0"
                  aria-label="Eliminar evidencia"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="form-hint mt-1">
          Maximo 5 URLs. Pueden ser capturas de pantalla, fotos del producto, etc.
        </p>
      </div>

      {/* Botones de accion */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="secondary"
          className="flex-1"
          onClick={onCancel}
          disabled={loading}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          variant="danger"
          className="flex-1"
          loading={loading}
          onClick={handleSubmit}
          disabled={!problemType || !descriptionOk}
        >
          <AlertTriangle className="w-4 h-4" />
          Reportar y congelar pago
        </Button>
      </div>
    </div>
  );
}
