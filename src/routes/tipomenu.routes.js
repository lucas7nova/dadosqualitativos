// routes/tipomenu.routes.js
import express from 'express';
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

// GET /api/tipomenu - Listar tipos de menu
router.get('/', protect, async (req, res) => {
  try {
    const tipos = await TipoMenu.find({});
    await createLog(req, 'read', 'tipomenu', `Listagem de tipos de menu realizada`);
    res.status(200).json(tipos);
  } catch (err) {
    console.error('Erro ao listar tipos de menu:', err);
    await createLog(req, 'read-error', 'tipomenu', err.message);
    res.status(500).json({ message: 'Erro ao listar tipos de menu.', error: err.message });
  }
});

// POST /api/tipomenu - Criar novo tipo de menu
router.post('/', protect, authorize('administrador'), async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome) {
      await createLog(req, 'create-failed', 'tipomenu', 'Nome obrigatório ausente.');
      return res.status(400).json({ message: 'O nome é obrigatório.' });
    }
    const tipo = new TipoMenu({ nome: nome.trim(), descricao: descricao?.trim() });
    await tipo.save();
    await createLog(req, 'create', 'tipomenu', `Novo tipo de menu criado: ${nome}`);
    res.status(201).json({ message: 'Tipo de menu criado com sucesso!', tipo });
  } catch (err) {
    console.error('Erro ao criar tipo de menu:', err);
    await createLog(req, 'create-error', 'tipomenu', err.message);
    res.status(500).json({ message: 'Erro ao criar tipo de menu.', error: err.message });
  }
});

// PUT /api/tipomenu/:id - Atualizar tipo de menu
router.put('/:id', protect, authorize('administrador'), async (req, res) => {
  try {
    const { nome, descricao } = req.body;
    if (!nome) {
      await createLog(req, 'update-failed', 'tipomenu', 'Nome obrigatório ausente.');
      return res.status(400).json({ message: 'O nome é obrigatório.' });
    }
    const updatedTipo = await TipoMenu.findByIdAndUpdate(
      req.params.id,
      { nome: nome.trim(), descricao: descricao?.trim() },
      { new: true, runValidators: true }
    );
    if (!updatedTipo) {
      await createLog(req, 'update-failed', 'tipomenu', `Tipo de menu não encontrado: ${req.params.id}`);
      return res.status(404).json({ message: 'Tipo de menu não encontrado.' });
    }
    await createLog(req, 'update', 'tipomenu', `Tipo de menu atualizado: ${nome}`);
    res.status(200).json({ message: 'Tipo de menu atualizado com sucesso!', tipo: updatedTipo });
  } catch (err) {
    console.error('Erro ao atualizar tipo de menu:', err);
    await createLog(req, 'update-error', 'tipomenu', err.message);
    res.status(500).json({ message: 'Erro ao atualizar tipo de menu.', error: err.message });
  }
});

// DELETE /api/tipomenu/:id - Excluir tipo de menu
router.delete('/:id', protect, authorize('administrador'), async (req, res) => {
  try {
    const deletedTipo = await TipoMenu.findByIdAndDelete(req.params.id);
    if (!deletedTipo) {
      await createLog(req, 'delete-failed', 'tipomenu', `Tipo de menu não encontrado: ${req.params.id}`);
      return res.status(404).json({ message: 'Tipo de menu não encontrado.' });
    }
    await createLog(req, 'delete', 'tipomenu', `Tipo de menu excluído: ${deletedTipo.nome}`);
    res.status(200).json({ message: 'Tipo de menu excluído com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir tipo de menu:', err);
    await createLog(req, 'delete-error', 'tipomenu', err.message);
    res.status(500).json({ message: 'Erro ao excluir tipo de menu.', error: err.message });
  }
});

// GET /api/tipomenu/:id - Obter tipo de menu específico
router.get('/:id', protect, async (req, res) => {
  try {
    const tipo = await TipoMenu.findById(req.params.id);
    if (!tipo) {
      return res.status(404).json({ message: 'Tipo de menu não encontrado.' });
    }
    await createLog(req, 'read', 'tipomenu', `Tipo de menu lido: ${req.params.id}`);
    res.status(200).json(tipo);
  } catch (err) {
    console.error('Erro ao obter tipo de menu:', err);
    await createLog(req, 'read-error', 'tipomenu', err.message);
    res.status(500).json({ message: 'Erro ao obter tipo de menu.', error: err.message });
  }
});

export default router;
