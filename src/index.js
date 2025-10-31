import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import multer from 'multer';
import fs from 'fs';

import authRoutes from './routes/auth.routes.js';
import comunicadosRoutes from './routes/comunicado.routes.js';
import logRoutes from './routes/log.routes.js';
import cidadeRoutes from './routes/cidade.routes.js';
import menuRoutes from './routes/menu.routes.js';
import tipomenuRoutes from './routes/tipomenu.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Configuração de CORS
const allowedOrigins = [
  'http://localhost:3000',
  'https://portal.dadosqualitativos.com.br',
  'https://dadosqualitativos.onrender.com'
];
app.use(cors({
  origin: function (origin, callback) {
    console.log('CORS Origin Recebida:', origin);
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn('CORS Bloqueado para Origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Middlewares
app.use(express.json());

// Configuração de diretório de uploads
const uploadDir = 'uploads/evidencias';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuração do Multer para evidências
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname),
});
const upload = multer({ storage });

// Servir arquivos estáticos de uploads
app.use('/uploads', express.static(path.resolve('Uploads')));

// Rota de saúde do sistema
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true,
    status: 'OK',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// Rotas principais
app.use('/api/auth', authRoutes);
app.use('/api/comunicados', comunicadosRoutes);
app.use('/api/log', logRoutes);
app.use('/api/cidades', cidadeRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/tipomenu', tipomenuRoutes);

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('🔥 Erro:', err.stack);
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Erro interno no servidor';
  
  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

// Conexão com MongoDB
mongoose.connect(process.env.MONGO_URI || process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB conectado com sucesso!');
    app.listen(PORT, () => {
      console.log(`🚀 Servidor rodando na porta ${PORT}`);
      console.log(`🔗 Ambiente: ${process.env.NODE_ENV || 'development'}`);
    });
  })
  .catch(err => {
    console.error('❌ Erro ao conectar no MongoDB:', err.message);
    process.exit(1);
  });
  
