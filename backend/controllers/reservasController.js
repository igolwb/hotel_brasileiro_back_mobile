import { sql } from "../config/db.js";

// Busca todas as reservas cadastradas no banco de dados, ordenadas por id decrescente
export const buscarReservas = async (req, res) => {
  try {
    const reservas = await sql`
        SELECT * FROM reservas
        ORDER BY id DESC
        `;

    console.log("[GET /reservas] Reservas encontradas:", reservas);
    res.status(200).json({ success: true, data: reservas });
  } catch (error) {
    console.error("[GET /reservas] Erro na função buscarReservas:", error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor" });
  }
};

// Cria uma nova reserva, validando disponibilidade, datas e calculando o preço total
export const criarReserva = async (req, res) => {
  const { quarto_id, hospedes, inicio, fim } = req.body;
  const cliente_id = req.user.id; // PEGA DO TOKEN JWT

  if (!quarto_id || !cliente_id || !hospedes || !inicio || !fim) {
    return res.status(400).json({ error: "Todos os campos são obrigatórios" });
  }

  if (isNaN(quarto_id) || isNaN(cliente_id) || isNaN(hospedes)) {
    return res.status(400).json({ error: "IDs e número de hóspedes devem ser números" });
  }

  if (new Date(inicio) >= new Date(fim)) {
    return res.status(400).json({ error: "A data de início deve ser anterior à data de fim" });
  }

  // Nova validação: não permitir reservas no passado
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0); // Zera horas para comparar apenas a data
  const dataInicio = new Date(inicio);
  if (dataInicio < hoje) {
    return res.status(400).json({ error: "Não é possível fazer reservas no passado." });
  }

  try {
    // Verificar disponibilidade
    const disponibilidadeResult = await sql`
      SELECT 
        q.quantidade AS total_quartos,
        q.preco,
        COUNT(r.id) AS reservas_no_periodo
      FROM quartos q
      LEFT JOIN reservas r 
        ON r.quarto_id = q.id 
        AND (r.inicio <= ${fim} AND r.fim >= ${inicio})
      WHERE q.id = ${quarto_id}
      GROUP BY q.quantidade, q.preco;
    `;

    if (disponibilidadeResult.length === 0) {
      return res.status(404).json({ error: "Quarto não encontrado" });
    }

    const { total_quartos, reservas_no_periodo, preco } = disponibilidadeResult[0];

    if (reservas_no_periodo >= total_quartos) {
      return res.status(400).json({
        error: "Não há quartos disponíveis para este período",
      });
    }

    // Calcular número de diárias
    const dataInicio = new Date(inicio);
    const dataFim = new Date(fim);
    const diffTime = dataFim - dataInicio;
    const diarias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diarias <= 0) {
      return res.status(400).json({ error: "A data de fim deve ser após a data de início." });
    }

    // Calcular preço total
    const preco_total = Number(preco) * diarias;

      // Inserir reserva com preco_total e reservado_em
      const reservaResult = await sql`
        INSERT INTO reservas 
          (quarto_id, cliente_id, hospedes, inicio, fim, preco_total, reservado_em)
        VALUES 
          (${quarto_id}, ${cliente_id}, ${hospedes}, ${inicio}, ${fim}, ${preco_total}, NOW())
        RETURNING *;
      `;

    res.status(201).json({ success: true, data: reservaResult[0] });
  } catch (error) {
    console.error("Erro ao criar reserva:", error);
    res.status(500).json({ error: "Erro ao processar a reserva" });
  }
};

// Busca uma reserva específica pelo id fornecido na URL
export const buscarReservaId = async (req, res) => {
  const { id } = req.params;

  try {
    const reserva = await sql`
        SELECT * FROM reservas WHERE id = ${id}
        `;

    if (!reserva.length) {
      console.warn(`[GET /reservas/${id}] Reserva não encontrada.`);
      return res
        .status(404)
        .json({ success: false, message: "Reserva não encontrada" });
    }

    console.log(`[GET /reservas/${id}] Reserva encontrada:`, reserva[0]);
    res.status(200).json({ success: true, data: reserva[0] });
  } catch (error) {
    console.error(`[GET /reservas/${id}] Erro na função buscarReservaId:`, error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor" });
  }
};

// Atualiza os dados de uma reserva pelo id
export const atualizarReserva = async (req, res) => {
  const { id } = req.params;
  const { quarto_id, cliente_id, hospedes, inicio, fim } = req.body;

  try {
    const reservaAtualizada = await sql`
        UPDATE reservas
        SET quarto_id = ${quarto_id}, cliente_id = ${cliente_id}, hospedes = ${hospedes}, inicio = ${inicio}, fim = ${fim}
        WHERE id = ${id}
        RETURNING *;
        `;

    if (!reservaAtualizada.length) {
      console.warn(`[PUT /reservas/${id}] Reserva não encontrada para atualização.`);
      return res
        .status(404)
        .json({ success: false, message: "Reserva não encontrada" });
    }

    console.log(`[PUT /reservas/${id}] Reserva atualizada:`, reservaAtualizada[0]);
    res.status(200).json({ success: true, data: reservaAtualizada[0] });
  } catch (error) {
    console.error(`[PUT /reservas/${id}] Erro na função atualizarReserva:`, error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor" });
  }
};

// Deleta uma reserva do banco de dados pelo id fornecido
export const deletarReserva = async (req, res) => {
  const { id } = req.params;

  try {
    const reservaDeletada = await sql`
        DELETE FROM reservas WHERE id = ${id}
        RETURNING *;
        `;

    if (!reservaDeletada.length) {
      console.warn(`[DELETE /reservas/${id}] Reserva não encontrada para exclusão.`);
      return res
        .status(404)
        .json({ success: false, message: "Reserva não encontrada" });
    }

    console.log(`[DELETE /reservas/${id}] Reserva deletada:`, reservaDeletada[0]);
    res.status(200).json({
      success: true,
      data: reservaDeletada[0],
    });
  } catch (error) {
    console.error(`[DELETE /reservas/${id}] Erro na função deletarReserva:`, error);
    res
      .status(500)
      .json({ success: false, message: "Erro interno no servidor" });
  }
};

// Busca todas as reservas do usuário autenticado, trazendo informações do quarto
export async function getReservasUsuario(req, res) {
  try {
    const userId = req.user.id; // id do usuário extraído do token

    const reservas = await sql`
      SELECT
        r.id AS reserva_id,
        q.nome AS quarto_nome,
        q.imagem_url,
        q.descricao,
        r.inicio,
        r.fim,
        r.hospedes
      FROM reservas r
      JOIN quartos q ON r.quarto_id = q.id
      WHERE r.cliente_id = ${userId}
      ORDER BY r.inicio DESC;
    `;

    res.json(reservas);
  } catch (error) {
    console.error('Erro ao buscar reservas:', error);
    res.status(500).json({ error: 'Erro ao buscar reservas' });
  }
}


// Estatísticas de reservas: lucro total, lucro por período, receita mensal
export const getEstatisticasReservas = async (req, res) => {
  try {
    // Lucro total (toda a história)
    const [total] = await sql`SELECT COALESCE(SUM(preco_total), 0) AS total_profit FROM reservas`;

    // Lucro nos últimos 12 meses
    const [last12] = await sql`
      SELECT COALESCE(SUM(preco_total), 0) AS profit_12m
      FROM reservas
      WHERE reservado_em >= NOW() - INTERVAL '12 months'
    `;

    // Lucro nos últimos 6 meses
    const [last6] = await sql`
      SELECT COALESCE(SUM(preco_total), 0) AS profit_6m
      FROM reservas
      WHERE reservado_em >= NOW() - INTERVAL '6 months'
    `;

    // Lucro no último mês
    const [last1] = await sql`
      SELECT COALESCE(SUM(preco_total), 0) AS profit_1m
      FROM reservas
      WHERE reservado_em >= NOW() - INTERVAL '1 month'
    `;

      // Reservas acumuladas nos últimos 12 meses
      const [count12] = await sql`
        SELECT COUNT(*) AS reservas_12m
        FROM reservas
        WHERE reservado_em >= NOW() - INTERVAL '12 months'
      `;

      // Reservas acumuladas nos últimos 6 meses
      const [count6] = await sql`
        SELECT COUNT(*) AS reservas_6m
        FROM reservas
        WHERE reservado_em >= NOW() - INTERVAL '6 months'
      `;

      // Reservas acumuladas no último mês
      const [count1] = await sql`
        SELECT COUNT(*) AS reservas_1m
        FROM reservas
        WHERE reservado_em >= NOW() - INTERVAL '1 month'
      `;

    // Receita mensal dos últimos 12 meses + quantidade de reservas
    const monthly = await sql`
      SELECT
        TO_CHAR(reservado_em, 'YYYY-MM') AS month,
        COALESCE(SUM(preco_total), 0) AS income,
        COUNT(*) AS count
      FROM reservas
      WHERE reservado_em >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month
    `;

    res.json({
      total_profit: total.total_profit,
      profit_12m: last12.profit_12m,
      profit_6m: last6.profit_6m,
      profit_1m: last1.profit_1m,
    reservas_12m: count12.reservas_12m,
    reservas_6m: count6.reservas_6m,
    reservas_1m: count1.reservas_1m,
      monthly_income: monthly
    });
  } catch (error) {
    console.error('Erro ao buscar estatísticas:', error);
    res.status(500).json({ error: 'Erro ao buscar estatísticas' });
  }
}
