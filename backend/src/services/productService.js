/**
 * DirectMarket - Servicio de Productos
 *
 * Trazabilidad:
 *   RF-02 : publicar productos fisicos o digitales
 *   CP-003: precio = 0 debe retornar error "El precio debe ser mayor a $0."
 *   CP-004: producto digital sin archivo debe retornar error
 */

const { Product, User } = require('../models');
const { Op } = require('sequelize');
const logger = require('../utils/logger');

/**
 * Crea un nuevo producto.
 *
 * Validaciones de negocio (no solo de modelo):
 *   - CP-003: precio debe ser > 0 (validado tambien en el modelo pero verificado aqui)
 *   - CP-004: producto digital debe tener archivo adjunto
 *   - Al menos una imagen es obligatoria
 *
 * @param {string} sellerId
 * @param {Object} productData
 * @returns {Product}
 */
const createProduct = async (sellerId, productData) => {
  const {
    title,
    description,
    price,
    product_type,
    digital_file_url,
    images = [],
    category,
    tags = [],
    accepted_payment_methods = ['cash', 'virtual'],
    stock = 1
  } = productData;

  // CP-003: validacion explicita de precio
  if (!price || parseFloat(price) <= 0) {
    const error = new Error('El precio debe ser mayor a $0.');
    error.statusCode = 400;
    error.field = 'price';
    throw error;
  }

  // CP-004: producto digital requiere archivo adjunto
  if (product_type === 'digital' && !digital_file_url) {
    const error = new Error('Debe adjuntar el archivo del producto digital.');
    error.statusCode = 400;
    error.field = 'digital_file_url';
    throw error;
  }

  // Al menos una imagen es obligatoria (checklist mockup item 7)
  if (!images || images.length === 0) {
    const error = new Error('Debe incluir al menos una imagen del producto.');
    error.statusCode = 400;
    error.field = 'images';
    throw error;
  }

  const product = await Product.create({
    seller_id: sellerId,
    title,
    description,
    price: parseFloat(price),
    product_type,
    digital_file_url: product_type === 'digital' ? digital_file_url : null,
    images,
    category,
    tags,
    accepted_payment_methods,
    stock: parseInt(stock, 10)
  });

  logger.info(`Producto creado: ${product.id} por vendedor ${sellerId}`);
  return product;
};

/**
 * Lista productos activos con filtros y paginacion.
 * Implementa busqueda y filtrado (objetivo especifico del proyecto).
 *
 * @param {Object} filters - { category, minPrice, maxPrice, search, product_type }
 * @param {number} page
 * @param {number} limit
 * @returns {Object} { products, total, page, totalPages }
 */
const listProducts = async (filters = {}, page = 1, limit = 20) => {
  const where = { status: 'active' };
  const { category, minPrice, maxPrice, search, product_type } = filters;

  if (category) where.category = category;
  if (product_type) where.product_type = product_type;

  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price[Op.gte] = parseFloat(minPrice);
    if (maxPrice) where.price[Op.lte] = parseFloat(maxPrice);
  }

  if (search) {
    where[Op.or] = [
      { title: { [Op.iLike]: `%${search}%` } },
      { description: { [Op.iLike]: `%${search}%` } }
    ];
  }

  const offset = (page - 1) * limit;
  const { count, rows } = await Product.findAndCountAll({
    where,
    include: [{ model: User, as: 'seller', attributes: ['id', 'name', 'reputation_score'] }],
    order: [['created_at', 'DESC']],
    limit,
    offset
  });

  return {
    products: rows,
    total: count,
    page,
    totalPages: Math.ceil(count / limit)
  };
};

/**
 * Obtiene un producto por ID con datos del vendedor.
 *
 * @param {string} productId
 * @returns {Product}
 */
const getProductById = async (productId) => {
  const product = await Product.findOne({
    where: { id: productId, status: 'active' },
    include: [{ model: User, as: 'seller', attributes: ['id', 'name', 'reputation_score', 'total_ratings'] }]
  });

  if (!product) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  return product;
};

/**
 * Actualiza un producto. Solo el vendedor dueno puede editar su producto.
 *
 * @param {string} productId
 * @param {string} sellerId
 * @param {Object} updates
 * @returns {Product}
 */
const updateProduct = async (productId, sellerId, updates) => {
  const product = await Product.findByPk(productId);

  if (!product) {
    const error = new Error('Producto no encontrado.');
    error.statusCode = 404;
    throw error;
  }

  if (product.seller_id !== sellerId) {
    const error = new Error('No autorizado para editar este producto.');
    error.statusCode = 403;
    throw error;
  }

  // Aplicar las mismas validaciones de negocio al actualizar
  if (updates.price !== undefined && parseFloat(updates.price) <= 0) {
    const error = new Error('El precio debe ser mayor a $0.');
    error.statusCode = 400;
    throw error;
  }

  if (updates.product_type === 'digital' && !updates.digital_file_url && !product.digital_file_url) {
    const error = new Error('Debe adjuntar el archivo del producto digital.');
    error.statusCode = 400;
    throw error;
  }

  await product.update(updates);
  logger.info(`Producto actualizado: ${productId}`);
  return product;
};

module.exports = { createProduct, listProducts, getProductById, updateProduct };
