import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import dotenv from 'dotenv';
import YAML from 'yamljs';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import os from 'os'; // Import os module for dynamic IP detection
import quartosRoutes from './routes/quartosRoutes.js';
import clientesRoutes from './routes/clientesRoutes.js';
import reservasRoutes from './routes/reservasRoutes.js';
import payFlowRoutes from './routes/payFlowRoute.js';
import { sql } from './config/db.js';

// Load environment variables
dotenv.config();

// Get the local IP address dynamically
const getLocalIP = () => {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost'; // Fallback to localhost if no IP is found
};

const app = express();
const LOCAL_IP = getLocalIP();
const WEB_FRONT_PORT = process.env.WEB_FRONT_PORT || `http://localhost:8081`;
const WEB_BACK_PORT = process.env.WEB_BACK_PORT || `https://hotel-brasileiro-back-mobile.onrender.com/`;
const JWT_SECRET = process.env.JWT_SECRET;

// Middlewares
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));
app.use(cors({
  origin: '*', // Allow all origins for development
  exposedHeaders: ['Authorization']
}));

// Swagger documentation
const swaggerDocument = YAML.load(path.join(process.cwd(), 'docs', 'swagger.yaml'));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Login route
app.post('/api/login', async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ success: false, message: 'Email e senha são obrigatórios.' });
  }

  try {
    const [user] = await sql`
      SELECT * FROM clientes WHERE email = ${email};
    `;

    if (!user) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    const senhaValida = await bcrypt.compare(senha, user.senha);
    if (!senhaValida) {
      return res.status(401).json({ success: false, message: 'Credenciais inválidas.' });
    }

    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role
      },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({ success: true, token, role: user.role });
  } catch (error) {
    console.error('Erro ao realizar login:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
  }
});

// API routes
app.use('/api/quartos', quartosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/reservas', reservasRoutes);
app.use('/api/payments', payFlowRoutes);
app.use('/uploads', express.static('uploads'));

// Initialize the database
async function startdb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS clientes (
        id SERIAL PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        telefone VARCHAR(255) NOT NULL,
        senha VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'cliente' :: character varying,
        ft_perfil varchar(255),
        reset_token VARCHAR(4),
        reset_token_expiration TIMESTAMP
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS quartos (
        id SERIAL PRIMARY KEY,
        imagem_url VARCHAR(255),
        nome VARCHAR(255) NOT NULL,
        descricao VARCHAR(2555),
        preco DECIMAL(10,2) NOT NULL,
        quantidade INTEGER NOT NULL
      );
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS reservas (
        id SERIAL PRIMARY KEY,
        quarto_id INTEGER REFERENCES quartos(id),
        cliente_id INTEGER REFERENCES clientes(id),
        hospedes INTEGER NOT NULL,
        inicio DATE NOT NULL,
        fim DATE NOT NULL,
        preco_total DECIMAL(10,2),
        reservado_em TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) DEFAULT 'PENDING_PAYMENT',
        reference_id VARCHAR(255) UNIQUE
      );
    `;

    console.log('db conectada');
  } catch (error) {
    console.error('Erro ao conectar ao banco de dados:', error);
  }
}

// Start the server
startdb().then(() => {
  app.listen(3000, () => {
    console.log(`Servidor rodando na porta ${WEB_BACK_PORT}`);
  });
});