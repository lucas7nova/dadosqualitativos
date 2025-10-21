import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Log from '../src/models/Log.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        await Log.create({
          userId: decoded.id || null,
          userName: 'Usuário não encontrado',
          email: 'Desconhecido',
          action: 'login-failed',
          module: 'acesso',
          details: 'Token válido mas usuário não existe no banco de dados'
        });
        return res.status(401).json({ message: 'Usuário não encontrado' });
      }

      req.user = {
        _id: user._id,
        name: user.name,
        email: user.email,
        perfil: user.perfil,
        department: user.department || null
      };

      next();
    } catch (error) {
      console.error('Erro na autenticação:', error);
      try {
        await Log.create({
          userId: null,
          userName: 'Token inválido',
          email: 'Desconhecido',
          action: 'login-failed',
          module: 'acesso',
          details: `Tentativa de acesso com token inválido: ${error.message}`
        });
      } catch (logError) {
        console.error('Falha ao registrar log de acesso inválido:', logError);
      }
      let errorMessage = 'Não autorizado, token inválido';
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Sessão expirada, faça login novamente';
      }
      res.status(401).json({ message: errorMessage });
    }
  } else {
    try {
      await Log.create({
        userId: null,
        userName: 'Não autenticado',
        email: 'Desconhecido',
        action: 'login-failed',
        module: 'acesso',
        details: 'Tentativa de acesso sem token de autenticação'
      });
    } catch (logError) {
      console.error('Falha ao registrar log de acesso não autenticado:', logError);
    }
    res.status(401).json({ message: 'Não autorizado, token não fornecido' });
  }
};

export const logAction = (action, module) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await Log.create({
          userId: req.user._id,
          userName: req.user.name,
          email: req.user.email,
          action,
          module,
          entityName: req.body.nomeEvento || req.body.name || null,
          entityDate: req.body.dataRealizacao || req.body.date || null,
          details: `${req.user.name} (${req.user.email}) realizou ${action} em ${module}`
        });
      }
      next();
    } catch (error) {
      console.error('Falha ao registrar ação:', error);
      next();
    }
  };
};