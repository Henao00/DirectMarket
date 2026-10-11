/**
 * DirectMarket - Custom Hooks
 *
 * Centralizan la logica de fetching y estado local para cada entidad.
 * Siguen el patron fetch-on-mount con loading/error/data.
 *
 * Trazabilidad:
 *   useProducts     : RF-02
 *   useTransaction  : RF-03, RF-06, RF-07
 *   useReleaseCode  : RF-05, CP-007
 *   useAdminStats   : RF-10
 */

import { useState, useEffect, useCallback } from 'react';
import { productsAPI, transactionsAPI, adminAPI } from '../services/api';

// ---------------------------------------------------------------------------
// useProducts
// Busqueda y listado de productos con filtros y paginacion (RF-02)
// ---------------------------------------------------------------------------

export function useProducts(initialFilters = {}) {
  const [products, setProducts]       = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);
  const [filters, setFilters]         = useState(initialFilters);
  const [pagination, setPagination]   = useState({ page: 1, totalPages: 1, total: 0 });

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, limit: 20, ...filters };
      Object.keys(params).forEach((k) => !params[k] && delete params[k]);
      const res = await productsAPI.list(params);
      setProducts(res.data.products);
      setPagination({ page, totalPages: res.data.totalPages, total: res.data.total });
    } catch (err) {
      setError(err.message || 'Error al cargar los productos.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetch(1); }, [fetch]);

  return { products, loading, error, pagination, setFilters, refetch: fetch };
}

// ---------------------------------------------------------------------------
// useProduct
// Detalle de un producto por ID (RF-02)
// ---------------------------------------------------------------------------

export function useProduct(productId) {
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!productId) return;
    setLoading(true);
    setError(null);
    productsAPI.getById(productId)
      .then((res) => setProduct(res.data))
      .catch((err) => setError(err.message || 'Producto no encontrado.'))
      .finally(() => setLoading(false));
  }, [productId]);

  return { product, loading, error };
}

// ---------------------------------------------------------------------------
// useTransactions
// Historial de compras o ventas del usuario autenticado (RF-03)
// ---------------------------------------------------------------------------

export function useTransactions(role = 'buyer') {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [pagination, setPagination]     = useState({ page: 1, totalPages: 1, total: 0 });

  const fetch = useCallback(async (page = 1) => {
    setLoading(true);
    setError(null);
    try {
      const apiFn = role === 'buyer'
        ? transactionsAPI.getPurchases
        : transactionsAPI.getSales;
      const res = await apiFn({ page, limit: 20 });
      setTransactions(res.data.transactions || []);
      setPagination({
        page,
        totalPages: res.data.totalPages || 1,
        total: res.data.total || 0
      });
    } catch (err) {
      setError(err.message || 'Error al cargar el historial.');
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { fetch(1); }, [fetch]);

  return { transactions, loading, error, pagination, refetch: fetch };
}

// ---------------------------------------------------------------------------
// useReleaseCodeStatus
// Estado del codigo de liberacion - solo para el comprador (RF-05, CP-007)
// ---------------------------------------------------------------------------

export function useReleaseCodeStatus(transactionId) {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!transactionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await transactionsAPI.getReleaseCodeStatus(transactionId);
      setStatus(res.data);
    } catch (err) {
      setError(err.message || 'No se pudo obtener el estado del codigo.');
    } finally {
      setLoading(false);
    }
  }, [transactionId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { status, loading, error, refetch: fetch };
}

// ---------------------------------------------------------------------------
// useAdminStats
// Estadisticas del panel de administracion (RF-10)
// ---------------------------------------------------------------------------

export function useAdminStats() {
  const [stats, setStats]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    adminAPI.getStats()
      .then((res) => setStats(res.data))
      .catch((err) => setError(err.message || 'Error al cargar estadisticas.'))
      .finally(() => setLoading(false));
  }, []);

  return { stats, loading, error };
}

// ---------------------------------------------------------------------------
// useLocalStorage
// Persistencia de estado en localStorage con manejo de errores
// ---------------------------------------------------------------------------

export function useLocalStorage(key, initialValue) {
  const [storedValue, setStoredValue] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error('Error al guardar en localStorage:', error);
    }
  };

  return [storedValue, setValue];
}

// ---------------------------------------------------------------------------
// useDebounce
// Evita llamadas excesivas al backend durante la busqueda (RF-02)
// ---------------------------------------------------------------------------

export function useDebounce(value, delay = 400) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
