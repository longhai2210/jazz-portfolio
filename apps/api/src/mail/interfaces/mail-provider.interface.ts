export interface MailSendOptions {
  to: string;
  from: string;
  subject: string;
  text: string;
  html: string;
}

export interface MailProvider {
  send(options: MailSendOptions): Promise<void>;
}
