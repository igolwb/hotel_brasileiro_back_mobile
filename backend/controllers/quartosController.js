import { sql } from "../config/db.js";

// Busca todos os quartos cadastrados, ordenados por id decrescente
export const buscarQuartos = async (req, res) => {
    try {
        const quartos = await sql`
        SELECT * FROM quartos
        ORDER BY id DESC
        `;

        console.log('[GET /quartos] Quartos encontrados:', quartos);
        res.status(200).json({ success: true, data: quartos });

    } catch (error) {
        console.error('[GET /quartos] Erro na função buscarQuartos:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Cria um novo quarto no banco de dados, validando campos obrigatórios
export const criarQuarto = async (req, res) => {
    const { imagem_url, nome, descricao, preco, quantidade } = req.body;

    if (!nome || !preco || !quantidade) {
        console.warn('[POST /quartos] Campos obrigatórios não preenchidos:', req.body);
        return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios!' });
    }

    try {
        const novoQuarto = await sql`
        INSERT INTO quartos (imagem_url, nome, descricao, preco, quantidade)
        VALUES (${imagem_url}, ${nome}, ${descricao}, ${preco}, ${quantidade})
        RETURNING *;
        `;
        console.log('[POST /quartos] Novo quarto criado:', novoQuarto);
        res.status(201).json({ success: true, data: novoQuarto[0] });

    } catch (error) {
        console.error('[POST /quartos] Erro na função criarQuarto:', error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Busca um quarto específico pelo id fornecido na URL
export const buscarQuartoId = async (req, res) => {
    const { id } = req.params;

    try {
        const quarto = await sql`
        SELECT * FROM quartos WHERE id = ${id}
        `;

        if (!quarto.length) {
            console.warn(`[GET /quartos/${id}] Quarto não encontrado.`);
            return res.status(404).json({ success: false, message: 'Quarto não encontrado' });
        }

        console.log(`[GET /quartos/${id}] Quarto encontrado:`, quarto[0]);
        res.status(200).json({ success: true, data: quarto[0] });
    } catch (error) {
        console.error(`[GET /quartos/${id}] Erro na função buscarQuartoId:`, error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Atualiza os dados de um quarto pelo id
export const atualizarQuarto = async (req, res) => {
    const { id } = req.params;
    const { imagem_url, nome, descricao, preco, quantidade } = req.body;

    try {
        const quartoAtualizado = await sql`
        UPDATE quartos
        SET imagem_url = ${imagem_url}, nome = ${nome}, descricao = ${descricao}, preco = ${preco}, quantidade = ${quantidade}
        WHERE id = ${id}
        RETURNING *;
        `;

        if (!quartoAtualizado.length) {
            console.warn(`[PUT /quartos/${id}] Quarto não encontrado para atualização.`);
            return res.status(404).json({ success: false, message: 'Quarto não encontrado' });
        }

        console.log(`[PUT /quartos/${id}] Quarto atualizado:`, quartoAtualizado[0]);
        res.status(200).json({ success: true, data: quartoAtualizado[0] });
    } catch (error) {
        console.error(`[PUT /quartos/${id}] Erro na função atualizarQuarto:`, error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};

// Deleta um quarto do banco de dados pelo id fornecido
export const deletarQuarto = async (req, res) => {
    const { id } = req.params;

    try {
        const quartoDeletado = await sql`
        DELETE FROM quartos WHERE id = ${id}
        RETURNING *;
        `;

        if (!quartoDeletado.length) {
            console.warn(`[DELETE /quartos/${id}] Quarto não encontrado para exclusão.`);
            return res.status(404).json({ success: false, message: 'Quarto não encontrado' });
        }

        console.log(`[DELETE /quartos/${id}] Quarto deletado:`, quartoDeletado[0]);
        res.status(200).json({
            success: true,
            data: quartoDeletado[0]
        });
    } catch (error) {
        console.error(`[DELETE /quartos/${id}] Erro na função deletarQuarto:`, error);
        res.status(500).json({ success: false, message: 'Erro interno no servidor' });
    }
};