import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Função para enviar email de recuperação de senha
// Exemplo: await sendTokenEmail(email, token)
const sendTokenEmail = async (email, token, tipo) => {
	let subject, html;

	if (tipo === 'recuperacao') {
		subject = 'Recuperação de Senha - Hotel Brasileiro';
		html = `<p>Seu código de recuperação é: <strong>${token}</strong></p>`;
	} else if (tipo === 'confirmacao') {
		subject = 'Confirmação de Cadastro - Hotel Brasileiro';
		html = `<p>Seu código de confirmação é: <strong>${token}</strong></p>`;
	} else {
		throw new Error('Tipo de email inválido');
	}

	try {
		const { data, error } = await resend.emails.send({
			from: 'Resend <onboarding@resend.dev>',
			to: [email],
			subject,
			html,
		});

		if (error) {
			console.error('Erro ao enviar email:', error);
			throw new Error('Erro ao enviar email');
		}

		console.log('Email enviado com sucesso:', data);
	} catch (err) {
		console.error('Erro ao usar Resend API:', err);
		throw err;
	}
};

export default sendTokenEmail;
