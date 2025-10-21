import express from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Comunicado from '../models/Comunicado.js';
import { createLog } from './log.routes.js';

const router = express.Router({ mergeParams: true });

// Middleware para verificar autenticação e buscar o nome, cidade e perfil do usuário
const authenticate = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  console.log('Token recebido:', token);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Token não fornecido' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta');
    console.log('Token decodificado:', decoded);

    const user = await User.findById(decoded.id).select('name cidadeId perfil');
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado no banco de dados' });
    }

    req.user = {
      id: decoded.id,
      name: user.name || 'Usuário Desconhecido',
      cidadeId: user.cidadeId || null,
      perfil: user.perfil || 'user', // Adicionando o perfil do usuário
    };
    console.log('Usuário autenticado:', req.user);
    next();
  } catch (error) {
    console.log('Erro ao verificar token:', error.message);
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

// Rota para listar todos os comunicados (filtrados por perfil do usuário)
router.get('/', authenticate, async (req, res) => {
  try {
    console.log('Listando todos os comunicados para usuário:', req.user.id);
    let comunicadosQuery = {};

    // Se o usuário é master, retornar todos os comunicados
    if (req.user.perfil === 'master') {
      comunicadosQuery = {}; // Sem filtros, retorna todos
    } else if (req.user.cidadeId) {
      // Para usuários com cidadeId, filtrar por cidade e comunicados públicos
      comunicadosQuery = { $or: [
        { cidadeId: req.user.cidadeId },
        { isPublic: true }
      ]};
    } else {
      // Para outros usuários sem cidadeId, retornar comunicados que eles criaram ou são públicos
      comunicadosQuery = { $or: [
        { createdBy: req.user.id },
        { isPublic: true }
      ]};
    }

    const comunicados = await Comunicado.find(comunicadosQuery).sort({ dataCriacao: -1 });
    const comunicadosWithStringIds = comunicados.map(comunicado => ({
      ...comunicado.toObject(),
      id: comunicado._id.toString(),
      createdBy: comunicado.createdBy.toString(),
    }));
    console.log('Comunicados retornados:', comunicadosWithStringIds);
    res.json({ success: true, data: comunicadosWithStringIds });
  } catch (error) {
    console.error('Erro ao listar comunicados:', error);
    await createLog(req, 'list-comunicados-error', 'comunicados', `${req.user.name} - Erro ao listar comunicados: ${error.message}`);
    res.status(500).json({ success: false, message: 'Erro ao listar comunicados', error: error.message });
  }
});

// Rota para buscar um comunicado por ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Buscando comunicado com ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await createLog(req, 'get-comunicado-failed', 'comunicados', `${req.user.name} - ID de comunicado inválido: ${id}`);
      return res.status(400).json({ success: false, message: `ID de comunicado inválido: ${id}` });
    }

    const comunicado = await Comunicado.findOne({ _id: id, $or: [
      { cidadeId: req.user.cidadeId },
      { isPublic: true }
    ]});
    if (!comunicado && req.user.perfil !== 'master') {
      await createLog(req, 'get-comunicado-failed', 'comunicados', `${req.user.name} - Comunicado não encontrado ou sem permissão: ${id}`);
      return res.status(404).json({ success: false, message: 'Comunicado não encontrado ou sem permissão' });
    }

    // Para master, permitir acesso mesmo sem match de cidadeId ou isPublic
    if (req.user.perfil === 'master') {
      const comunicadoMaster = await Comunicado.findById(id);
      if (!comunicadoMaster) {
        return res.status(404).json({ success: false, message: 'Comunicado não encontrado' });
      }
      const comunicadoResponse = {
        ...comunicadoMaster.toObject(),
        id: comunicadoMaster._id.toString(),
        createdBy: comunicadoMaster.createdBy.toString(),
      };
      console.log('Comunicado retornado para master:', comunicadoResponse);
      return res.json({ success: true, data: comunicadoResponse });
    }

    const comunicadoResponse = {
      ...comunicado.toObject(),
      id: comunicado._id.toString(),
      createdBy: comunicado.createdBy.toString(),
    };
    console.log('Comunicado retornado:', comunicadoResponse);
    res.json({ success: true, data: comunicadoResponse });
  } catch (error) {
    console.error('Erro ao buscar comunicado:', error);
    await createLog(req, 'get-comunicado-error', 'comunicados', `${req.user.name} - Erro ao buscar comunicado: ${error.message}`);
    res.status(500).json({ success: false, message: 'Erro ao buscar comunicado', error: error.message });
  }
});

// Rota para criar um novo comunicado
router.post('/', authenticate, async (req, res) => {
  try {
    console.log('Requisição recebida para criar comunicado:', req.body);
    console.log('Usuário autenticado:', req.user);

    const { titulo, mensagem, corFundo, corLetra, icone, isPublic, cidadeId } = req.body;

    // Validação dos campos obrigatórios
    if (!titulo || !mensagem || !corFundo || !corLetra || !icone || !cidadeId) {
      await createLog(req, 'create-comunicados-failed', 'comunicados', `${req.user.name} - Tentativa de criar comunicado sem campos obrigatórios`);
      return res.status(400).json({ success: false, message: 'Todos os campos são obrigatórios' });
    }

    // Verificar se o cidadeId é válido
    let cidadeIdObj;
    try {
      cidadeIdObj = new mongoose.Types.ObjectId(cidadeId);
      // Verificar se o cidadeId existe no banco (opcional, depende do modelo Cidade)
      // const cidadeExists = await Cidade.findById(cidadeIdObj);
      // if (!cidadeExists) throw new Error('Cidade não encontrada');
    } catch (error) {
      await createLog(req, 'create-comunicados-failed', 'comunicados', `${req.user.name} - cidadeId inválido: ${cidadeId}`);
      return res.status(400).json({ success: false, message: 'cidadeId inválido' });
    }

    if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
      await createLog(req, 'create-comunicados-failed', 'comunicados', `${req.user.name} - ID de usuário inválido: ${req.user.id}`);
      return res.status(400).json({ success: false, message: 'ID de usuário inválido' });
    }
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const user = await User.findById(userId);
    if (!user) {
      await createLog(req, 'create-comunicados-failed', 'comunicados', `${req.user.name} - Usuário não encontrado: ${userId}`);
      return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
    }

    // Usar o cidadeId do usuário como fallback se o enviado for inválido ou não especificado
    const finalCidadeId = cidadeIdObj || req.user.cidadeId;

    const novoComunicado = new Comunicado({
      titulo,
      mensagem,
      corFundo,
      corLetra,
      icone,
      createdBy: userId,
      isPublic: isPublic || false,
      cidadeId: finalCidadeId,
    });

    const savedComunicado = await novoComunicado.save();
    const comunicadoResponse = {
      ...savedComunicado.toObject(),
      id: savedComunicado._id.toString(),
      createdBy: savedComunicado.createdBy.toString(),
    };
    console.log('Comunicado salvo:', comunicadoResponse);
    await createLog(req, 'create-comunicados', 'comunicados', `${req.user.name} criou comunicado: ${titulo}`);
    res.status(201).json({ success: true, data: comunicadoResponse });
  } catch (error) {
    console.error('Erro ao salvar comunicado:', error);
    await createLog(req, 'create-comunicados-error', 'comunicados', `${req.user.name} - Erro ao criar comunicado: ${error.message}`);
    res.status(500).json({ success: false, message: 'Erro ao criar comunicado', error: error.message });
  }
});

// Rota para atualizar um comunicado por ID
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Tentando atualizar comunicado com ID:', id);
    const { titulo, mensagem, corFundo, corLetra, icone, isPublic, cidadeId } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await createLog(req, 'update-comunicados-failed', 'comunicados', `${req.user.name} - ID de comunicado inválido: ${id}`);
      return res.status(400).json({ success: false, message: `ID de comunicado inválido: ${id}` });
    }

    const comunicado = await Comunicado.findById(id);
    if (!comunicado) {
      await createLog(req, 'update-comunicados-failed', 'comunicados', `${req.user.name} - Comunicado não encontrado: ${id}`);
      return res.status(404).json({ success: false, message: 'Comunicado não encontrado' });
    }

    if (comunicado.createdBy.toString() !== req.user.id && req.user.perfil !== 'master') {
      await createLog(req, 'update-comunicados-failed', 'comunicados', `${req.user.name} - Acesso negado para atualizar comunicado: ${id}`);
      return res.status(403).json({ success: false, message: 'Acesso negado: Você não tem permissão para atualizar este comunicado' });
    }

    let cidadeIdObj = cidadeId;
    if (cidadeId) {
      try {
        cidadeIdObj = new mongoose.Types.ObjectId(cidadeId);
      } catch (error) {
        await createLog(req, 'update-comunicados-failed', 'comunicados', `${req.user.name} - cidadeId inválido: ${cidadeId}`);
        return res.status(400).json({ success: false, message: 'cidadeId inválido' });
      }
    }

    const updateData = {
      titulo: titulo || comunicado.titulo,
      mensagem: mensagem || comunicado.mensagem,
      corFundo: corFundo || comunicado.corFundo,
      corLetra: corLetra || comunicado.corLetra,
      icone: icone || comunicado.icone,
      isPublic: isPublic !== undefined ? isPublic : comunicado.isPublic,
      cidadeId: cidadeIdObj || comunicado.cidadeId,
    };

    const updatedComunicado = await Comunicado.findByIdAndUpdate(id, updateData, { new: true });
    const comunicadoResponse = {
      ...updatedComunicado.toObject(),
      id: updatedComunicado._id.toString(),
      createdBy: updatedComunicado.createdBy.toString(),
    };
    console.log('Comunicado atualizado:', comunicadoResponse);
    await createLog(req, 'update-comunicados', 'comunicados', `${req.user.name} atualizou comunicado: ${titulo || updatedComunicado.titulo}`);
    res.json({ success: true, message: 'Comunicado atualizado com sucesso', data: comunicadoResponse });
  } catch (error) {
    console.error('Erro ao atualizar comunicado:', error);
    await createLog(req, 'update-comunicados-error', 'comunicados', `${req.user.name} - Erro ao atualizar comunicado: ${error.message}`);
    res.status(500).json({ success: false, message: 'Erro ao atualizar comunicado', error: error.message });
  }
});

// Rota para excluir um comunicado
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Tentando excluir comunicado com ID:', id);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      await createLog(req, 'delete-comunicados-failed', 'comunicados', `${req.user.name} - ID de comunicado inválido: ${id}`);
      return res.status(400).json({ success: false, message: `ID de comunicado inválido: ${id}` });
    }

    const comunicado = await Comunicado.findById(id);
    if (!comunicado) {
      await createLog(req, 'delete-comunicados-failed', 'comunicados', `${req.user.name} - Comunicado não encontrado: ${id}`);
      return res.status(404).json({ success: false, message: 'Comunicado não encontrado' });
    }

    if (comunicado.createdBy.toString() !== req.user.id && req.user.perfil !== 'master') {
      await createLog(req, 'delete-comunicados-failed', 'comunicados', `${req.user.name} - Acesso negado para excluir comunicado: ${id}`);
      return res.status(403).json({ success: false, message: 'Acesso negado: Você não tem permissão para excluir este comunicado' });
    }

    await Comunicado.deleteOne({ _id: id });
    console.log('Comunicado excluído com sucesso, ID:', id);
    await createLog(req, 'delete-comunicados', 'comunicados', `${req.user.name} excluiu comunicado: ID ${id}`);
    res.json({ success: true, message: 'Comunicado excluído com sucesso' });
  } catch (error) {
    console.error('Erro ao excluir comunicado:', error);
    await createLog(req, 'delete-comunicados-error', 'comunicados', `${req.user.name} - Erro ao excluir comunicado: ${error.message}`);
    res.status(500).json({ success: false, message: 'Erro ao excluir comunicado', error: error.message });
  }
});

export default router;
