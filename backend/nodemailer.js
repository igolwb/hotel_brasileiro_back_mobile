import nodemailer from 'nodemailer';

// Função para enviar email de recuperação de senha ou confirmação de cadastro
// Exemplo: await sendTokenEmail(email, token, tipo)
const sendTokenEmail = async (email, token, tipo) => {
	const transporter = nodemailer.createTransport({
		host: 'smtp.gmail.com', // Use Gmail's SMTP host
		port: 465, // Use port 465 for SSL/TLS
		secure: true, // Use SSL/TLS
		auth: {
			user: process.env.EMAIL_USER,
			pass: process.env.EMAIL_PASS
		},
		connectionTimeout: 20000, // Increase timeout to 20 seconds
		debug: true, // Enable debug output
		logger: true // Enable logging
	});

	let subject, text;

	if (tipo === 'recuperacao') {
		subject = 'Recuperação de Senha - Hotel Brasileiro';
		text = `Seu código de recuperação é: ${token}`;
	} else if (tipo === 'confirmacao') {
		subject = 'Confirmação de Cadastro - Hotel Brasileiro';
		text = `Seu código de confirmação é: ${token}`;
	} else {
		throw new Error('Tipo de email inválido');
	}

	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject,
		text
	};

	await transporter.sendMail(mailOptions);
};

export default sendTokenEmail;
