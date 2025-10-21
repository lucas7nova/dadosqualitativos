import mongoose from 'mongoose';

const comunicadoSchema = new mongoose.Schema({
  titulo: { type: String, required: true },
  mensagem: { type: String, required: true },
  corFundo: { type: String, required: true },
  corLetra: { type: String, required: true }, // Novo campo para a cor da letra
  icone: { type: String, required: true },
  data: { type: Date }, // Campo para a data escolhida pelo usuário
  dataCriacao: { type: Date, default: Date.now },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isPublic: { type: Boolean, default: false }, // Mantendo o campo isPublic do ajuste anterior
  cidadeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cidade', required: true } // Novo campo para associar ao cidade
});

const Comunicado = mongoose.model('Comunicado', comunicadoSchema);

export default Comunicado;
