import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config(); // Carrega as variáveis de ambiente do arquivo .env para process.env

const { PGHOST, PGUSER, PGPASSWORD, PGDATABASE } = process.env; // Desestrutura as variáveis de ambiente necessárias para a conexão com o banco de dados

// Conexão do banco de dados usando as variaveis declaradas no .env
export const sql= neon(
    `postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}/${PGDATABASE}?sslmode=require`
);
// essa função 'sql' permite que nós façamos operações sql no banco de dados, como consultas, inserções, atualizações e exclusões.