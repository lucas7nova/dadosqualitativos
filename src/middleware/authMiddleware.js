import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Log from '../models/Log.js';
import dotenv from 'dotenv';

dotenv.config();

// Função auxiliar para registrar logs
const createLog = async (userId, userName, action, module, details = '') => {
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

export const protect = async (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      console.error('JWT_SECRET não configurado');
      await createLog(
        null,
        'Desconhecido',
        'auth-error',
        'acesso',
        'JWT_SECRET não configurado no servidor'
      );
      return res.status(500).json({ 
        success: false,
        message: 'Erro de configuração do servidor' 
      });
    }

    let token;
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      await createLog(
        null,
        'Desconhecido',
        'auth-failed',
        'acesso',
        'Tentativa de acesso sem token'
      );
      return res.status(401).json({ 
        success: false,
        message: 'Não autorizado: Token não fornecido' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);
    const user = await User.findById(decoded.id).select('-password');

    if (!user) {
      await createLog(
        null,
        'Desconhecido',
        'auth-failed',
        'acesso',
        `Usuário não encontrado para token: ${decoded.id}`
      );
      return res.status(401).json({ 
        success: false,
        message: 'Usuário não encontrado' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Erro no middleware de proteção:', error);
    
    let message = 'Erro na autenticação';
    let action = 'auth-error';
    if (error.name === 'TokenExpiredError') {
      message = 'Sessão expirada';
      action = 'auth-expired';
    } else if (error.name === 'JsonWebTokenError') {
      message = 'Token inválido';
      action = 'auth-invalid';
    }

    await createLog(
      null,
      'Desconhecido',
      action,
      'acesso',
      `Erro na autenticação: ${error.message}`
    );

    res.status(401).json({ 
      success: false,
      message
    });
  }
};

export const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      await createLog(
        null,
        'Desconhecido',
        'auth-failed',
        'acesso',
        'Tentativa de acesso sem usuário autenticado'
      );
      return res.status(401).json({ 
        success: false,
        message: 'Usuário não autenticado' 
      });
    }

    if (!allowedRoles.includes(req.user.perfil)) {
      await createLog(
        req.user.id,
        req.user.name,
        'auth-denied',
        'acesso',
        `Acesso negado para perfil: ${req.user.perfil}`
      );
      return res.status(403).json({ 
        success: false,
        message: `Acesso negado. Requer perfil: ${allowedRoles.join(', ')}` 
      });
    }

    next();
  };
};
