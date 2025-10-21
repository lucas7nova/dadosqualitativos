import express from 'express';
import Log from '../models/Log.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Função auxiliar para registrar logs com controle de duplicação
const createLog = async (req, action, module, details = '') => {
  // Ignora logs de listagem e evita duplicação
  if (action === 'list' || action.includes('list-')) {
    return;
  }

  try {
    // Verifica se já existe um log recente com a mesma ação e módulo para o mesmo usuário
    const recentLog = await Log.findOne({
      userId: req.user?._id || null,
      action,
      module,
      timestamp: { $gte: new Date(Date.now() - 5000) }, // Últimos 5 segundos
    });

    if (recentLog) {
      console.log('Log duplicado ignorado em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }));
      return;
    }

    const log = await Log.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Usuário Desconhecido',
      action,
      module,
      details,
      timestamp: new Date(),
    });
    console.log('Log criado em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), log);
  } catch (error) {
    console.error('Erro ao registrar log em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), error.message);
  }
};

// Rota para listar logs com filtros e paginação
router.get('/logs', protect, async (req, res) => {
  try {
    const { page = 1, limit = 10, dateStart, dateEnd, user, action, module } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    let query = {};

    if (dateStart && dateEnd) {
      query.timestamp = {
        $gte: new Date(dateStart),
        $lte: new Date(dateEnd),
      };
    } else if (dateStart) {
      query.timestamp = { $gte: new Date(dateStart) };
    } else if (dateEnd) {
      query.timestamp = { $lte: new Date(dateEnd) };
    }
    if (user) {
      query.userName = { $regex: new RegExp(user, 'i') };
    }
    if (action) {
      query.action = { $regex: new RegExp(action, 'i') };
    }
    if (module) {
      query.module = { $regex: new RegExp(module, 'i') };
    }

    console.log('Consulta de logs em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), { query, pageNum, limitNum, skip });

    const total = await Log.countDocuments(query);
    const logs = await Log.find(query)
      .skip(skip)
      .limit(limitNum)
      .sort({ timestamp: -1 })
      .populate('userId', 'name email')
      .lean();

    console.log('Logs encontrados em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), logs.length, 'Total:', total);

    const logsWithFallback = logs.map(log => ({
      ...log,
      userName: log.userId?.name || log.userName || 'Usuário Desconhecido',
    }));

    // Registra log de listagem com ação e módulo pré-definidos
    await createLog(req, 'list', 'logs', `Listagem de logs realizada (página ${pageNum}, limite ${limitNum})`);

    res.status(200).json({
      success: true,
      logs: logsWithFallback,
      total,
      page: pageNum,
      pages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Erro ao listar logs em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), error.message, error.stack);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar logs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
});

// Rota para criar um log manualmente (via frontend ou API)
router.post('/logs', protect, async (req, res) => {
  try {
    const { userId, userName, action, module, details } = req.body;

    if (!action || !module) {
      return res.status(400).json({ message: 'action e module são obrigatórios.' });
    }

    if (!['usuarios', 'treinamentos', 'beneficiarios', 'avaliacoes', 'comunicados', 'acesso', 'logs', 'dadosbancarios', 'pagamentos', 'folha', 'frequencia', 'menu', 'tipomenu', 'cidades', 'auth'].includes(module)) {
      return res.status(400).json({ message: `Módulo '${module}' não permitido.` });
    }

    const log = await Log.create({
      userId,
      userName: userName || 'Usuário Desconhecido',
      action,
      module,
      details,
      timestamp: new Date(),
    });

    await createLog(req, 'create', 'logs', `Log criado manualmente: ${action} - ${module}`);

    res.status(201).json({ success: true, message: 'Log criado com sucesso.', log });
  } catch (error) {
    console.error('Erro ao criar log em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), error.message);
    res.status(500).json({ success: false, message: 'Erro ao criar log.', error: error.message });
  }
});

// Rota para excluir logs de listagem
router.delete('/clear-list', protect, authorize('administrador'), async (req, res) => {
  try {
    const result = await Log.deleteMany({ action: 'list' });
    await createLog(req, 'delete', 'logs', `Excluídos ${result.deletedCount} logs de listagem em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`);
    res.status(200).json({ success: true, message: `Excluídos ${result.deletedCount} logs de listagem`, deletedCount: result.deletedCount });
  } catch (error) {
    console.error('Erro ao excluir logs de listagem em:', new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }), error.message);
    res.status(500).json({ success: false, message: 'Erro ao excluir logs de listagem', error: error.message });
  }
});

export { createLog };
export default router;
