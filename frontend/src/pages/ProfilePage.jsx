import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, Package, ShoppingBag, Calendar } from 'lucide-react';
import { usersAPI } from '../services/api';
import useAuthStore from '../store/authStore';

function formatDate(d) { return d ? new Date(d).toLocaleDateString('es-CO',{year:'numeric',month:'long',day:'numeric'}) : '-'; }
function formatPrice(n) { return '$'+parseFloat(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0}); }

export default function ProfilePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuthStore();
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    usersAPI.getProfile(id)
      .then(res => setData(res.data))
      .catch(e => setError(e.message || 'Error al cargar el perfil.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>;
  if (error)   return <div className="page-container text-center py-20 text-red-500">{error}</div>;
  if (!data)   return null;

  const { user, ratings, products } = data;
  const score = parseFloat(user.reputation_score || 0);
  const label = user.total_ratings === 0 ? 'Sin calificaciones' : score >= 4.5 ? 'Excelente' : score >= 3.5 ? 'Muy bueno' : score >= 2.5 ? 'Bueno' : 'Regular';

  return (
    <div className="page-container max-w-3xl">
      {/* Encabezado del perfil */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          <div className="w-20 h-20 bg-indigo-100 rounded-2xl flex items-center justify-center flex-shrink-0">
            <span className="text-indigo-700 text-3xl font-bold">{user.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{user.name}</h1>
              <span className={`badge ${user.role==='seller'?'badge-brand':'badge-neutral'}`}>
                {user.role==='seller'?'Vendedor':user.role==='admin'?'Admin':'Comprador'}
              </span>
              {currentUser?.id === id && <span className="badge badge-success">Tu perfil</span>}
            </div>

            <div className="flex items-center gap-2 mt-2">
              {[1,2,3,4,5].map(s=>(
                <Star key={s} className={`w-5 h-5 ${s<=Math.round(score)?'fill-yellow-400 text-yellow-400':'text-gray-200'}`}/>
              ))}
              <span className="text-sm text-gray-600 ml-1">
                {score.toFixed(1)} · {user.total_ratings} calificacion{user.total_ratings!==1?'es':''} · {label}
              </span>
            </div>

            <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
              <Calendar className="w-3.5 h-3.5"/>
              Miembro desde {formatDate(user.created_at)}
            </div>
          </div>
        </div>
      </div>

      {/* Productos publicados */}
      {products?.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            <Package className="inline w-5 h-5 mr-2 text-indigo-600"/>
            Productos publicados ({products.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map(p => (
              <div key={p.id} className="card-hover overflow-hidden" onClick={()=>navigate(`/products/${p.id}`)}>
                <div className="aspect-square bg-gray-100 overflow-hidden">
                  {p.images?.[0]?<img src={p.images[0]} alt={p.title} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><Package className="w-8 h-8 text-gray-300"/></div>}
                </div>
                <div className="p-3">
                  <p className="text-sm font-medium text-gray-800 line-clamp-1">{p.title}</p>
                  <p className="text-sm font-bold text-indigo-600 mt-1">{formatPrice(p.price)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Calificaciones recibidas */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          <Star className="inline w-5 h-5 mr-2 text-yellow-400"/>
          Calificaciones recibidas
        </h2>
        {ratings?.length === 0 ? (
          <div className="card p-8 text-center text-gray-500">
            <Star className="w-12 h-12 text-gray-200 mx-auto mb-2"/>
            <p>Este usuario aun no tiene calificaciones.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map(r => (
              <div key={r.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-gray-600 text-sm font-medium">{r.rater?.name?.charAt(0)?.toUpperCase()||'U'}</span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">{r.rater?.name || 'Usuario'}</p>
                      <div className="flex items-center gap-0.5 mt-0.5">
                        {[1,2,3,4,5].map(s=><Star key={s} className={`w-3.5 h-3.5 ${s<=r.score?'fill-yellow-400 text-yellow-400':'text-gray-200'}`}/>)}
                        <span className="text-xs text-gray-500 ml-1">{r.score}/5</span>
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(r.created_at)}</span>
                </div>
                {r.comment && <p className="text-sm text-gray-600 mt-3 pl-12">{r.comment}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
