/**
 * DirectMarket - Paginas de Autenticacion
 *
 * frm_registro / frm_login
 *
 * Trazabilidad:
 *   RF-01 : registro e inicio de sesion
 *   CP-001: datos validos -> cuenta creada + email de verificacion
 *   CP-002: credenciales incorrectas -> mensaje; 5 intentos -> bloqueo 15 min
 *   Gherkin RF-01: "Registro exitoso", "Registro con correo ya existente"
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ShoppingBag, Eye, EyeOff } from 'lucide-react';
import { authAPI } from '../../services/api';
import useAuthStore from '../../store/authStore';
import { Button, Input, Alert, SecureBadge } from '../../components/common';

// ---------------------------------------------------------------------------
// Esquemas de validacion Zod (CP-001: contrasena min 8 chars, email valido)
// ---------------------------------------------------------------------------

const registerSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres.').max(100),
  email: z.string().email('Formato de correo invalido.'),
  password: z
    .string()
    .min(8, 'La contrasena debe tener minimo 8 caracteres.')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayuscula.')
    .regex(/[0-9]/, 'Debe contener al menos un numero.'),
  confirmPassword: z.string(),
  role: z.enum(['buyer', 'seller'])
}).refine((d) => d.password === d.confirmPassword, {
  message: 'Las contrasenas no coinciden.',
  path: ['confirmPassword']
});

const loginSchema = z.object({
  email: z.string().email('Formato de correo invalido.'),
  password: z.string().min(1, 'La contrasena es obligatoria.')
});

// ---------------------------------------------------------------------------
// PAGINA DE REGISTRO
// ---------------------------------------------------------------------------

export function RegisterPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'buyer' }
  });

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');
    try {
      await authAPI.register({
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role
      });
      // CP-001: resultado esperado -> mensaje de exito y redireccion
      setSuccess('Cuenta creada exitosamente. Revisa tu correo para verificarla.');
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.message || 'Error al crear la cuenta.');
    }
  };

  return (
    <AuthLayout
      title="Crea tu cuenta"
      subtitle="Empieza a comprar y vender sin intermediarios"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error  && <Alert type="danger"  onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert type="success">{success}</Alert>}

        <Input
          label="Nombre completo"
          type="text"
          placeholder="Maria Garcia"
          required
          error={errors.name?.message}
          {...register('name')}
        />

        <Input
          label="Correo electronico"
          type="email"
          placeholder="tu@correo.com"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="relative">
          <Input
            label="Contrasena"
            type={showPassword ? 'text' : 'password'}
            placeholder="Minimo 8 caracteres"
            required
            autoComplete="new-password"
            error={errors.password?.message}
            hint="Debe incluir mayusculas y numeros."
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-9 text-neutral-400 hover:text-neutral-600"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Input
          label="Confirmar contrasena"
          type="password"
          placeholder="Repite tu contrasena"
          required
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        {/* Tipo de cuenta */}
        <fieldset>
          <legend className="form-label">Tipo de cuenta <span className="text-danger-500">*</span></legend>
          <div className="grid grid-cols-2 gap-3 mt-1">
            {[
              { value: 'buyer', label: 'Comprador', desc: 'Quiero comprar productos' },
              { value: 'seller', label: 'Vendedor', desc: 'Quiero vender productos' }
            ].map(({ value, label, desc }) => (
              <label key={value} className="relative cursor-pointer">
                <input type="radio" value={value} className="peer sr-only" {...register('role')} />
                <div className="p-3 border-2 border-neutral-200 rounded-xl text-center
                                peer-checked:border-brand-500 peer-checked:bg-brand-50
                                hover:border-neutral-300 transition-colors">
                  <p className="text-sm font-semibold text-neutral-800">{label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          className="w-full mt-2"
        >
          Crear cuenta
        </Button>

        <p className="text-center text-sm text-neutral-500">
          Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium">Ingresar</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// PAGINA DE LOGIN
// ---------------------------------------------------------------------------

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data) => {
    setError('');
    try {
      const res = await authAPI.login(data);
      setAuth(res.data.user, res.data.token);
      navigate('/products');
    } catch (err) {
      // CP-002: mensaje de error por credenciales incorrectas o cuenta bloqueada
      setError(err.message || 'Error al iniciar sesion.');
    }
  };

  return (
    <AuthLayout
      title="Bienvenido de vuelta"
      subtitle="Ingresa a tu cuenta de DirectMarket"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
        {error && <Alert type="danger" onClose={() => setError('')}>{error}</Alert>}

        <Input
          label="Correo electronico"
          type="email"
          placeholder="tu@correo.com"
          required
          autoComplete="email"
          error={errors.email?.message}
          {...register('email')}
        />

        <div className="relative">
          <Input
            label="Contrasena"
            type={showPassword ? 'text' : 'password'}
            placeholder="Tu contrasena"
            required
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <button
            type="button"
            className="absolute right-3 top-9 text-neutral-400 hover:text-neutral-600"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? 'Ocultar contrasena' : 'Mostrar contrasena'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          loading={isSubmitting}
          className="w-full"
        >
          Ingresar
        </Button>

        <p className="text-center text-sm text-neutral-500">
          No tienes cuenta?{' '}
          <Link to="/register" className="font-medium">Crear cuenta gratis</Link>
        </p>
      </form>
    </AuthLayout>
  );
}

// ---------------------------------------------------------------------------
// LAYOUT COMPARTIDO DE AUTENTICACION
// ---------------------------------------------------------------------------

function AuthLayout({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-neutral-50
                    flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingBag className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-neutral-900">{title}</h1>
          <p className="text-neutral-500 mt-1.5">{subtitle}</p>
        </div>

        {/* Tarjeta del formulario */}
        <div className="card p-6 sm:p-8">
          {children}
        </div>

        {/* Indicador de seguridad - checklist item 11 */}
        <div className="flex justify-center mt-4">
          <SecureBadge />
        </div>
      </div>
    </div>
  );
}
