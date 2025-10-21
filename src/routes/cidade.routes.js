import express from 'express';
import Cidade from '../models/Cidade.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import Log from '../models/Log.js';
import mongoose from 'mongoose';

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

// Rota pública para listar cidades
router.get('/public', async (req, res) => {
  console.log('GET /api/cidades/public - Consultando cidades (pública)...');
  try {
    const cidades = await Cidade.find({});
    console.log('Cidades retornadas:', cidades);
    res.status(200).json(cidades);
  } catch (err) {
    console.error('Erro ao consultar cidades:', err);
    res.status(500).json({ message: 'Erro ao consultar cidades.', error: err.message });
  }
});

// Rota protegida original
router.get('/', protect, async (req, res) => {
  console.log('GET /api/cidades - Consultando cidades...');
  console.log('Usuário:', {
    perfil: req.user.perfil,
    cidade: req.user.cidade,
    cidadeLength: req.user.cidade ? req.user.cidade.length : 0,
  });

  try {
    let query = {};

    if (req.user.perfil !== 'administrador' && req.user.cidade && req.user.cidade.length > 0) {
      try {
        query._id = { $in: req.user.cidade.map(id => new mongoose.Types.ObjectId(id)) };
        console.log('Filtro aplicado para usuário não administrador:', query);
      } catch (e) {
        console.error('Erro ao converter IDs de cidade:', e);
        return res.status(500).json({ message: 'Erro ao processar IDs de cidade.', error: e.message });
      }
    } else {
      console.log('Filtro aplicado para administrador: nenhum filtro');
    }

    const cidades = await Cidade.find(query).sort({ nome: 1 });
    console.log('Cidades retornadas:', cidades);
    await createLog(req, 'read', 'cidades', `Listagem de cidades realizada`);

    res.status(200).json(cidades);
  } catch (err) {
    console.error('Erro ao consultar cidades:', err);
    await createLog(req, 'read-error', 'cidades', err.message);
    res.status(500).json({ message: 'Erro ao consultar cidades.', error: err.message });
  }
});

// POST /api/cidades - Criar nova cidade
router.post('/', protect, authorize('administrador'), async (req, res) => {
  console.log('POST /api/cidades - Criando nova cidade...');
  console.log('Dados recebidos:', req.body);

  try {
    const { nome, descricao } = req.body;
    if (!nome) {
      await createLog(req, 'create-failed', 'cidades', 'Nome da cidade é obrigatório.');
      return res.status(400).json({ message: 'O nome da cidade é obrigatório.' });
    }

    const cidade = new Cidade({ nome: nome.trim(), descricao: descricao ? descricao.trim() : '' });
    await cidade.save();

    await createLog(req, 'create', 'cidades', `Nova cidade criada: ${nome}`);
    res.status(201).json({ message: 'Cidade criada com sucesso!', cidade });
  } catch (err) {
    console.error('Erro ao criar cidade:', err);
    await createLog(req, 'create-error', 'cidades', err.message);
    res.status(500).json({ message: 'Erro ao criar cidade.', error: err.message });
  }
});

// PUT /api/cidades/:id - Atualizar cidade
router.put('/:id', protect, authorize('administrador'), async (req, res) => {
  console.log('PUT /api/cidades/:id - Atualizando cidade...');
  console.log('ID:', req.params.id);
  console.log('Dados recebidos:', req.body);

  try {
    const { nome, descricao } = req.body;
    if (!nome) {
      await createLog(req, 'update-failed', 'cidades', 'Nome da cidade é obrigatório.');
      return res.status(400).json({ message: 'O nome da cidade é obrigatório.' });
    }

    const updatedCidade = await Cidade.findByIdAndUpdate(
      req.params.id,
      { nome: nome.trim(), descricao: descricao ? descricao.trim() : '' },
      { new: true, runValidators: true }
    );

    if (!updatedCidade) {
      await createLog(req, 'update-failed', 'cidades', `Cidade não encontrada: ${req.params.id}`);
      return res.status(404).json({ message: 'Cidade não encontrada.' });
    }

    await createLog(req, 'update', 'cidades', `Cidade atualizada: ${nome}`);
    res.status(200).json({ message: 'Cidade atualizada com sucesso!', cidade: updatedCidade });
  } catch (err) {
    console.error('Erro ao atualizar cidade:', err);
    await createLog(req, 'update-error', 'cidades', err.message);
    res.status(500).json({ message: 'Erro ao atualizar cidade.', error: err.message });
  }
});

// DELETE /api/cidades/:id - Excluir cidade
router.delete('/:id', protect, authorize('administrador'), async (req, res) => {
  console.log('DELETE /api/cidades/:id - Excluindo cidade...');
  console.log('ID:', req.params.id);

  try {
    const deletedCidade = await Cidade.findByIdAndDelete(req.params.id);

    if (!deletedCidade) {
      await createLog(req, 'delete-failed', 'cidades', `Cidade não encontrada: ${req.params.id}`);
      return res.status(404).json({ message: 'Cidade não encontrada.' });
    }

    await createLog(req, 'delete', 'cidades', `Cidade excluída: ${deletedCidade.nome}`);
    res.status(200).json({ message: 'Cidade excluída com sucesso!' });
  } catch (err) {
    console.error('Erro ao excluir cidade:', err);
    await createLog(req, 'delete-error', 'cidades', err.message);
    res.status(500).json({ message: 'Erro ao excluir cidade.', error: err.message });
  }
});

export default router;
