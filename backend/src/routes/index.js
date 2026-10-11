const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { authenticate, requireAdmin, requireEmailVerified } = require('../middleware/auth');
const {
  validateRegister, validateLogin, validateCreateProduct,
  validateInitiateTransaction, validateProposeMeeting,
  validateReleaseCode, validateOpenDispute, validateCreateRating, validateResolveDispute
} = require('../middleware/validation');

const authService       = require('../services/authService');
const productService    = require('../services/productService');
const transactionService = require('../services/transactionService');
const { createReleaseCode, validateReleaseCode: validateCode, getReleaseCodeStatus } = require('../services/releaseCodeService');
const { openDispute, resolveDispute, listDisputes, createRating } = require('../services/disputeService');
const { User, Product, Transaction, Dispute, Rating } = require('../models');
const { Op } = require('sequelize');

const authLimiter = rateLimit({ windowMs: 15*60*1000, max: 20, message: { success: false, message: 'Demasiadas solicitudes.' } });
const apiLimiter  = rateLimit({ windowMs: 60*1000, max: 200, message: { success: false, message: 'Limite alcanzado.' } });
router.use(apiLimiter);

// ── AUTH ──────────────────────────────────────────────────────────────────────
router.post('/auth/register', authLimiter, validateRegister, async (req, res) => {
  try {
    const result = await authService.registerUser(req.body);
    res.status(201).json({ success: true, message: 'Cuenta creada exitosamente.', data: result });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.post('/auth/login', authLimiter, validateLogin, async (req, res) => {
  try {
    const result = await authService.loginUser(req.body.email, req.body.password);
    res.status(200).json({ success: true, data: result });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.get('/auth/verify-email', async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, message: 'Token requerido.' });
    await authService.verifyEmail(token);
    res.status(200).json({ success: true, message: 'Correo verificado.' });
  } catch (e) { res.status(e.statusCode||400).json({ success: false, message: e.message }); }
});

router.get('/auth/me', authenticate, async (req, res) => {
  const user = await User.findByPk(req.user.id, {
    attributes: ['id','name','email','role','email_verified','reputation_score','total_ratings','created_at']
  });
  res.status(200).json({ success: true, data: user });
});

// ── PERFILES PUBLICOS ─────────────────────────────────────────────────────────
router.get('/users/:id/profile', async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ['id','name','role','reputation_score','total_ratings','created_at']
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    const ratings = await Rating.findAll({
      where: { rated_user_id: req.params.id },
      include: [{ model: User, as: 'rater', attributes: ['id','name'] }],
      order: [['created_at','DESC']],
      limit: 10
    });

    const products = await Product.findAll({
      where: { seller_id: req.params.id, status: 'active' },
      limit: 6,
      order: [['created_at','DESC']]
    });

    res.status(200).json({ success: true, data: { user, ratings, products } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── PRODUCTOS ─────────────────────────────────────────────────────────────────
router.get('/products', async (req, res) => {
  try {
    const { category, minPrice, maxPrice, search, product_type, page=1, limit=20 } = req.query;
    const result = await productService.listProducts(
      { category, minPrice, maxPrice, search, product_type },
      parseInt(page), parseInt(limit)
    );
    res.status(200).json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/products/:id', async (req, res) => {
  try {
    const product = await productService.getProductById(req.params.id);
    res.status(200).json({ success: true, data: product });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.post('/products', authenticate, validateCreateProduct, async (req, res) => {
  try {
    const product = await productService.createProduct(req.user.id, req.body);
    res.status(201).json({ success: true, data: product });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.put('/products/:id', authenticate, async (req, res) => {
  try {
    const product = await productService.updateProduct(req.params.id, req.user.id, req.body);
    res.status(200).json({ success: true, data: product });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

// Mis productos (vendedor)
router.get('/my/products', authenticate, async (req, res) => {
  try {
    const products = await Product.findAll({
      where: { seller_id: req.user.id },
      order: [['created_at','DESC']]
    });
    res.status(200).json({ success: true, data: products });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// ── TRANSACCIONES ─────────────────────────────────────────────────────────────
router.post('/transactions', authenticate, validateInitiateTransaction, async (req, res) => {
  try {
    const { product_id, payment_method } = req.body;
    const transaction = await transactionService.initiateTransaction(req.user.id, product_id, payment_method);
    res.status(201).json({ success: true, data: transaction });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.get('/transactions/purchases', authenticate, async (req, res) => {
  try {
    const result = await transactionService.getUserTransactions(req.user.id, 'buyer', parseInt(req.query.page||1), 20);
    res.status(200).json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/transactions/sales', authenticate, async (req, res) => {
  try {
    const result = await transactionService.getUserTransactions(req.user.id, 'seller', parseInt(req.query.page||1), 20);
    res.status(200).json({ success: true, data: result });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/transactions/:id', authenticate, async (req, res) => {
  try {
    const tx = await Transaction.findByPk(req.params.id, {
      include: [
        { model: Product, as: 'product' },
        { model: User, as: 'buyer', attributes: ['id','name','email','reputation_score'] },
        { model: User, as: 'seller', attributes: ['id','name','email','reputation_score'] }
      ]
    });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaccion no encontrada.' });
    if (tx.buyer_id !== req.user.id && tx.seller_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'No autorizado.' });
    }
    res.status(200).json({ success: true, data: tx });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.post('/transactions/:id/confirm-payment', authenticate, async (req, res) => {
  try {
    const result = await transactionService.confirmVirtualPayment(req.params.id, req.user.id, req.body.gatewayRef || `GW-${Date.now()}`);
    res.status(200).json({ success: true, message: 'Pago confirmado. Dinero en escrow.', data: result });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.get('/transactions/:id/release-code-status', authenticate, async (req, res) => {
  try {
    const status = await getReleaseCodeStatus(req.params.id, req.user.id);
    res.status(200).json({ success: true, data: status });
  } catch (e) { res.status(e.statusCode||403).json({ success: false, message: e.message }); }
});

router.post('/transactions/validate-code', authenticate, validateReleaseCode, async (req, res) => {
  try {
    const result = await validateCode(req.body.transaction_id, req.body.code, req.user.id);
    res.status(result.success ? 200 : 400).json({ success: result.success, data: result });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.post('/transactions/:id/meetings', authenticate, validateProposeMeeting, async (req, res) => {
  try {
    const meeting = await transactionService.proposeMeeting(req.params.id, req.user.id, req.body);
    res.status(201).json({ success: true, data: meeting });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.put('/meetings/:id/respond', authenticate, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['confirm','reject'].includes(action)) return res.status(400).json({ success: false, message: 'Accion invalida.' });
    const meeting = await transactionService.respondToMeeting(req.params.id, req.user.id, action);
    res.status(200).json({ success: true, data: meeting });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.post('/transactions/:id/dispute', authenticate, validateOpenDispute, async (req, res) => {
  try {
    const dispute = await openDispute(req.params.id, req.user.id, req.body);
    res.status(201).json({ success: true, message: 'Disputa abierta. Pago congelado.', data: dispute });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

// ── CALIFICACIONES ────────────────────────────────────────────────────────────
router.post('/ratings/:transactionId', authenticate, validateCreateRating, async (req, res) => {
  try {
    const { rated_user_id, score, comment, rated_as } = req.body;
    const rating = await createRating(req.params.transactionId, req.user.id, rated_user_id, score, comment, rated_as);
    res.status(201).json({ success: true, data: rating });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

// ── ADMIN ─────────────────────────────────────────────────────────────────────
router.get('/admin/disputes', authenticate, requireAdmin, async (req, res) => {
  try {
    const disputes = await listDisputes(req.user.id, { status: req.query.status });
    res.status(200).json({ success: true, data: disputes });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

router.put('/admin/disputes/:id/resolve', authenticate, requireAdmin, validateResolveDispute, async (req, res) => {
  try {
    const dispute = await resolveDispute(req.params.id, req.user.id, req.body.resolution, req.body.resolution_notes);
    res.status(200).json({ success: true, message: 'Disputa resuelta.', data: dispute });
  } catch (e) { res.status(e.statusCode||500).json({ success: false, message: e.message }); }
});

// Lista todos los usuarios (admin)
router.get('/admin/users', authenticate, requireAdmin, async (req, res) => {
  try {
    const { search, role, page=1 } = req.query;
    const where = {};
    if (role) where.role = role;
    if (search) where[Op.or] = [
      { name:  { [Op.iLike]: `%${search}%` } },
      { email: { [Op.iLike]: `%${search}%` } }
    ];
    const { count, rows } = await User.findAndCountAll({
      where,
      attributes: ['id','name','email','role','email_verified','reputation_score','total_ratings','created_at','locked_until'],
      order: [['created_at','DESC']],
      limit: 20,
      offset: (parseInt(page)-1)*20
    });
    res.status(200).json({ success: true, data: { users: rows, total: count, page: parseInt(page), totalPages: Math.ceil(count/20) } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Ver perfil completo de un usuario (admin)
router.get('/admin/users/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password_hash','email_verification_token'] }
    });
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });

    const [products, purchases, sales, ratings] = await Promise.all([
      Product.findAll({ where: { seller_id: req.params.id }, order: [['created_at','DESC']] }),
      Transaction.findAndCountAll({ where: { buyer_id: req.params.id } }),
      Transaction.findAndCountAll({ where: { seller_id: req.params.id } }),
      Rating.findAll({ where: { rated_user_id: req.params.id }, order: [['created_at','DESC']], limit: 10 })
    ]);

    res.status(200).json({ success: true, data: { user, products, purchases: purchases.count, sales: sales.count, ratings } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Banear / desbanear usuario (admin)
router.put('/admin/users/:id/ban', authenticate, requireAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    if (user.role === 'admin') return res.status(400).json({ success: false, message: 'No puedes banear a otro administrador.' });

    const { action } = req.body; // 'ban' o 'unban'
    if (action === 'ban') {
      await user.update({ locked_until: new Date('2099-01-01') });
      res.status(200).json({ success: true, message: 'Usuario baneado.' });
    } else {
      await user.update({ locked_until: null, failed_login_attempts: 0 });
      res.status(200).json({ success: true, message: 'Usuario desbaneado.' });
    }
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Eliminar publicacion (admin)
router.delete('/admin/products/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const product = await Product.findByPk(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Producto no encontrado.' });
    await product.update({ status: 'removed' });
    res.status(200).json({ success: true, message: 'Publicacion eliminada.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Verificar email manualmente (admin)
router.put('/admin/users/:id/verify-email', authenticate, requireAdmin, async (req, res) => {
  try {
    await User.update({ email_verified: true }, { where: { id: req.params.id } });
    res.status(200).json({ success: true, message: 'Email verificado manualmente.' });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/admin/stats', authenticate, requireAdmin, async (req, res) => {
  try {
    const [totalUsers, totalProducts, activeTransactions, disputedTransactions, completedTransactions] = await Promise.all([
      User.count({ where: { role: { [Op.in]: ['buyer','seller'] } } }),
      Product.count({ where: { status: 'active' } }),
      Transaction.count({ where: { status: 'escrow_held' } }),
      Transaction.count({ where: { status: 'disputed' } }),
      Transaction.count({ where: { status: 'completed' } })
    ]);
    res.status(200).json({ success: true, data: { totalUsers, totalProducts, activeTransactions, disputedTransactions, completedTransactions } });
  } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

router.get('/health', (req, res) => res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() }));

module.exports = router;
