import sendTokenEmail from '../nodemailer.js';
import bcrypt from 'bcrypt';
import { sql } from "../config/db.js";
import jwt from 'jsonwebtoken';

// Cria um novo cliente no banco de dados, realizando hash da senha e validando campos obrigatórios
export const criarCliente = async (req, res) => {
  const { nome, email, telefone, senha } = req.body;

  if (!nome || !email || !telefone || !senha) {
    console.warn('[POST /clientes] Campos obrigatórios não preenchidos:', req.body);
    return res.status(400).json({ success: false, message: 'Preencha todos os campos!' });
  }

  try {
    // Hash da senha antes de salvar
    const senhaHash = await bcrypt.hash(senha, 10);

    const novoCliente = await sql`
      INSERT INTO clientes (nome, email, telefone, senha)
      VALUES (${nome}, ${email}, ${telefone}, ${senhaHash})
      RETURNING id, nome, email, telefone;
    `;

    // Generate a JWT token with all user details
    const token = jwt.sign(
      {
        id: novoCliente[0].id,
        nome: novoCliente[0].nome,
        email: novoCliente[0].email,
        telefone: novoCliente[0].telefone
      },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    console.log('[POST /clientes] Novo cliente criado:', novoCliente[0]);
    res.status(201).json({ success: true, data: novoCliente[0], token });
  } catch (error) {
    console.error('[POST /clientes] Erro na função criarCliente:', error);

    // Código de erro para violação de unicidade no PostgreSQL
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'Email já cadastrado.'
      });
    }

    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
};

// Busca todos os clientes cadastrados, ordenados por id decrescente
export const buscarClientes = async(req, res) => {
    try {
        const clientes = await sql `
        SELECT * FROM clientes
        ORDER BY id DESC
        `;

        console.log('[GET /clientes] Clientes encontrados:', clientes);
        res.status(200).json({success: true , data: clientes});

    } catch (error) {
        console.error('[GET /clientes] Erro na função buscarClientes:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Upload de foto de perfil
export const atualizarFotoPerfil = async (req, res) => {
  const { id } = req.params;
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Nenhuma imagem enviada.' });
  }
  const imagePath = req.file.path; // e.g., 'uploads/profile_123.jpg'
  try {
    await sql`
      UPDATE clientes SET ft_perfil = ${imagePath} WHERE id = ${id}
    `;
    res.status(200).json({ success: true, ft_perfil: imagePath });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erro ao salvar imagem.' });
  }
};

// Busca todas as reservas de um cliente, incluindo o nome do quarto
export const buscarReservasCliente = async (req, res) => {
  const { id } = req.params;
  try {
    const reservas = await sql`
      SELECT r.*, q.nome AS quarto_nome
      FROM reservas r
      JOIN quartos q ON r.quarto_id = q.id
      WHERE r.cliente_id = ${id}
      ORDER BY r.inicio DESC
    `;
    res.status(200).json({ success: true, data: reservas });
  } catch (error) {
    console.error(`[GET /clientes/${id}/reservas] Erro:`, error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
};

// Busca um cliente específico pelo id fornecido na URL
export const buscarClienteId = async(req, res) => {
    const { id } = req.params;

    try {
        const cliente = await sql `
        SELECT * FROM clientes WHERE id =${id}
        `
        console.log(`[GET /clientes/${id}] Cliente encontrado:`, cliente[0]);
        res.status(200).json({ success: true, data: cliente[0] });
    } catch (error) {
        console.error(`[GET /clientes/${id}] Erro na função buscarClienteId:`, error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Atualiza os dados de um cliente pelo id, incluindo hash da nova senha se enviada
export const atualizarCliente = async(req, res) => {
  const { id } = req.params;
  const { nome, email, telefone, senha } = req.body;

  try {
    let clienteAtualizado;
    if (senha) {
      // Criptografa a senha se ela foi enviada
      const senhaHash = await bcrypt.hash(senha, 10);
      clienteAtualizado = await sql`
        UPDATE clientes SET nome = ${nome}, email = ${email}, telefone = ${telefone}, senha = ${senhaHash}
        WHERE id = ${id}
        RETURNING *
      `;
    } else {
      clienteAtualizado = await sql`
        UPDATE clientes SET nome = ${nome}, email = ${email}, telefone = ${telefone}
        WHERE id = ${id}
        RETURNING *
      `;
    }

    if (clienteAtualizado.length === 0) {
      console.warn(`[PUT /clientes/${id}] Cliente não encontrado para atualização.`);
      return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    }

    console.log(`[PUT /clientes/${id}] Cliente atualizado:`, clienteAtualizado[0]);
    res.status(200).json({ success: true, data: clienteAtualizado[0] });

  } catch (error) {
    console.error(`[PUT /clientes/${id}] Erro na função atualizarCliente:`, error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
};

// Deleta um cliente do banco de dados pelo id fornecido
export const deletarCliente = async(req, res) => {
    const { id } = req.params;

    try {
        const clienteDeletado = await sql `
        DELETE FROM clientes WHERE id = ${id}
        RETURNING *;
        `

        if(clienteDeletado.length === 0){
            console.warn(`[DELETE /clientes/${id}] Cliente não encontrado para exclusão.`);
            return res.status(404).json({success: false, message: 'cliente não encontrado'})
        }

        console.log(`[DELETE /clientes/${id}] Cliente deletado:`, clienteDeletado[0]);
        res.status(200).json({ 
            success: true, 
            data: clienteDeletado[0] 
        });
        
    } catch (error) {
        console.error(`[DELETE /clientes/${id}] Erro na função deletarCliente:`, error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
        
    }

};

// Busca os dados do cliente autenticado (usando o id do token), sem retornar a senha
export const buscarClienteMe = async (req, res) => {
  try {
    const userId = req.user.id;
    const cliente = await sql`
      SELECT id, nome, email, telefone, ft_perfil FROM clientes WHERE id = ${userId}
    `;
    if (!cliente[0]) {
      return res.status(404).json({ success: false, message: 'Cliente não encontrado' });
    }
    res.status(200).json({ success: true, data: cliente[0] });
  } catch (error) {
    console.error('[GET /clientes/me] Erro:', error);
    res.status(500).json({ success: false, message: 'Erro interno no servidor' });
  }
};

// Gera e envia token de recuperação de senha para o email do usuário
export const enviarTokenRecuperacao = async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'Email é obrigatório.' });
  }
  try {
    const [user] = await sql`SELECT * FROM clientes WHERE email = ${email}`;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Email não encontrado.' });
    }
    // Gerar token seguro de 4 caracteres (A-Z, 0-9)
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let token = '';
    for (let i = 0; i < 4; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Definir expiração para 1 hora a partir de agora
    const expiration = new Date(Date.now() + 60 * 60 * 1000); // 1 hora
    // Salvar token e expiração no banco
    await sql`
      UPDATE clientes SET reset_token = ${token}, reset_token_expiration = ${expiration}
      WHERE id = ${user.id}
    `;
    // Enviar email
    await sendTokenEmail(email, token, 'recuperacao');
    return res.status(200).json({ success: true, message: 'Token enviado para o email.' });
  } catch (error) {
    console.error('[POST /clientes/send-token] Erro ao enviar token:', error);
    return res.status(500).json({ success: false, message: 'Erro ao enviar token.' });
  }
};

// Verifica o token de recuperação de senha
export const verificarTokenRecuperacao = async (req, res) => {
  const { email, token } = req.body;
  if (!email || !token) {
    return res.status(400).json({ success: false, message: 'Email e token são obrigatórios.' });
  }
  try {
    const [user] = await sql`SELECT reset_token, reset_token_expiration FROM clientes WHERE email = ${email}`;
    if (!user || !user.reset_token || !user.reset_token_expiration) {
      return res.status(404).json({ success: false, message: 'Token não encontrado.' });
    }
    const now = new Date();
    const expiration = new Date(user.reset_token_expiration);
    if (user.reset_token !== token) {
      return res.status(401).json({ success: false, message: 'Código inválido.' });
    }
    if (now > expiration) {
      return res.status(401).json({ success: false, message: 'Código expirado. Solicite um novo.' });
    }
    return res.status(200).json({ success: true, message: 'Código válido.' });
  } catch (error) {
    console.error('[POST /clientes/send-token-verify] Erro ao verificar token:', error);
    return res.status(500).json({ success: false, message: 'Erro ao verificar token.' });
  }
};

// Redefinir senha usando email
export const redefinirSenhaPorEmail = async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) {
    return res.status(400).json({ success: false, message: 'Email e nova senha são obrigatórios.' });
  }
  try {
    const [user] = await sql`SELECT id FROM clientes WHERE email = ${email}`;
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }
    const senhaHash = await bcrypt.hash(senha, 10);
    await sql`UPDATE clientes SET senha = ${senhaHash}, reset_token = NULL, reset_token_expiration = NULL WHERE id = ${user.id}`;
    return res.status(200).json({ success: true, message: 'Senha redefinida com sucesso.' });
  } catch (err) {
    console.error('[POST /clientes/update-password] Erro ao redefinir senha:', err);
    return res.status(500).json({ success: false, message: 'Erro ao redefinir senha.' });
  }
};

// Sends a confirmation email with a unique code to the user
export const enviarCodigoConfirmacao = async (req, res) => {
  const { nome, email, telefone, senha } = req.body;

  if (!nome || !email || !telefone || !senha) {
    return res.status(400).json({ success: false, message: 'Preencha todos os campos!' });
  }

  try {
    // Generate a secure 6-character confirmation code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let confirmationCode = '';
    for (let i = 0; i < 6; i++) {
      confirmationCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Set expiration for 1 hour from now
    const expiration = new Date(Date.now() + 60 * 60 * 1000);

    // Save the confirmation code and expiration in the database
    await sql`
      INSERT INTO clientes_temp (nome, email, telefone, senha, confirmation_code, code_expiration)
      VALUES (${nome}, ${email}, ${telefone}, ${senha}, ${confirmationCode}, ${expiration})
    `;

    // Send the confirmation email
    await sendTokenEmail(email, confirmationCode, 'confirmacao');

    res.status(200).json({ success: true, message: 'Código de confirmação enviado para o email.' });
  } catch (error) {
    console.error('[POST /clientes/send-confirmation-code] Erro ao enviar código de confirmação:', error);
    res.status(500).json({ success: false, message: 'Erro ao enviar código de confirmação.' });
  }
};

// Verifies the confirmation code and completes user registration
export const confirmarCliente = async (req, res) => {
  const { nome, email, telefone, senha, confirmationCode } = req.body;

  if (!nome || !email || !telefone || !senha || !confirmationCode) {
    return res.status(400).json({ success: false, message: 'Preencha todos os campos!' });
  }

  try {
    // Retrieve the temporary user data
    const [tempUser] = await sql`
      SELECT * FROM clientes_temp WHERE email = ${email} AND confirmation_code = ${confirmationCode}
    `;

    if (!tempUser) {
      return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
    }

    // Check if the code is expired
    const now = new Date();
    if (now > new Date(tempUser.code_expiration)) {
      return res.status(400).json({ success: false, message: 'Código expirado.' });
    }

    // Hash the password
    const senhaHash = await bcrypt.hash(senha, 10);

    // Create the user in the main database
    const novoCliente = await sql`
      INSERT INTO clientes (nome, email, telefone, senha)
      VALUES (${nome}, ${email}, ${telefone}, ${senhaHash})
      RETURNING id, nome, email, telefone;
    `;

    // Delete the temporary user data
    await sql`
      DELETE FROM clientes_temp WHERE email = ${email};
    `;

    res.status(201).json({ success: true, data: novoCliente[0] });
  } catch (error) {
    console.error('[POST /clientes/confirm] Erro ao confirmar cliente:', error);
    res.status(500).json({ success: false, message: 'Erro ao confirmar cliente.' });
  }
};