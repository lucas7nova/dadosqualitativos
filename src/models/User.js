import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'O nome é obrigatório.'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'O e-mail é obrigatório.'],
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: [true, 'A senha é obrigatória.'],
  },
  cpf: {
    type: String,
    required: [true, 'O CPF é obrigatório.'],
    unique: true,
    match: [/^\d{11}$/, 'O CPF deve conter exatamente 11 dígitos.'],
  },
  perfil: {
    type: String,
    enum: ['administrador', 'gestor global', 'gestor local', 'usuário'],
    required: [true, 'O perfil é obrigatório.'],
  },
  cidade: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cidade',
  }],
  endereco: { type: String },
  telefone: { type: String },
  foto: { type: String },
}, {
  timestamps: true,
});

export default mongoose.model('User', userSchema);