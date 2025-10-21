// models/menu.js
import mongoose from 'mongoose';

const menuSchema = new mongoose.Schema({
  cidade: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cidade',
    required: [true, 'A cidade é obrigatória.'],
  },
  tipo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TipoMenu',
    required: [true, 'O tipo é obrigatório.'],
  },
  item: {
    type: String,
    required: [true, 'O nome do item é obrigatório.'],
    trim: true,
  },
  titulo: {
    type: String,
    trim: true,
  },
  texto: {
    type: String,
    trim: true,
  },
  link: {
    type: String,
    required: [true, 'O link é obrigatório.'],
    trim: true,
  },
}, {
  timestamps: true,
});

export default mongoose.model('Menu', menuSchema);
