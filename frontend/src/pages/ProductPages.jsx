import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Search, Filter, Star, ShoppingCart, Package, X, Plus } from 'lucide-react';
import { productsAPI, transactionsAPI, usersAPI } from '../services/api';
import useAuthStore from '../store/authStore';

function formatPrice(n) {
  return '$' + parseFloat(n||0).toLocaleString('es-CO',{minimumFractionDigits:0,maximumFractionDigits:0});
}
function Alert({ type='info', children, onClose }) {
  const c={info:'bg-blue-50 border-blue-200 text-blue-700',danger:'bg-red-50 border-red-200 text-red-700',success:'bg-green-50 border-green-200 text-green-700',warning:'bg-yellow-50 border-yellow-200 text-yellow-700'};
  return <div className={`flex items-start gap-2 px-4 py-3 rounded-lg border text-sm ${c[type]}`} role="alert"><span className="flex-1">{children}</span>{onClose&&<button onClick={onClose}>✕</button>}</div>;
}

export function ProductsPage() {
  const navigate = useNavigate();
  const [products,setProducts]=useState([]);
  const [loading,setLoading]=useState(true);
  const [search,setSearch]=useState('');
  const [type,setType]=useState('');
  const [total,setTotal]=useState(0);

  const fetch = async (s=search,t=type) => {
    setLoading(true);
    try {
      const params={limit:20};
      if(s) params.search=s;
      if(t) params.product_type=t;
      const res=await productsAPI.list(params);
      setProducts(res.data.products);
      setTotal(res.data.total);
    } catch{setProducts([]);}
    setLoading(false);
  };
  useEffect(()=>{fetch();},[]);

  return (
    <div className="page-container">
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900">Explorar productos</h1><p className="text-gray-500 mt-1">{total} productos disponibles</p></div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex-1 min-w-48 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&fetch()} placeholder="Buscar productos..." className="form-input pl-9"/>
        </div>
        <select value={type} onChange={e=>{setType(e.target.value);fetch(search,e.target.value);}} className="form-input w-auto">
          <option value="">Todos los tipos</option><option value="physical">Fisico</option><option value="digital">Digital</option>
        </select>
        <button onClick={()=>fetch()} className="btn btn-primary"><Filter className="w-4 h-4"/>Filtrar</button>
      </div>
      {loading ? <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>
      : products.length===0 ? <div className="text-center py-20"><Package className="w-16 h-16 text-gray-300 mx-auto mb-4"/><h3 className="font-semibold text-gray-600">No hay productos</h3><button onClick={()=>navigate('/products/new')} className="btn btn-primary mt-4">Publicar producto</button></div>
      : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">{products.map(p=><ProductCard key={p.id} product={p}/>)}</div>}
    </div>
  );
}

function ProductCard({product}) {
  const navigate=useNavigate();
  return (
    <article className="card-hover overflow-hidden" onClick={()=>navigate(`/products/${product.id}`)}>
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {product.images?.[0]?<img src={product.images[0]} alt={product.title} className="w-full h-full object-cover" loading="lazy"/>:<div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-300"/></div>}
        <span className="absolute top-2 left-2 badge badge-neutral">{product.product_type==='digital'?'Digital':'Fisico'}</span>
      </div>
      <div className="p-4">
        <h3 className="font-medium text-gray-900 text-sm line-clamp-2 mb-1">{product.title}</h3>
        <div className="flex items-center gap-1 mb-2"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"/><span className="text-xs text-gray-500">{parseFloat(product.seller?.reputation_score||0).toFixed(1)} · {product.seller?.name}</span></div>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">{formatPrice(product.price)}</span>
          <div className="flex gap-1">{product.accepted_payment_methods?.map(m=><span key={m} className="badge badge-neutral">{m==='cash'?'Efectivo':'Virtual'}</span>)}</div>
        </div>
      </div>
    </article>
  );
}

export function ProductDetailPage() {
  const {id}=useParams(); const navigate=useNavigate(); const {user,isAuthenticated}=useAuthStore();
  const [product,setProduct]=useState(null); const [seller,setSeller]=useState(null);
  const [loading,setLoading]=useState(true); const [paymentMethod,setMethod]=useState('');
  const [buying,setBuying]=useState(false); const [error,setError]=useState('');
  const [activeImg,setActiveImg]=useState(0);

  useEffect(()=>{
    productsAPI.getById(id).then(res=>{setProduct(res.data);setActiveImg(0);return usersAPI.getProfile(res.data.seller_id);})
    .then(res=>setSeller(res.data)).catch(()=>navigate('/products')).finally(()=>setLoading(false));
  },[id]);

  const handleBuy=async()=>{
    if(!isAuthenticated){navigate('/login');return;}
    if(!paymentMethod){setError('Selecciona una modalidad de pago.');return;}
    setError('');setBuying(true);
    try{const res=await transactionsAPI.initiate({product_id:id,payment_method:paymentMethod});navigate(`/checkout/${res.data.id}`);}
    catch(e){setError(e.message||'Error al iniciar la compra.');}
    setBuying(false);
  };

  if(loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"/></div>;
  if(!product) return null;
  const isOwner=user?.id===product.seller_id;

  return (
    <div className="page-container">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <div className="aspect-square bg-gray-100 rounded-2xl overflow-hidden">
            {product.images?.[activeImg]?<img src={product.images[activeImg]} alt={product.title} className="w-full h-full object-cover"/>:<div className="w-full h-full flex items-center justify-center"><Package className="w-20 h-20 text-gray-300"/></div>}
          </div>
          {product.images?.length>1&&<div className="flex gap-2 mt-3 overflow-x-auto">{product.images.map((img,i)=><img key={i} src={img} alt="" onClick={()=>setActiveImg(i)} className={`w-16 h-16 rounded-lg object-cover flex-shrink-0 cursor-pointer border-2 ${activeImg===i?'border-indigo-500':'border-transparent hover:border-indigo-300'}`}/>)}</div>}
        </div>

        <div className="space-y-5">
          <div>
            <div className="flex gap-2 mb-2"><span className="badge badge-neutral">{product.product_type==='digital'?'Digital':'Fisico'}</span>{product.category&&<span className="badge badge-neutral">{product.category}</span>}</div>
            <h1 className="text-2xl font-bold text-gray-900">{product.title}</h1>
            <p className="text-3xl font-bold text-indigo-600 mt-2">{formatPrice(product.price)}</p>
          </div>

          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100" onClick={()=>navigate(`/profile/${product.seller_id}`)}>
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-indigo-700 font-bold text-sm">{seller?.user?.name?.charAt(0)?.toUpperCase()||'V'}</span>
            </div>
            <div><p className="font-medium text-gray-800 text-sm">{seller?.user?.name}</p>
              <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400"/><span className="text-xs text-gray-500">{parseFloat(seller?.user?.reputation_score||0).toFixed(1)} ({seller?.user?.total_ratings} calificaciones)</span></div>
            </div>
            <span className="ml-auto text-xs text-indigo-600 font-medium">Ver perfil →</span>
          </div>

          <div><h3 className="text-sm font-semibold text-gray-700 mb-2">Descripcion</h3><p className="text-sm text-gray-600 leading-relaxed">{product.description}</p></div>
          {product.product_type==='physical'&&<p className="text-sm text-gray-500">Stock: <strong>{product.stock}</strong></p>}

          {!isOwner&&(
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Modalidad de pago <span className="text-red-500">*</span></h3>
              <div className="grid grid-cols-2 gap-3">
                {product.accepted_payment_methods?.map(method=>(
                  <label key={method} className={`p-4 border-2 rounded-xl text-center cursor-pointer transition-all ${paymentMethod===method?'border-indigo-500 bg-indigo-50':'border-gray-200 hover:border-gray-300'}`}>
                    <input type="radio" name="paymentMethod" value={method} className="sr-only" onChange={()=>setMethod(method)}/>
                    <p className="font-semibold text-sm text-gray-800">{method==='cash'?'Efectivo':'Pago virtual'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{method==='cash'?'Encuentro presencial':'Escrow seguro'}</p>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error&&<Alert type="danger">{error}</Alert>}

          {!isOwner?(
            <button onClick={handleBuy} disabled={!paymentMethod||buying} className="btn btn-primary btn-lg w-full">
              <ShoppingCart className="w-5 h-5"/>{buying?'Procesando...':'Comprar ahora'}
            </button>
          ):(
            <button onClick={()=>navigate(`/products/${id}/edit`)} className="btn btn-secondary btn-lg w-full">Editar producto</button>
          )}
        </div>
      </div>
    </div>
  );
}

const productSchema=z.object({
  title:z.string().min(3,'Min 3 caracteres').max(200),
  description:z.string().min(10,'Min 10 caracteres'),
  price:z.coerce.number({invalid_type_error:'Precio invalido'}).gt(0,'Debe ser mayor a $0'),
  product_type:z.enum(['physical','digital']),
  category:z.string().optional(),
  stock:z.coerce.number().int().min(1).default(1),
  accepted_payment_methods:z.array(z.string()).min(1,'Selecciona al menos uno')
});

export function PublishProductPage() {
  const navigate=useNavigate(); const {user}=useAuthStore();
  const [serverError,setServerError]=useState('');
  const [images,setImages]=useState([]);
  const [digitalFile,setDigitalFile]=useState('');
  const [imageInput,setImageInput]=useState('');
  const [productType,setProductType]=useState('physical');

  const {register,handleSubmit,setValue,formState:{errors,isSubmitting}}=useForm({
    resolver:zodResolver(productSchema),
    defaultValues:{product_type:'physical',accepted_payment_methods:['cash','virtual'],stock:1}
  });

  const addImage=()=>{
    const url=imageInput.trim();
    if(!url) return;
    if(!url.startsWith('http')){setServerError('URL invalida');return;}
    setImages(prev=>[...prev,url]); setImageInput(''); setServerError('');
  };
  const removeImage=i=>setImages(prev=>prev.filter((_,idx)=>idx!==i));

  const onSubmit=async(data)=>{
    setServerError('');
    if(images.length===0){setServerError('Agrega al menos una imagen.');return;}
    if(data.product_type==='digital'&&!digitalFile.trim()){setServerError('Debes adjuntar el archivo del producto digital.');return;}
    try{
      await productsAPI.create({...data,images,digital_file_url:data.product_type==='digital'?digitalFile:undefined});
      navigate('/my-sales');
    } catch(e){setServerError(e.message||'Error al publicar.');}
  };

  return (
    <div className="page-container max-w-2xl">
      <div className="mb-8"><h1 className="text-2xl font-bold text-gray-900">Publicar producto</h1></div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        {serverError&&<Alert type="danger" onClose={()=>setServerError('')}>{serverError}</Alert>}

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Tipo de producto</h2>
          <div className="grid grid-cols-2 gap-3">
            {[{value:'physical',label:'Fisico',desc:'Artículo tangible'},{value:'digital',label:'Digital',desc:'Archivo descargable'}].map(({value,label,desc})=>(
              <label key={value} className={`p-3 border-2 rounded-xl text-sm cursor-pointer transition-all ${productType===value?'border-indigo-500 bg-indigo-50':'border-gray-200 hover:border-gray-300'}`}>
                <input type="radio" value={value} className="sr-only" {...register('product_type')} onChange={()=>{setValue('product_type',value);setProductType(value);}}/>
                <p className="font-semibold text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p>
              </label>
            ))}
          </div>
        </div>

        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-gray-800">Informacion basica</h2>
          <div><label className="form-label">Titulo <span className="text-red-500">*</span></label><input className={errors.title?'form-input-error':'form-input'} placeholder="Ej: iPhone 13 Pro" {...register('title')}/>{errors.title&&<p className="form-error">{errors.title.message}</p>}</div>
          <div><label className="form-label">Descripcion <span className="text-red-500">*</span></label><textarea className="form-input resize-none" rows={4} placeholder="Describe tu producto..." {...register('description')}/>{errors.description&&<p className="form-error">{errors.description.message}</p>}</div>
          <div><label className="form-label">Precio <span className="text-red-500">*</span></label><input type="number" min="0.01" step="0.01" className={errors.price?'form-input-error':'form-input'} placeholder="0.00" {...register('price')}/>{errors.price&&<p className="form-error">{errors.price.message}</p>}</div>
          {productType==='physical'&&<div><label className="form-label">Stock <span className="text-red-500">*</span></label><input type="number" min="1" className="form-input" {...register('stock')}/></div>}
          <div><label className="form-label">Categoria</label><input className="form-input" placeholder="Electronica, Ropa, Hogar..." {...register('category')}/></div>
        </div>

        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-800">Imagenes <span className="text-red-500">*</span></h2>
          <p className="text-xs text-gray-500">Agrega URLs de imagenes. Puedes subir a imgur.com, imgbb.com o similar.</p>
          <div className="flex gap-2">
            <input type="url" value={imageInput} onChange={e=>setImageInput(e.target.value)} placeholder="https://i.imgur.com/ejemplo.jpg" className="form-input flex-1" onKeyDown={e=>e.key==='Enter'&&(e.preventDefault(),addImage())}/>
            <button type="button" onClick={addImage} className="btn btn-secondary"><Plus className="w-4 h-4"/>Agregar</button>
          </div>
          {images.length>0&&(
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-2">
              {images.map((url,i)=>(
                <div key={i} className="relative group aspect-square">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg border border-gray-200" onError={e=>e.target.src='https://via.placeholder.com/150?text=Error'}/>
                  <button type="button" onClick={()=>removeImage(i)} className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><X className="w-3 h-3"/></button>
                </div>
              ))}
            </div>
          )}
        </div>

        {productType==='digital'&&(
          <div className="card p-6 space-y-3">
            <h2 className="font-semibold text-gray-800">Archivo del producto <span className="text-red-500">*</span></h2>
            <input type="url" value={digitalFile} onChange={e=>setDigitalFile(e.target.value)} placeholder="https://drive.google.com/file/..." className="form-input"/>
          </div>
        )}

        <div className="card p-6 space-y-3">
          <h2 className="font-semibold text-gray-800">Modalidades de pago aceptadas</h2>
          {[{value:'cash',label:'Efectivo',desc:'Pago presencial'},{value:'virtual',label:'Pago virtual',desc:'Escrow seguro'}].map(({value,label,desc})=>(
            <label key={value} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" value={value} className="w-4 h-4 rounded border-gray-300 text-indigo-600" {...register('accepted_payment_methods')}/>
              <div><p className="text-sm font-medium text-gray-800">{label}</p><p className="text-xs text-gray-500">{desc}</p></div>
            </label>
          ))}
          {errors.accepted_payment_methods&&<p className="form-error">{errors.accepted_payment_methods.message}</p>}
        </div>

        <div className="flex gap-3">
          <button type="button" className="btn btn-secondary flex-1" onClick={()=>navigate(-1)}>Cancelar</button>
          <button type="submit" disabled={isSubmitting} className="btn btn-primary btn-lg flex-1">{isSubmitting?'Publicando...':'Publicar producto'}</button>
        </div>
      </form>
    </div>
  );
}
