// backend/src/routes/auth.routes.js
import express from 'express';
import { register, login, getProfile, getUsers, updateUser, deleteUser } from '../controllers/authController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';
import User from '../models/User.js';
import Log from '../models/Log.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { createLog } from './log.routes.js';
import bcrypt from 'bcryptjs';

// Configuração do transporte de email (opcional)
let transporter = null;

try {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    const nodemailer = await import('nodemailer');
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    transporter.verify((error, success) => {
      if (error) {
        console.error('Erro ao verificar o transporte de email:', error);
        transporter = null;
      } else {
        console.log('Configuração de email verificada com sucesso:', success);
      }
    });
  } else {
    console.log('Aviso: Funcionalidade de recuperação de senha desativada (EMAIL_USER e EMAIL_PASS não estão definidas no .env).');
  }
} catch (error) {
  console.error('Erro ao configurar o transporte de email ou importar dependências:', error);
  console.log('Aviso: Funcionalidade de recuperação de senha desativada.');
  transporter = null;
}

dotenv.config();

const router = express.Router();

// Rotas públicas
router.post('/register', register);
router.post('/login', login);

// Rotas protegidas
router.get('/profile', protect, getProfile);

// Rota para obter o perfil do usuário autenticado
router.get('/me', protect, async (req, res) => {
  try {
    // Popula o campo cidade para retornar os nomes
    const user = await User.findById(req.user._id).populate('cidade', 'nome');
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    console.log('Usuário autenticado:', {
      id: user._id,
      name: user.name,
      email: user.email,
      cpf: user.cpf,
      perfil: user.perfil,
      cidade: user.cidade,
      endereco: user.endereco,
      telefone: user.telefone,
      foto: user.foto,
    });

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        cpf: user.cpf,
        perfil: user.perfil,
        cidade: user.cidade.map(c => ({ _id: c._id, nome: c.nome })) || null,
        endereco: user.endereco || null,
        telefone: user.telefone || null,
        foto: user.foto || null,
      },
    });
  } catch (error) {
    console.error('Erro ao obter usuário:', error.message);
    await createLog(
      req,
      'get-user-error',
      'auth',
      `Erro ao obter usuário: ${error.message}`
    );
    res.status(500).json({
      success: false,
      message: `Erro ao obter usuário: ${error.message}`,
    });
  }
});

// Rota para listar todos os usuários (apenas administrador e gestor global)
router.get('/users', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  try {
    const users = await User.find().populate('cidade', 'nome');
    await createLog(req, 'access', 'usuarios', `${req.user.name} acessou a lista de usuários`);
    res.status(200).json(users);
  } catch (error) {
    await createLog(req, 'access-users-error', 'usuarios', `${req.user.name} - Erro ao listar usuários: ${error.message}`);
    res.status(500).json({ message: 'Erro ao listar usuários.', error: error.message });
  }
});

// Rota para criar usuário por admin/gestor (nova rota)
router.post('/create-user', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  try {
    const { name, email, password, cpf, perfil, cidade, endereco, telefone, foto } = req.body;

    if (req.user.perfil === 'gestor global') {
      if (perfil === 'administrador' || perfil === 'gestor global') {
        await createLog(req, 'create-user-failed', 'usuarios', `${req.user.name} tentou criar usuário com privilégios elevados`);
        return res.status(403).json({ message: 'Não autorizado a criar este perfil.' });
      }
    }

    const cpfExistente = await User.findOne({ cpf });
    if (cpfExistente) {
      await createLog(req, 'create-user-failed', 'usuarios', `${req.user.name} - Outro usuário já possui este CPF: ${cpf}`);
      return res.status(400).json({ message: 'Outro usuário já possui este CPF.' });
    }

    const user = await User.create({
      name,
      email,
      cpf,
      perfil,
      cidade: Array.isArray(cidade) ? cidade : (cidade ? [cidade] : []),
      endereco,
      telefone,
      foto,
      password: await bcrypt.hash(password, 10),
    });

    await createLog(req, 'create', 'usuarios', `${req.user.name} criou o usuário: ${user.name} (CPF: ${user.cpf})`);

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    await createLog(req, 'create-user-error', 'usuarios', `${req.user.name} - Erro ao criar usuário: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Erro ao criar usuário.' });
  }
});

// Rota para atualizar um usuário (apenas administrador e gestor global)
router.put('/users/:id', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  try {
    const { id } = req.params;
    const { cpf, name, email, password, perfil, cidade, endereco, telefone, foto } = req.body;

    if (req.user.perfil === 'gestor global') {
      const targetUser = await User.findById(id);
      if (targetUser.perfil === 'administrador' || targetUser.perfil === 'gestor global') {
        await createLog(req, 'update-user-failed', 'usuarios', `${req.user.name} tentou modificar usuário com privilégios elevados`);
        return res.status(403).json({ message: 'Não autorizado a modificar este perfil.' });
      }
    }

    if (perfil && !['administrador', 'gestor global', 'gestor local', 'usuário'].includes(perfil)) {
      await createLog(req, 'update-user-failed', 'usuarios', `${req.user.name} - Perfil inválido tentado: ${perfil}`);
      return res.status(400).json({ message: 'Perfil do usuário inválido.' });
    }

    const cpfExistente = await User.findOne({ cpf, _id: { $ne: id } });
    if (cpfExistente) {
      await createLog(req, 'update-user-failed', 'usuarios', `${req.user.name} - Outro usuário já possui este CPF: ${cpf}`);
      return res.status(400).json({ message: 'Outro usuário já possui este CPF.' });
    }

    const updateData = {
      name,
      email,
      cpf,
      perfil,
      cidade: Array.isArray(cidade) ? cidade : (cidade ? [cidade] : []),
      endereco,
      telefone,
      foto,
    };

    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await User.findByIdAndUpdate(id, updateData, { new: true, runValidators: true });
    if (!updatedUser) {
      throw new Error('Usuário não encontrado ou não atualizado.');
    }

    await createLog(req, 'update', 'usuarios', `${req.user.name} atualizou o usuário: ${updatedUser.name} (CPF: ${updatedUser.cpf})`);
    res.status(200).json({ success: true, data: updatedUser });
  } catch (error) {
    await createLog(req, 'update-user-error', 'usuarios', `${req.user.name} - Erro ao atualizar usuário: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Erro ao atualizar usuário.' });
  }
});

// Rota para excluir um usuário (apenas administrador e gestor global)
router.delete('/users/:id', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  try {
    const { id } = req.params;
    
    if (req.user.perfil === 'gestor global') {
      const targetUser = await User.findById(id);
      if (targetUser.perfil === 'administrador' || targetUser.perfil === 'gestor global') {
        await createLog(req, 'delete-user-failed', 'usuarios', `${req.user.name} tentou excluir usuário com privilégios elevados`);
        return res.status(403).json({ message: 'Não autorizado a excluir este perfil.' });
      }
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      await createLog(req, 'delete-user-failed', 'usuarios', `${req.user.name} - Usuário não encontrado: ${id}`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    await createLog(req, 'delete', 'usuarios', `${req.user.name} excluiu o usuário: ${deletedUser.name} (CPF: ${deletedUser.cpf})`);
    res.status(200).json({ success: true, message: 'Usuário excluído com sucesso.' });
  } catch (error) {
    await createLog(req, 'delete-user-error', 'usuarios', `${req.user.name} - Erro ao excluir usuário: ${error.message}`);
    res.status(500).json({ success: false, message: error.message || 'Erro ao excluir usuário.' });
  }
});

// Rota administrador (acesso total)
router.get('/administrador', protect, authorize('administrador'), async (req, res) => {
  await createLog(req, 'access-administrador', 'acesso', `${req.user.name} acessou a área administrador`);
  res.json({
    success: true,
    message: 'Acesso administrador concedido',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      perfil: req.user.perfil
    }
  });
});

// Rota gestor global (protegida + autorização)
router.get('/gestor-global', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  await createLog(req, 'access-gestor-global', 'acesso', `${req.user.name} acessou a área de gestor global`);
  res.json({
    success: true,
    message: 'Acesso de gestor global concedido',
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      perfil: req.user.perfil
    }
  });
});

// Rota para gestores locais (protegida + autorização)
router.get('/gestor-local', protect, authorize('administrador', 'gestor global', 'gestor local'), async (req, res) => {
  await createLog(req, 'access-gestor-local', 'acesso', `${req.user.name} acessou a área de gestores locais`);
  res.json({
    success: true,
    message: 'Acesso concedido para gestores locais',
    user: {
      id: req.user._id,
      name: req.user.name,
      perfil: req.user.perfil
    }
  });
});

// Rota para recuperação de senha
router.post('/recover-password', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    await createLog(req, 'recover-password-failed', 'acesso', 'Tentativa de recuperação de senha sem email');
    return res.status(400).json({ message: 'O email é obrigatório.' });
  }

  if (!transporter) {
    await createLog(req, 'recover-password-failed', 'acesso', `Recuperação de senha desativada: ${email}`);
    return res.status(503).json({ message: 'Funcionalidade de recuperação de senha está desativada. Configure as credenciais de email no servidor.' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      await createLog(req, 'recover-password-failed', 'acesso', `Email não encontrado: ${email}`);
      return res.status(404).json({ message: 'Email não encontrado.' });
    }

    const resetToken = jwt.sign(
      { id: user._id, email: user.email, perfil: user.perfil },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    user.resetToken = resetToken;
    user.resetTokenExpires = Date.now() + 3600000;
    await user.save();

    const resetUrl = process.env.NODE_ENV === 'production'
      ? `https://pot-system.lucascoutto.com.br/reset-password?token=${resetToken}`
      : `http://localhost:3000/reset-password?token=${resetToken}`;

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Recuperação de Senha - Sistema POT',
      text: `Clique no link para redefinir sua senha: ${resetUrl}\n\nEste link expirará em 1 hora.`,
      html: `<p>Clique no link para redefinir sua senha: <a href="${resetUrl}">Redefinir Senha</a></p><p>Este link expirará em 1 hora.</p>`,
    });

    await createLog(req, 'recover-password', 'acesso', `Instruções de recuperação de senha enviadas para: ${email}`);
    res.status(200).json({ message: 'Instruções de recuperação enviadas para o seu email.' });
  } catch (error) {
    console.error('Erro ao enviar email de recuperação:', error);
    await createLog(req, 'recover-password-error', 'acesso', `Erro ao enviar email de recuperação para: ${email} - ${error.message}`);
    res.status(500).json({ message: 'Erro ao enviar email de recuperação.' });
  }
});

// Rota para redefinir a senha (apenas administrador e gestor global)
router.post('/reset-password', protect, authorize('administrador', 'gestor global'), async (req, res) => {
  const { userId, password } = req.body;

  if (!userId || !password) {
    await createLog(req, 'reset-password-failed', 'acesso', `${req.user.name} - Tentativa de redefinição de senha sem userId ou password`);
    return res.status(400).json({ message: 'userId e password são obrigatórios.' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      await createLog(req, 'reset-password-failed', 'acesso', `${req.user.name} - Usuário não encontrado: ${userId}`);
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    if (req.user.perfil === 'gestor global' && (user.perfil === 'administrador' || user.perfil === 'gestor global')) {
      await createLog(req, 'reset-password-failed', 'acesso', `${req.user.name} tentou redefinir senha de usuário com privilégios elevados`);
      return res.status(403).json({ message: 'Não autorizado a redefinir senha deste perfil.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    await user.save();

    await createLog(req, 'reset-password', 'acesso', `${req.user.name} redefiniu a senha para o usuário: ${user.email}`);
    res.status(200).json({ message: 'Senha redefinida com sucesso.' });
  } catch (error) {
    console.error('Erro ao redefinir senha:', error);
    await createLog(req, 'reset-password-error', 'acesso', `${req.user.name} - Erro ao redefinir senha para o usuário: ${userId} - ${error.message}`);
    res.status(500).json({ message: 'Erro ao redefinir senha.' });
  }
});

// Rota para renovar token
router.post('/refresh-token', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Token não fornecido.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'sua_chave_secreta', { ignoreExpiration: true });
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado.' });
    }

    const newToken = jwt.sign(
      { id: user._id, email: user.email, perfil: user.perfil, cidade: user.cidade },
      process.env.JWT_SECRET || 'sua_chave_secreta',
      { expiresIn: '1h' }
    );

    await createLog(req, 'refresh-token', 'acesso', `${user.name} renovou o token`);
    res.status(200).json({ token: newToken });
  } catch (error) {
    console.error('Erro ao renovar token:', error);
    await createLog(req, 'refresh-token-error', 'acesso', `Erro ao renovar token: ${error.message}`);
    res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
});

// Rota para criar logs a partir do frontend
router.post('/logs/create', async (req, res) => {
  const { userId, userName, action, module, details } = req.body;

  if (!action || !module || !details) {
    return res.status(400).json({ message: 'action, module e details são obrigatórios.' });
  }

  if (!['create', 'update', 'delete', 'login', 'logout'].includes(action)) {
    return res.status(400).json({ message: `Ação '${action}' não permitida.` });
  }
  if (!['usuarios', 'treinamentos', 'beneficiarios', 'avaliacoes', 'comunicados', 'acesso', 'logs'].includes(module)) {
    return res.status(400).json({ message: `Módulo '${module}' não permitido.` });
  }

  try {
    console.log('Tentando criar log:', { userId, userName, action, module, details });
    await Log.create({
      userId,
      userName: userName || 'Usuário Desconhecido',
      action,
      module,
      details,
      timestamp: new Date(),
    });
    console.log('Log criado com sucesso');
    res.status(201).json({ message: 'Log criado com sucesso.' });
  } catch (error) {
    console.error('Erro ao criar log:', error);
    res.status(500).json({ message: 'Erro ao criar log.', error: error.message });
  }
});

// Montar as rotas de logs
router.use('/logs', (req, res, next) => {
  next();
});

// Rota para atualizar a própria conta
router.put('/me', protect, async (req, res) => {
  try {
    const { name, email, endereco, telefone, cidade } = req.body;
    const updatedUser = await User.findByIdAndUpdate(req.user._id, { name, email, endereco, telefone, cidade }, { new: true });
    await createLog(req, 'update', 'usuarios', `Usuário atualizou sua conta`);
    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: 'Erro ao atualizar conta' });
  }
});

router.post('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    if (!await bcrypt.compare(currentPassword, user.password)) {
      return res.status(400).json({ message: 'Senha atual incorreta' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    await createLog(req, 'update', 'usuarios', `Usuário alterou sua senha`);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao alterar senha' });
  }
});

router.delete('/me', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.user._id);
    await createLog(req, 'delete', 'usuarios', `Usuário excluiu sua conta`);
    res.json({ message: 'Conta excluída com sucesso' });
  } catch (err) {
    res.status(500).json({ message: 'Erro ao excluir conta' });
  }
});

export default router;
