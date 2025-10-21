import User from '../models/User.js';
import Log from '../models/Log.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const generateToken = (user) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET não está definido no .env');
  }

  return jwt.sign(
    { id: user._id, perfil: user.perfil, cidade: user.cidade || [] },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
  );
};

// Função auxiliar para registrar logs
const createLog = async (userId, userName, action, module, details = '') => {
  if (action.includes('list-')) {
    return;
  }
  
  try {
    await Log.create({
      userId,
      userName,
      action,
      module,
      details,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Erro ao registrar log:', error);
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, cpf, perfil, cidade } = req.body;

    if (!name || !email || !password || !cpf || !perfil) {
      return res.status(400).json({ 
        success: false,
        message: 'Todos os campos são obrigatórios' 
      });
    }

    const normalizedCpf = cpf.replace(/[^\d]/g, '');
    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({ 
      $or: [
        { email: normalizedEmail }, 
        { cpf: normalizedCpf }
      ] 
    });
    if (userExists) {
      return res.status(400).json({ 
        success: false,
        message: 'Usuário já existe',
        conflicts: {
          email: userExists.email === normalizedEmail,
          cpf: userExists.cpf === normalizedCpf
        }
      });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password: bcrypt.hashSync(password, 10),
      cpf: normalizedCpf,
      perfil,
      cidade: Array.isArray(cidade) ? cidade : (cidade ? [cidade] : [])
    });

    await createLog(
      user._id,
      user.name,
      'create',
      'usuarios',
      `Novo usuário criado: ${user.email}`
    );

    res.status(201).json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        perfil: user.perfil,
        cidade: user.cidade
      },
      token: generateToken(user)
    });

  } catch (error) {
    console.error('Erro no registro:', error);
    res.status(500).json({ 
      success: false,
      message: 'Erro ao registrar usuário',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const login = async (req, res) => {
  try {
    const { login: identifier, password } = req.body;

    if (!identifier || !password) {
      console.log('Dados de login incompletos:', { identifier, password });
      await createLog(
        null,
        'Desconhecido',
        'login-failed',
        'acesso',
        `Tentativa de login com dados incompletos: ${identifier || 'sem identificador'}`
      );
      return res.status(400).json({ 
        success: false,
        message: 'CPF/e-mail e senha são obrigatórios' 
      });
    }

    const isEmail = /\S+@\S+\.\S+/.test(identifier);
    const normalizedIdentifier = isEmail 
      ? identifier.trim().toLowerCase()
      : identifier.replace(/[^\d]/g, '');

    console.log('Buscando usuário com identificador normalizado:', normalizedIdentifier);

    const user = await User.findOne({
      $or: [
        { email: normalizedIdentifier },
        { cpf: normalizedIdentifier }
      ]
    });

    if (!user) {
      console.log('Usuário não encontrado para:', normalizedIdentifier);
      const allUsers = await User.find().select('email cpf');
      console.log('Usuários existentes no banco:', allUsers);
      await createLog(
        null,
        'Desconhecido',
        'login-failed',
        'acesso',
        `Usuário não encontrado: ${normalizedIdentifier}`
      );
      return res.status(401).json({ 
        success: false,
        message: 'Usuário não encontrado' 
      });
    }

    console.log('Usuário encontrado:', { email: user.email, cpf: user.cpf, perfil: user.perfil });

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      console.log('Senha inválida para:', user.email);
      await createLog(
        user._id,
        user.name,
        'login-failed',
        'acesso',
        `Senha incorreta para: ${user.email}`
      );
      return res.status(401).json({ 
        success: false,
        message: 'Senha incorreta' 
      });
    }

    const validPerfis = ['administrador', 'gestor global', 'gestor local', 'usuário'];
    if (!validPerfis.includes(user.perfil)) {
      console.log('Perfil inválido para:', user.email, user.perfil);
      await createLog(
        user._id,
        user.name,
        'login-failed',
        'acesso',
        `Perfil inválido: ${user.perfil} (${user.email})`
      );
      return res.status(400).json({ 
        success: false,
        message: 'Perfil do usuário inválido' 
      });
    }

    await createLog(
      user._id,
      user.name,
      'login',
      'acesso',
      `Login bem-sucedido: ${user.email}`
    );

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        perfil: user.perfil,
        cidade: user.cidade || []
      },
      token: generateToken(user)
    });

  } catch (error) {
    console.error('Erro no login:', error);
    await createLog(
      null,
      'Desconhecido',
      'login-error',
      'acesso',
      `Erro ao fazer login: ${error.message}`
    );
    res.status(500).json({ 
      success: false,
      message: 'Erro ao fazer login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('-password -__v -createdAt -updatedAt');
      
    if (!user) {
      await createLog(
        req.user.id,
        req.user.name,
        'get-profile-failed',
        'usuarios',
        `Usuário não encontrado: ${req.user.id}`
      );
      return res.status(404).json({ 
        success: false,
        message: 'Usuário não encontrado' 
      });
    }

    await createLog(
      req.user.id,
      req.user.name,
      'get-profile',
      'usuarios',
      `Perfil acessado: ${user.email}`
    );

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Erro ao buscar perfil:', error);
    await createLog(
      req.user.id,
      req.user.name,
      'get-profile-error',
      'usuarios',
      `Erro ao buscar perfil: ${error.message}`
    );
    res.status(500).json({ 
      success: false,
      message: 'Erro ao buscar perfil',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password -__v');

    await createLog(
      req.user.id,
      req.user.name,
      'list-users',
      'usuarios',
      `Listagem de usuários realizada`
    );

    res.status(200).json(users);
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    await createLog(
      req.user.id,
      req.user.name,
      'list-users-error',
      'usuarios',
      `Erro ao listar usuários: ${error.message}`
    );
    res.status(500).json({
      success: false,
      message: 'Erro ao listar usuários',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateUser = async (req) => {
  try {
    const { id } = req.params;
    const { name, email, cpf, perfil, cidade } = req.body;

    if (!name || !email || !cpf || !perfil) {
      await createLog(
        req.user.id,
        req.user.name,
        'update-user-failed',
        'usuarios',
        `Dados incompletos para atualização do usuário: ${id}`
      );
      throw new Error('Todos os campos são obrigatórios');
    }

    const normalizedCpf = cpf.replace(/[^\d]/g, '');
    const normalizedEmail = email.trim().toLowerCase();

    const userExists = await User.findOne({
      $or: [{ email: normalizedEmail }, { cpf: normalizedCpf }],
      _id: { $ne: id },
    });

    if (userExists) {
      await createLog(
        req.user.id,
        req.user.name,
        'update-user-failed',
        'usuarios',
        `Conflito de email/CPF ao atualizar usuário: ${id}`
      );
      throw new Error('Email ou CPF já está em uso por outro usuário');
    }

    const user = await User.findByIdAndUpdate(
      id,
      { name, email: normalizedEmail, cpf: normalizedCpf, perfil, cidade: Array.isArray(cidade) ? cidade : (cidade ? [cidade] : []) },
      { new: true, runValidators: true }
    ).select('-password -__v');

    if (!user) {
      await createLog(
        req.user.id,
        req.user.name,
        'update-user-failed',
        'usuarios',
        `Usuário não encontrado para atualização: ${id}`
      );
      throw new Error('Usuário não encontrado');
    }

    await createLog(
      req.user.id,
      req.user.name,
      'update',
      'usuarios',
      `Usuário atualizado: ${user.name} (${user.email})`
    );

    return user;
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    await createLog(
      req.user.id,
      req.user.name,
      'update-user-error',
      'usuarios',
      `Erro ao atualizar usuário: ${error.message}`
    );
    throw error;
  }
};

export const deleteUser = async (req) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      await createLog(
        req.user.id,
        req.user.name,
        'delete-user-failed',
        'usuarios',
        `Usuário não encontrado para exclusão: ${id}`
      );
      throw new Error('Usuário não encontrado');
    }

    await createLog(
      req.user.id,
      req.user.name,
      'delete',
      'usuarios',
      `Usuário excluído: ${user.email}`
    );

    return user;
  } catch (error) {
    console.error('Erro ao excluir usuário:', error);
    await createLog(
      req.user.id,
      req.user.name,
      'delete-user-error',
      'usuarios',
      `Erro ao excluir usuário: ${error.message}`
    );
    throw error;
  }
};

export const getLogs = async (req, res) => {
  try {
    const { page = 1, limit = 10, date, user, action, module } = req.query;

    const query = {};
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.timestamp = { $gte: startOfDay, $lte: endOfDay };
    }
    if (user) query.userName = { $regex: user, $options: 'i' };
    if (action) query.action = action;
    if (module) query.module = module;

    const logs = await Log.find(query)
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Log.countDocuments(query);

    const log = await Log.create({
      userId: req.user._id,
      userName: req.user.name,
      action: 'list-logs',
      module: 'acesso',
      details: `Usuário ${req.user.name} listou os logs`,
      timestamp: new Date(),
    });
    console.log('Log de listagem criado:', { _id: log._id, userName: log.userName });

    res.status(200).json({ logs, total });
  } catch (err) {
    console.error('Erro ao listar logs:', err);

    await Log.create({
      userId: req.user._id,
      userName: req.user.name,
      action: 'list-logs-error',
      module: 'acesso',
      details: `Erro ao listar logs: ${err.message}`,
      timestamp: new Date(),
    });

    res.status(500).json({ message: 'Erro ao listar logs.', error: err.message });
  }
};