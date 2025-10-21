import mongoose from 'mongoose';

const cidadeSchema = new mongoose.Schema({
  nome: { type: String, required: true, unique: true },
  descricao: { type: String },
}, {
  timestamps: true
});

const Cidade = mongoose.model('Cidade', cidadeSchema);

export default Cidade;
