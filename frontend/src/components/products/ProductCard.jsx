/**
 * DirectMarket - Componente ProductCard
 *
 * Tarjeta de producto reutilizable para el listado (RF-02).
 * Usada tanto en la pagina de listado como en busquedas.
 */

import { useNavigate } from 'react-router-dom';
import { Star, Package } from 'lucide-react';
import { Badge } from '../common';
import { formatPrice } from '../../utils';

export default function ProductCard({ product }) {
  const navigate = useNavigate();

  return (
    <article
      className="card-hover overflow-hidden"
      onClick={() => navigate(`/products/${product.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/products/${product.id}`)}
      aria-label={`${product.title}, ${formatPrice(product.price)}`}
    >
      {/* Imagen del producto */}
      <div className="aspect-square bg-neutral-100 relative overflow-hidden">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-12 h-12 text-neutral-300" />
          </div>
        )}

        {/* Badge de tipo */}
        <div className="absolute top-2 left-2">
          <Badge variant={product.product_type === 'digital' ? 'brand' : 'neutral'}>
            {product.product_type === 'digital' ? 'Digital' : 'Fisico'}
          </Badge>
        </div>

        {/* Badge de stock bajo */}
        {product.product_type === 'physical' && product.stock <= 2 && product.stock > 0 && (
          <div className="absolute top-2 right-2">
            <Badge variant="warning">Ultimas {product.stock}</Badge>
          </div>
        )}
      </div>

      {/* Informacion del producto */}
      <div className="p-4">
        <h3 className="font-medium text-neutral-900 text-sm line-clamp-2 leading-snug mb-1.5">
          {product.title}
        </h3>

        {/* Vendedor y calificacion */}
        <div className="flex items-center gap-1.5 mb-3">
          <Star className="w-3.5 h-3.5 fill-warning-400 text-warning-400 flex-shrink-0" />
          <span className="text-xs text-neutral-500 truncate">
            {parseFloat(product.seller?.reputation_score || 0).toFixed(1)}
            {' '}&middot;{' '}
            {product.seller?.name || 'Vendedor'}
          </span>
        </div>

        {/* Precio y modalidades de pago */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-neutral-900">
            {formatPrice(product.price)}
          </span>
          <div className="flex gap-1 flex-wrap justify-end">
            {product.accepted_payment_methods?.map((m) => (
              <Badge key={m} variant="neutral" className="text-xs">
                {m === 'cash' ? 'Efectivo' : 'Virtual'}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}
