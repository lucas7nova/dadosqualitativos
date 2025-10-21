// index.js
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer'; // Importa o multer

import authRoutes from './routes/auth.routes.js';
import beneficiarioRoutes from './routes/beneficiario.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração do multer para o diretório de uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/fotos/'); // Ajuste para o diretório 'fotos'
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Gera um nome único para cada arquivo
  },
});

const upload = multer({ storage: storage });

// Middlewares
app.use(cors());
app.use(express.json());

// Servir arquivos da pasta uploads
app.use('/uploads', express.static('uploads'));

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/beneficiarios', beneficiarioRoutes);

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('MongoDB conectado com sucesso!');
  app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
})
.catch((err) => console.error('Erro ao conectar no MongoDB:', err));
