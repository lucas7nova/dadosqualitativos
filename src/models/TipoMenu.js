// models/tipomenu.js
import mongoose from 'mongoose';

const tipoMenuSchema = new mongoose.Schema({
  nome: {
    type: String,
    required: [true, 'O nome do tipo é obrigatório.'],
    unique: true,
    trim: true,
  },
  descricao: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('TipoMenu', tipoMenuSchema);
