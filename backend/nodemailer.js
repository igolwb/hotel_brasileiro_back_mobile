import nodemailer from 'nodemailer';

// Função para enviar email de recuperação de senha
// Exemplo: await sendTokenEmail(email, token)
const sendTokenEmail = async (email, token) => {
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

	const mailOptions = {
		from: process.env.EMAIL_USER,
		to: email,
		subject: 'Recuperação de Senha - Hotel Brasileiro',
		text: `Seu código de recuperação é: ${token}`
	};

	await transporter.sendMail(mailOptions);
};

export default sendTokenEmail;
