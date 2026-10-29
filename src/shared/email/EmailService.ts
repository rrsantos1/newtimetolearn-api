import { Resend } from "resend";
import { env } from "../config/env";

interface SendVerificationEmailInput {
  email: string;
  name: string;
  token: string;
}

interface SendPasswordResetEmailInput {
  email: string;
  name: string;
  token: string;
}

export class EmailService {  
  async sendVerificationEmail(
    input: SendVerificationEmailInput,
  ): Promise<void> {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não foi configurada.");
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const verificationUrl =
      `${env.FRONTEND_URL}/verify-email?token=${encodeURIComponent(input.token)}`;

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.email,
      subject: "Confirme seu e-mail — Timetolearn",
      text: [
        `Olá, ${input.name}!`,
        "",
        "Para confirmar seu endereço de e-mail, acesse o link:",
        verificationUrl,
        "",
        "Se você não criou uma conta, ignore esta mensagem.",
      ].join("\n"),
      html: `
        <h2>Bem-vindo ao Timetolearn!</h2>
        <p>Olá, ${input.name}.</p>
        <p>Confirme seu endereço de e-mail para ativar sua conta.</p>
        <p>
          <a href="${verificationUrl}">
            Confirmar meu e-mail
          </a>
        </p>
        <p>Se você não criou uma conta, ignore esta mensagem.</p>
      `,
    });

    if (error) {
      throw new Error("Não foi possível enviar o e-mail de confirmação.");
    }
  }

  async sendPasswordResetEmail(
    input: SendPasswordResetEmailInput,
  ): Promise<void> {
    if (!env.RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY não foi configurada.");
    }

    const resend = new Resend(env.RESEND_API_KEY);
    const resetUrl =
        `${env.FRONTEND_URL}/reset-password?token=${encodeURIComponent(input.token)}`;

    const { error } = await resend.emails.send({
      from: env.EMAIL_FROM,
      to: input.email,
      subject: "Redefinição de senha — Timetolearn",
      text: [
        `Olá, ${input.name}!`,
        "",
        "Para redefinir sua senha, acesse o link:",
        resetUrl,
        "",
        "Se você não criou uma conta, ignore esta mensagem.",
      ].join("\n"),
      html: `
        <h2>Redefinição de senha — Timetolearn</h2>
        <p>Olá, ${input.name}.</p>
        <p>Você pode redefinir sua senha clicando no link abaixo.</p>
        <p>
          <a href="${resetUrl}">
            Redefinir minha senha
          </a>
        </p>
        <p>Se você não solicitou a redefinição de senha, ignore esta mensagem.</p>
      `,
    });

    if (error) {
      throw new Error("Não foi possível enviar o e-mail de redefinição de senha.");
    }
  }
  
  async sendEmailChangeVerification(input: {
    email: string;
    name: string;
    token: string;
    }): Promise<void> {
    const confirmationUrl =
        `${env.FRONTEND_URL}/confirm-email-change?token=` +
        encodeURIComponent(input.token);

    const resend = new Resend(env.RESEND_API_KEY);

    try {
        await resend.emails.send({
        from: env.EMAIL_FROM,
        to: input.email,
        subject: "Confirme a alteração do seu e-mail",
        html: `
            <p>Olá, ${input.name}.</p>
            <p>Recebemos uma solicitação para alterar o e-mail da sua conta.</p>
            <p>
            <a href="${confirmationUrl}">Confirmar novo e-mail</a>
            </p>
            <p>Se você não solicitou essa alteração, ignore esta mensagem.</p>
        `,
        text: [
            `Olá, ${input.name}.`,
            "Recebemos uma solicitação para alterar o e-mail da sua conta.",
            `Confirme o novo endereço acessando: ${confirmationUrl}`,
            "Se você não solicitou essa alteração, ignore esta mensagem.",
        ].join("\n\n"),
        });
    } catch {
        throw new Error("EMAIL_SEND_FAILED");
    }
  }

}