import mongoose from 'mongoose';

const logSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: false },
  userName: { type: String, required: false, default: 'Usuário Desconhecido' },
  action: {
    type: String,
    required: true,
    enum: [
      // Ações gerais
      'create', 'update', 'delete', 'login', 'logout', 'login-failed', 'login-error', 'error',
      'read-folha-error', 'read-dadosbancarios-failed', 'read-dadosbancarios-error',
      'read-pagamentos-failed', 'read-pagamentos-error',

      // Ações de usuário
      'get-profile', 'get-profile-failed', 'get-profile-error',
      'update-user', 'update-user-failed', 'update-user-error',
      'delete-user', 'delete-user-failed', 'delete-user-error',

      // Ações de beneficiários
      'create-beneficiario', 'create-beneficiario-failed', 'create-beneficiario-error',
      'update-beneficiario', 'update-beneficiario-failed', 'update-beneficiario-error',
      'delete-beneficiario', 'delete-beneficiario-failed', 'delete-beneficiario-error',

      // Ações de treinamentos
      'create-training', 'create-training-failed', 'create-training-error',
      'update-training', 'update-training-failed', 'update-training-error',
      'delete-training', 'delete-training-failed', 'delete-training-error',
      'upload-evidence', 'upload-evidence-failed', 'upload-evidence-error',
      'delete-evidence', 'delete-evidence-failed', 'delete-evidence-error',

      // Ações de avaliações
      'create-avaliacoes', 'create-avaliacoes-failed', 'create-avaliacoes-error',
      'update-avaliacoes', 'update-avaliacoes-failed', 'update-avaliacoes-error',

      // Ações de comunicados
      'create-comunicados', 'create-comunicados-failed', 'create-comunicados-error',
      'update-comunicados', 'update-comunicados-failed', 'update-comunicados-error',
      'delete-comunicados', 'delete-comunicados-failed', 'delete-comunicados-error',

      // Ações de dados bancários
      'create-dadosbancarios', 'create-dadosbancarios-failed', 'create-dadosbancarios-error',
      'update-dadosbancarios', 'update-dadosbancarios-failed', 'update-dadosbancarios-error',
      'delete-dadosbancarios', 'delete-dadosbancarios-failed', 'delete-dadosbancarios-error',

      // Ações de pagamentos
      'create-pagamento', 'create-pagamento-failed', 'create-pagamento-error',
      'update-pagamento', 'update-pagamento-failed', 'update-pagamento-error',

      // Ações de folha de pagamento
      'create-folha', 'create-folha-failed', 'create-folha-error',
      'update-folha', 'update-folha-failed', 'update-folha-error',

      // Ações de frequência
      'create-frequencia', 'create-frequencia-failed', 'create-frequencia-error',
      'update-frequencia', 'update-frequencia-failed', 'update-frequencia-error',
      'delete-frequencia', 'delete-frequencia-failed', 'delete-frequencia-error',
      'list-frequencia', 'list-frequencia-failed', 'list-frequencia-error',
    ],
  },
  module: {
    type: String,
    required: true,
    enum: [
      'usuarios',
      'treinamentos',
      'beneficiarios',
      'avaliacoes',
      'comunicados',
      'acesso',
      'logs',
      'dadosbancarios',
      'pagamentos',
      'folha',
      'frequencia',
      'menu',       // Novo: para menu.routes.js
      'tipomenu',   // Novo: para tipomenu.routes.js
      'cidades',    // Novo: para cidade.routes.js
      'auth',       // Novo: para auth.routes.js (autenticação)
    ],
  },
  details: { type: String },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

const Log = mongoose.model('Log', logSchema);
export default Log;