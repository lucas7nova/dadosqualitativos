// routes/menu.routes.js
import express from 'express';
import Menu from '../models/menu.js';
import Cidade from '../models/Cidade.js';
import TipoMenu from '../models/TipoMenu.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import Log from '../models/Log.js';

const router = express.Router();

const createLog = async (req, action, module, details = '') => {
  try {
    await Log.create({
      userId: req.user?._id || null,
      userName: req.user?.name || 'Usuário Desconhecido',
      action,
      module,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error.message);
  }
};

// GET /api/menu - Listar itens de menu
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    if (req.user.perfil !== 'administrador' && req.user.perfil !== 'gestor global' && req.user.cidade && req.user.cidade.length > 0) {
      query.cidade = { $in: req.user.cidade };
    }
    const menus = await Menu.find(query).populate('cidade', 'nome').populate('tipo', 'nome');

    await createLog(req, 'read', 'menu', `Listagem de itens de menu realizada`);

    res.status(200).json(menus);
  } catch (err) {
    console.error('Erro ao listar itens de menu:', err);
    await createLog(req, 'read-error', 'menu', err.message);
    res.status(500).json({ message: 'Erro ao listar itens de menu.', error: err.message });
  }
});

// POST /api/menu - Criar novo item de menu
router.post('/', protect, authorize('administrador'), async (req, res) => {
  try {
    const { cidade, tipo, item, titulo, texto, link } = req.body;
    if (!cidade || !tipo || !item || !link) {
      await createLog(req, 'create-failed', 'menu', 'Campos obrigatórios ausentes.');
      return res.status(400).json({ message: 'Cidade, tipo, item e link são obrigatórios.' });
    }
    const cidadeExistente = await Cidade.findById(cidade);
    if (!cidadeExistente) {
      await createLog(req, 'create-failed', 'menu', 'Cidade não encontrada.');
      return res.status(404).json({ message: 'Cidade não encontrada.' });
    }
    const tipoExistente = await TipoMenu.findById(tipo);
    if (!tipoExistente) {
      await createLog(req, 'create-failed', 'menu', 'Tipo não encontrado.');
      return res.status(404).json({ message: 'Tipo não encontrado.' });
    }
    const menu = new Menu({ cidade, tipo, item, titulo, texto, link });
    await menu.save();
    await createLog(req, 'create', 'menu', `Novo item de menu criado: ${item}`);
    res.status(201).json({ message: 'Item de menu criado com sucesso!', menu });
  } catch (err) {
    console.error('Erro ao criar item de menu:', err);
    await createLog(req, 'create-error', 'menu', err.message);
    res.status(500).json({ message: 'Erro ao criar item de menu.', error: err.message });
  }
});

// PUT /api/menu/:id - Atualizar item de menu
router.put('/:id', protect, authorize('administrador'), async (req, res) => {
  try {
    const { cidade, tipo, item, titulo, texto, link } = req.body;
    if (!cidade || !tipo || !item || !link) {
      await createLog(req, 'update-failed', 'menu', 'Campos obrigatórios ausentes.');
      return res.status(400).json({ message: 'Cidade, tipo, item e link são obrigatórios.' });
    }
    const cidadeExistente = await Cidade.findById(cidade);
    if (!cidadeExistente) {
      await createLog(req, 'update-failed', 'menu', 'Cidade não encontrada.');
      return res.status(404).json({ message: 'Cidade não encontrada.' });
    }
    const tipoExistente = await TipoMenu.findById(tipo);
    if (!tipoExistente) {
      await createLog(req, 'update-failed', 'menu', 'Tipo não encontrado.');
      return res.status(404).json({ message: 'Tipo não encontrado.' });
    }
    const updatedMenu = await Menu.findByIdAndUpdate(
      req.params.id,
      { cidade, tipo, item, titulo, texto, link },
      { new: true, runValidators: true }
    );
    if (!updatedMenu) {
      await createLog(req, 'update-failed', 'menu', `Item de menu não encontrado: ${req.params.id}`);
      return res.status(404).json({ message: 'Item de menu não encontrado.' });
    }
    await createLog(req, 'update', 'menu', `Item de menu atualizado: ${item}`);
    res.status(200).json({ message: 'Item de menu atualizado com sucesso!', menu: updatedMenu });
  } catch (err) {
    console.error('Erro ao atualizar item de menu:', err);
    await createLog(req, 'update-error', 'menu', err.message);
    res.status(500).json({ message: 'Erro ao atualizar item de menu.', error: err.message });
  }
});

// DELETE /api/menu/:id - Excluir item de menu
router.delete('/:id', protect, authorize('administrador'), async (req, res) => {
  try {
    const deletedMenu = await Menu.findByIdAndDelete(req.params.id);
    if (!deletedMenu) {
      await createLog(req, 'delete-failed', 'menu', `Item de menu não encontrado: ${req.params.id}`);
      return res.status(404).json({ message: 'Item de menu não encontrado.' });
    }
    await createLog(req, 'delete', 'menu', `Item de menu excluído: ${deletedMenu.item}`);
    res.status(200).json({ message: 'Item de menu excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir item de menu:', err);
    await createLog(req, 'delete-error', 'menu', err.message);
    res.status(500).json({ message: 'Erro ao excluir item de menu.', error: err.message });
  }
});

// GET /api/menu/:id - Obter item de menu específico
router.get('/:id', protect, async (req, res) => {
  console.log(`Requisição recebida para /api/menu/${req.params.id}`);
  try {
    const menu = await Menu.findById(req.params.id).populate('cidade', 'nome').populate('tipo', 'nome');
    if (!menu) {
      return res.status(404).json({ message: 'Item de menu não encontrado.' });
    }
    // Verificar permissão
    if (req.user.perfil !== 'administrador' && req.user.perfil !== 'gestor global') {
      if (!req.user.cidade || !req.user.cidade.includes(menu.cidade._id.toString())) {
        return res.status(403).json({ message: 'Não autorizado a acessar este item.' });
      }
    }

    await createLog(req, 'read', 'menu', `Item de menu lido: ${req.params.id}`);

    res.status(200).json(menu);
  } catch (err) {
    console.error('Erro ao obter item de menu:', err);
    await createLog(req, 'read-error', 'menu', err.message);
    res.status(500).json({ message: 'Erro ao obter item de menu.', error: err.message });
  }
});

export default router;

