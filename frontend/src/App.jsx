import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import useAuthStore from './store/authStore';
import { transactionsAPI } from './services/api';
import { Package } from 'lucide-react';

import { RegisterPage, LoginPage } from './pages/AuthPages';
import { ProductsPage, ProductDetailPage, PublishProductPage } from './pages/ProductPages';
import { CheckoutPage, ValidateCodePage, TransactionDetailPage, MeetingPage } from './pages/PaymentPages';
import { AdminDisputesPage, RatingPage } from './pages/AdminAndRatingPages';
import ProfilePage from './pages/ProfilePage';

function ProtectedRoute({ children, requiredRole }) {
  const { isAuthenticated, user } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;
  if (requiredRole && user?.role !== requiredRole) return <Navigate to="/products" replace />;
  return children;
}

function AppLayout({ children }) {
  return <div className="min-h-screen bg-gray-50"><Navbar /><main>{children}</main></div>;
}

function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  if (isAuthenticated) return <Navigate to="/products" replace />;
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-full px-4 py-2 text-sm text-indigo-700 font-medium mb-6">Plataforma con escrow seguro</div>
        <h1 className="text-5xl font-bold text-gray-900 leading-tight mb-6">Compra y vende sin<br/><span className="text-indigo-600">intermediarios</span></h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">Tu dinero queda retenido hasta que confirmes la recepcion del producto con un codigo secreto.</p>
        <div className="flex flex-wrap justify-center gap-4 mb-20">
          <button className="btn btn-primary btn-lg px-8" onClick={()=>navigate('/register')}>Comenzar gratis</button>
          <button className="btn btn-secondary btn-lg px-8" onClick={()=>navigate('/products')}>Explorar productos</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[{title:'Pago en escrow',desc:'Tu dinero se retiene hasta confirmar la entrega.'},{title:'Codigo de liberacion',desc:'Solo tu tienes el codigo que desbloquea el pago.'},{title:'Resolucion de disputas',desc:'El administrador media y resuelve los conflictos.'}].map(({title,desc})=>(
            <div key={title} className="card p-6 text-left"><h3 className="font-semibold text-gray-900 mb-2">{title}</h3><p className="text-sm text-gray-500">{desc}</p></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TransactionStatusBadge({ status }) {
  const m={pending_payment:{l:'Pago pendiente',c:'badge-warning'},escrow_held:{l:'En escrow',c:'badge-brand'},code_validated:{l:'Codigo validado',c:'badge-success'},completed:{l:'Completada',c:'badge-success'},disputed:{l:'En disputa',c:'badge-danger'},refunded:{l:'Reembolsada',c:'badge-neutral'},cancelled:{l:'Cancelada',c:'badge-neutral'}};
  const {l,c}=m[status]||{l:status,c:'badge-neutral'};
  return <span className={`badge ${c}`}>{l}</span>;
}

function TransactionList({ title, transactions, loading, role }) {
  const navigate = useNavigate();
  return (
    <div className="page-container">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{title}</h1>
      {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>
      : transactions.length===0 ? <div className="text-center py-20"><Package className="w-16 h-16 text-gray-300 mx-auto mb-2"/><p className="text-gray-500">No hay transacciones aun.</p></div>
      : <div className="space-y-3">{transactions.map(tx=>(
          <div key={tx.id} className="card p-4 hover:shadow-md cursor-pointer transition-shadow" onClick={()=>navigate(`/transactions/${tx.id}`)}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {tx.product?.images?.[0]?<img src={tx.product.images[0]} alt="" className="w-full h-full object-cover"/>:<Package className="w-6 h-6 text-gray-400"/>}
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-gray-900 text-sm truncate">{tx.product?.title||'Producto'}</p>
                  <p className="text-xs text-gray-500">{role==='buyer'?(tx.seller?.name||'Vendedor'):(tx.buyer?.name||'Comprador')} · {tx.created_at?new Date(tx.created_at).toLocaleDateString('es-CO'):'-'}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0 space-y-1">
                <p className="font-bold text-gray-900">${tx.amount?parseFloat(tx.amount).toLocaleString('es-CO'):'0'}</p>
                <TransactionStatusBadge status={tx.status}/>
              </div>
            </div>
            {role==='seller'&&tx.status==='escrow_held'&&(
              <div className="mt-3 pt-3 border-t border-gray-100">
                <button className="btn btn-primary btn-sm w-full" onClick={e=>{e.stopPropagation();navigate(`/transactions/${tx.id}/validate`);}}>Ingresar codigo de liberacion</button>
              </div>
            )}
          </div>
        ))}</div>}
    </div>
  );
}

function PurchasesPage() {
  const [transactions,setTransactions]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ transactionsAPI.getPurchases({page:1}).then(r=>setTransactions(r.data.transactions||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  return <TransactionList title="Mis compras" transactions={transactions} loading={loading} role="buyer"/>;
}
function SalesPage() {
  const [transactions,setTransactions]=useState([]); const [loading,setLoading]=useState(true);
  useEffect(()=>{ transactionsAPI.getSales({page:1}).then(r=>setTransactions(r.data.transactions||[])).catch(()=>{}).finally(()=>setLoading(false)); },[]);
  return <TransactionList title="Mis ventas" transactions={transactions} loading={loading} role="seller"/>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<HomePage/>}/>
          <Route path="/login" element={<LoginPage/>}/>
          <Route path="/register" element={<RegisterPage/>}/>
          <Route path="/products" element={<ProductsPage/>}/>
          <Route path="/products/:id" element={<ProductDetailPage/>}/>
          <Route path="/profile/:id" element={<ProfilePage/>}/>
          <Route path="/products/new" element={<ProtectedRoute><PublishProductPage/></ProtectedRoute>}/>
          <Route path="/checkout/:transactionId" element={<ProtectedRoute><CheckoutPage/></ProtectedRoute>}/>
          <Route path="/transactions/:transactionId" element={<ProtectedRoute><TransactionDetailPage/></ProtectedRoute>}/>
          <Route path="/transactions/:transactionId/validate" element={<ProtectedRoute><ValidateCodePage/></ProtectedRoute>}/>
          <Route path="/transactions/:transactionId/meeting" element={<ProtectedRoute><MeetingPage/></ProtectedRoute>}/>
          <Route path="/transactions/:transactionId/rate" element={<ProtectedRoute><RatingPage/></ProtectedRoute>}/>
          <Route path="/my-purchases" element={<ProtectedRoute><PurchasesPage/></ProtectedRoute>}/>
          <Route path="/my-sales" element={<ProtectedRoute><SalesPage/></ProtectedRoute>}/>
          <Route path="/admin/disputes" element={<ProtectedRoute requiredRole="admin"><AdminDisputesPage/></ProtectedRoute>}/>
          <Route path="*" element={<Navigate to="/" replace/>}/>
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
}
