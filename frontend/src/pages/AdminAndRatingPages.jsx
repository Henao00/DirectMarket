import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminAPI, ratingsAPI } from '../services/api';
import { CheckCircle, XCircle, Star, AlertTriangle, Shield, Trash2, Search, Eye } from 'lucide-react';

function Alert({ type='info', children, onClose }) {
  const c={info:'bg-blue-50 border-blue-200 text-blue-700',danger:'bg-red-50 border-red-200 text-red-700',success:'bg-green-50 border-green-200 text-green-700',warning:'bg-yellow-50 border-yellow-200 text-yellow-700'};
  return <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${c[type]}`} role="alert"><span className="flex-1">{children}</span>{onClose&&<button onClick={onClose}>✕</button>}</div>;
}
function formatDate(d) { return d?new Date(d).toLocaleDateString('es-CO'):'-'; }
function Modal({ isOpen, onClose, title, children }) {
  if(!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ── PANEL ADMIN ───────────────────────────────────────────────────────────────
export function AdminDisputesPage() {
  const navigate = useNavigate();
  const [tab, setTab]               = useState('disputes');
  const [disputes, setDisputes]     = useState([]);
  const [users, setUsers]           = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const [searchUser, setSearchUser] = useState('');
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [selectedUser, setSelectedUser]       = useState(null);
  const [userDetail, setUserDetail]           = useState(null);
  const [msg, setMsg]               = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [d, s] = await Promise.all([adminAPI.getDisputes({ status: 'active' }), adminAPI.getStats()]);
      setDisputes(d.data);
      setStats(s.data);
    } catch(e) { setMsg(e.message); }
    setLoading(false);
  };

  const loadUsers = async (search='') => {
    try {
      const res = await adminAPI.getUsers({ search, limit: 50 });
      setUsers(res.data.users);
    } catch(e) { setMsg(e.message); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if(tab==='users') loadUsers(searchUser); }, [tab]);

  const openUserDetail = async (userId) => {
    try {
      const res = await adminAPI.getUserDetail(userId);
      setUserDetail(res.data);
    } catch(e) { setMsg(e.message); }
  };

  const handleBan = async (userId, action) => {
    try {
      await adminAPI.banUser(userId, action);
      setMsg(action==='ban'?'Usuario baneado.':'Usuario desbaneado.');
      loadUsers(searchUser);
      setUserDetail(null);
    } catch(e) { setMsg(e.message); }
  };

  const handleVerifyEmail = async (userId) => {
    try {
      await adminAPI.verifyUserEmail(userId);
      setMsg('Email verificado.');
      openUserDetail(userId);
    } catch(e) { setMsg(e.message); }
  };

  const handleRemoveProduct = async (productId) => {
    if(!confirm('Eliminar esta publicacion?')) return;
    try {
      await adminAPI.removeProduct(productId);
      setMsg('Publicacion eliminada.');
      if(userDetail) openUserDetail(userDetail.user.id);
    } catch(e) { setMsg(e.message); }
  };

  return (
    <div className="page-container">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Panel de Administrador</h1></div>

      {msg && <Alert type="success" onClose={()=>setMsg('')} className="mb-4">{msg}</Alert>}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            {label:'Usuarios',    value:stats.totalUsers,             color:'text-indigo-600'},
            {label:'Productos',   value:stats.totalProducts,          color:'text-gray-900'},
            {label:'En escrow',   value:stats.activeTransactions,     color:'text-yellow-600'},
            {label:'Disputas',    value:stats.disputedTransactions,   color:'text-red-600'},
            {label:'Completadas', value:stats.completedTransactions,  color:'text-green-600'}
          ].map(({label,value,color})=>(
            <div key={label} className="card p-4"><p className="text-xs text-gray-500 mb-1">{label}</p><p className={`text-2xl font-bold ${color}`}>{value}</p></div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-5 border-b border-gray-200">
        {[{key:'disputes',label:'Disputas activas'},{key:'users',label:'Usuarios'}].map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab===t.key?'border-indigo-600 text-indigo-600':'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DISPUTAS */}
      {tab==='disputes' && (
        loading ? <div className="text-center py-10 text-gray-500">Cargando...</div>
        : disputes.length===0 ? <div className="card p-10 text-center text-gray-500"><CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-2"/>No hay disputas activas</div>
        : (
          <div className="space-y-3">
            {disputes.map(d=>(
              <div key={d.id} className="card p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex gap-2 mb-1">
                      <span className="badge badge-danger">Activa</span>
                      <span className="badge badge-neutral">{d.problem_type?.replace('_',' ')}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-800">Transaccion: #{d.transaction_id?.slice(0,8)}</p>
                    <p className="text-sm text-gray-500">Reportado por: {d.reporter?.name} · {formatDate(d.created_at)}</p>
                    <p className="text-sm text-gray-600 mt-2 line-clamp-2">{d.description}</p>
                  </div>
                  <button onClick={()=>setSelectedDispute(d)} className="btn btn-primary btn-sm flex-shrink-0">Resolver</button>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* USUARIOS */}
      {tab==='users' && (
        <div>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/><input value={searchUser} onChange={e=>setSearchUser(e.target.value)} onKeyDown={e=>e.key==='Enter'&&loadUsers(searchUser)} placeholder="Buscar por nombre o email..." className="form-input pl-9"/></div>
            <button onClick={()=>loadUsers(searchUser)} className="btn btn-secondary">Buscar</button>
          </div>

          <div className="space-y-2">
            {users.map(u=>(
              <div key={u.id} className="card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900 text-sm">{u.name}</p>
                    <span className={`badge ${u.role==='seller'?'badge-brand':u.role==='admin'?'badge-warning':'badge-neutral'}`}>{u.role}</span>
                    {!u.email_verified&&<span className="badge badge-warning">Email no verificado</span>}
                    {u.locked_until&&new Date(u.locked_until)>new Date()&&<span className="badge badge-danger">Baneado</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">{u.email} · Desde {formatDate(u.created_at)}</p>
                  <p className="text-xs text-gray-400">Reputacion: {parseFloat(u.reputation_score||0).toFixed(1)} ({u.total_ratings} cal.)</p>
                </div>
                <button onClick={()=>openUserDetail(u.id)} className="btn btn-secondary btn-sm flex-shrink-0">
                  <Eye className="w-4 h-4"/>Ver
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal resolver disputa */}
      {selectedDispute && <ResolveDisputeModal dispute={selectedDispute} onClose={()=>setSelectedDispute(null)} onResolved={()=>{setSelectedDispute(null);loadData();setMsg('Disputa resuelta.');}} />}

      {/* Modal detalle usuario */}
      <Modal isOpen={!!userDetail} onClose={()=>setUserDetail(null)} title="Detalle del usuario">
        {userDetail && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="font-semibold text-gray-900">{userDetail.user.name}</p>
              <p className="text-sm text-gray-500">{userDetail.user.email}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                <span className={`badge ${userDetail.user.role==='seller'?'badge-brand':'badge-neutral'}`}>{userDetail.user.role}</span>
                {!userDetail.user.email_verified&&<span className="badge badge-warning">Email sin verificar</span>}
                {userDetail.user.locked_until&&new Date(userDetail.user.locked_until)>new Date()&&<span className="badge badge-danger">Baneado</span>}
              </div>
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <p>Compras: <strong>{userDetail.purchases}</strong> · Ventas: <strong>{userDetail.sales}</strong></p>
                <p>Reputacion: <strong>{parseFloat(userDetail.user.reputation_score||0).toFixed(1)}</strong> ({userDetail.user.total_ratings} calificaciones)</p>
                <p>Miembro desde: <strong>{formatDate(userDetail.user.created_at)}</strong></p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {!userDetail.user.email_verified&&(
                <button onClick={()=>handleVerifyEmail(userDetail.user.id)} className="btn btn-secondary btn-sm">
                  <CheckCircle className="w-4 h-4"/>Verificar email
                </button>
              )}
              {userDetail.user.locked_until&&new Date(userDetail.user.locked_until)>new Date()?(
                <button onClick={()=>handleBan(userDetail.user.id,'unban')} className="btn btn-secondary btn-sm">
                  <CheckCircle className="w-4 h-4"/>Desbanear
                </button>
              ):(
                <button onClick={()=>{if(confirm('Banear este usuario?'))handleBan(userDetail.user.id,'ban');}} className="btn btn-danger btn-sm">
                  <XCircle className="w-4 h-4"/>Banear usuario
                </button>
              )}
            </div>

            {userDetail.products?.length>0&&(
              <div>
                <h3 className="font-semibold text-gray-800 mb-2">Publicaciones ({userDetail.products.length})</h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {userDetail.products.map(p=>(
                    <div key={p.id} className="flex items-center justify-between gap-2 p-2 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{p.title}</p>
                        <p className="text-xs text-gray-500">{p.status} · ${parseFloat(p.price).toLocaleString('es-CO')}</p>
                      </div>
                      {p.status!=='removed'&&(
                        <button onClick={()=>handleRemoveProduct(p.id)} className="btn btn-danger btn-sm flex-shrink-0">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ResolveDisputeModal({ dispute, onClose, onResolved }) {
  const [resolution,setResolution]=useState('');
  const [notes,setNotes]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');

  const handleResolve=async()=>{
    if(!resolution){setError('Selecciona una resolucion.');return;}
    if(notes.trim().length<10){setError('Las notas deben tener al menos 10 caracteres.');return;}
    setError('');setLoading(true);
    try{await adminAPI.resolveDispute(dispute.id,{resolution,resolution_notes:notes});onResolved();}
    catch(e){setError(e.message||'Error al resolver.');}
    setLoading(false);
  };

  return (
    <Modal isOpen title="Resolver disputa" onClose={onClose}>
      <div className="space-y-4">
        <div className="bg-gray-50 rounded-xl p-4 text-sm">
          <p className="font-medium text-gray-800 mb-1">Descripcion:</p>
          <p className="text-gray-600">{dispute.description}</p>
        </div>
        {error&&<Alert type="danger">{error}</Alert>}
        <Alert type="warning">La resolucion es irreversible. Ambas partes seran notificadas.</Alert>
        <fieldset className="space-y-2">
          <legend className="form-label">Resolucion <span className="text-red-500">*</span></legend>
          {[{value:'resolved_buyer',label:'A favor del comprador',desc:'Se reembolsa al comprador'},{value:'resolved_seller',label:'A favor del vendedor',desc:'Se libera el pago al vendedor'}].map(({value,label,desc})=>(
            <label key={value} className={`flex items-start gap-3 p-4 border-2 rounded-xl cursor-pointer transition-colors ${resolution===value?'border-indigo-500 bg-indigo-50':'border-gray-200 hover:border-gray-300'}`}>
              <input type="radio" name="resolution" value={value} className="w-4 h-4 mt-0.5" onChange={()=>setResolution(value)}/>
              <div><p className="text-sm font-semibold text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
            </label>
          ))}
        </fieldset>
        <div>
          <label className="form-label">Notas de resolucion <span className="text-red-500">*</span></label>
          <textarea value={notes} onChange={e=>setNotes(e.target.value)} rows={4} className="form-input resize-none" placeholder="Describe el razonamiento de la decision..."/>
        </div>
        <div className="flex gap-3">
          <button className="btn btn-secondary flex-1" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary flex-1" disabled={loading} onClick={handleResolve}>{loading?'Guardando...':'Confirmar resolucion'}</button>
        </div>
      </div>
    </Modal>
  );
}

// ── CALIFICAR ─────────────────────────────────────────────────────────────────
export function RatingPage() {
  const { transactionId } = useParams();
  const navigate = useNavigate();
  const [score,setScore]=useState(0);
  const [comment,setComment]=useState('');
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [submitted,setSubmitted]=useState(false);
  const [tx,setTx]=useState(null);

  useEffect(()=>{
    // En produccion cargar detalles de la transaccion
    setTx({ seller_id: null, buyer_id: null });
  },[transactionId]);

  const handleSubmit=async()=>{
    if(score<1||score>5){setError('Selecciona una calificacion de 1 a 5 estrellas.');return;}
    setError('');setLoading(true);
    try{
      await ratingsAPI.create(transactionId,{score,comment,rated_user_id:'pending',rated_as:'seller'});
      setSubmitted(true);
    } catch(e){setError(e.message||'Error al enviar la calificacion.');}
    setLoading(false);
  };

  if(submitted) return (
    <div className="page-container max-w-md">
      <div className="card p-8 text-center space-y-4">
        <CheckCircle className="w-16 h-16 text-green-500 mx-auto"/>
        <h2 className="text-xl font-bold">Calificacion enviada</h2>
        <p className="text-gray-500">Tu calificacion fue registrada.</p>
        <button className="btn btn-primary w-full" onClick={()=>navigate('/my-purchases')}>Volver a mis compras</button>
      </div>
    </div>
  );

  return (
    <div className="page-container max-w-md">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Calificar vendedor</h1></div>
      <div className="card p-6 space-y-5">
        {error&&<Alert type="danger">{error}</Alert>}
        <div className="text-center">
          <p className="text-sm font-medium text-gray-600 mb-4">Que calificacion le das?</p>
          <div className="flex justify-center gap-2">
            {[1,2,3,4,5].map(s=>(
              <button key={s} type="button" onClick={()=>setScore(s)} className="transition-transform hover:scale-110">
                <Star className={`w-10 h-10 ${s<=score?'fill-yellow-400 text-yellow-400':'text-gray-200 hover:text-yellow-300'}`}/>
              </button>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            {score===0?'Selecciona':score===1?'Muy malo':score===2?'Malo':score===3?'Regular':score===4?'Bueno':'Excelente'}
          </p>
          <p className="text-xs text-gray-400">Rango valido: 1 a 5 estrellas</p>
        </div>
        <div>
          <label className="form-label">Comentario (opcional)</label>
          <textarea value={comment} onChange={e=>setComment(e.target.value)} rows={4} className="form-input resize-none" placeholder="Comparte tu experiencia..." maxLength={1000}/>
          <p className="form-hint">{comment.length}/1000</p>
        </div>
        <Alert type="info">La calificacion es publica e irreversible una vez enviada.</Alert>
        <button className="btn btn-primary btn-lg w-full" disabled={score===0||loading} onClick={handleSubmit}>
          {loading?'Enviando...':'Enviar calificacion'}
        </button>
      </div>
    </div>
  );
}
