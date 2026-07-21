'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { JazzMarkTrumpet } from '../common/JazzMarks';

interface FormErrors {
  name?: string;
  email?: string;
  subject?: string;
  message?: string;
}

export default function ContactForm() {
  const t = useTranslations('contact');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [serverError, setServerError] = useState<string | null>(null);

  // Email validation regex (RFC 5322)
  const isValidEmail = (val: string): boolean => {
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    return emailRegex.test(val);
  };

  // Field change handlers
  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (errors.name) {
      if (val.trim() && val.length <= 100) {
        setErrors((prev) => ({ ...prev, name: undefined }));
      }
    }
  };

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    if (errors.email) {
      if (val.trim() && val.length <= 254 && isValidEmail(val)) {
        setErrors((prev) => ({ ...prev, email: undefined }));
      }
    }
  };

  const handleSubjectChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSubject(val);
    if (errors.subject) {
      if (val.trim() && val.length <= 150) {
        setErrors((prev) => ({ ...prev, subject: undefined }));
      }
    }
  };

  const handleMessageChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (val.length <= 5000) {
      setMessage(val);
      if (errors.message) {
        if (val.trim() && val.length >= 10) {
          setErrors((prev) => ({ ...prev, message: undefined }));
        }
      }
    }
  };

  const handleEmailBlur = () => {
    if (email && !isValidEmail(email)) {
      setErrors((prev) => ({ ...prev, email: t('errorEmailInvalid') }));
    }
  };

  // Validation before submission
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!name.trim()) {
      newErrors.name = t('errorRequired');
    } else if (name.length > 100) {
      newErrors.name = t('errorMaxLengthName');
    }

    if (!email.trim()) {
      newErrors.email = t('errorRequired');
    } else if (email.length > 254) {
      newErrors.email = t('errorMaxLengthEmail');
    } else if (!isValidEmail(email)) {
      newErrors.email = t('errorEmailInvalid');
    }

    if (!subject.trim()) {
      newErrors.subject = t('errorRequired');
    } else if (subject.length > 150) {
      newErrors.subject = t('errorMaxLengthSubject');
    }

    if (!message.trim()) {
      newErrors.message = t('errorRequired');
    } else if (message.length < 10) {
      newErrors.message = t('errorMinLength');
    } else if (message.length > 5000) {
      newErrors.message = t('errorMaxLengthMessage');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Prevent submission if honeypot is filled (silently block or show validation error)
    if (honeypot.trim()) {
      setServerError(t('errorValidation'));
      setStatus('error');
      return;
    }

    if (!validateForm()) {
      setServerError(t('errorValidation'));
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setServerError(null);

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    try {
      const response = await fetch(`${API_BASE_URL}/contact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          subject,
          message,
          _hp: honeypot,
        }),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (response.status === 201) {
        setStatus('success');
      } else if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          setServerError(t('errorRateLimit', { seconds: retryAfter }));
        } else {
          setServerError(t('errorRateLimitGeneric'));
        }
        setStatus('error');
      } else if (response.status === 400) {
        setServerError(t('errorValidation'));
        setStatus('error');
      } else if (response.status === 503) {
        setServerError(t('errorServer'));
        setStatus('error');
      } else {
        setServerError(t('errorServer'));
        setStatus('error');
      }
    } catch (err) {
      console.error('Contact form submission error:', err);
      setServerError(t('errorServer'));
      setStatus('error');
    }
  };

  const handleReset = () => {
    setName('');
    setEmail('');
    setSubject('');
    setMessage('');
    setHoneypot('');
    setErrors({});
    setStatus('idle');
    setServerError(null);
  };

  if (status === 'success') {
    return (
      <div className="bg-jazz-dark/70 border border-jazz-slate p-8 md:p-12 rounded-2xl shadow-xl max-w-xl mx-auto text-center flex flex-col items-center gap-6 animate-fade-in">
        <div className="w-16 h-16 bg-jazz-gold/10 border border-jazz-gold rounded-full flex items-center justify-center text-jazz-gold">
          <JazzMarkTrumpet size={36} />
        </div>
        <div>
          <h3 className="text-2xl font-heading font-bold text-jazz-gold mb-2">
            {t('successTitle')}
          </h3>
          <p className="text-jazz-text-muted leading-relaxed">
            {t('successBody')}
          </p>
        </div>
        <button
          onClick={handleReset}
          className="mt-4 px-8 py-3 rounded-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold shadow-[0_0_15px_rgba(212,165,116,0.2)] hover:shadow-[0_0_25px_rgba(212,165,116,0.4)] transition-all duration-300 cursor-pointer"
        >
          {t('resetButton')}
        </button>
      </div>
    );
  }

  const remainingChars = 5000 - message.length;
  const showWarning = message.length >= 4500 && message.length < 5000;
  const isLimit = message.length === 5000;

  return (
    <div className="bg-jazz-dark/70 border border-jazz-slate p-6 md:p-10 rounded-2xl shadow-xl w-full max-w-2xl mx-auto relative group overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-jazz-gold to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="mb-8">
        <h3 className="text-2xl font-heading font-bold text-jazz-gold mb-2">
          {t('sectionTitle')}
        </h3>
        <p className="text-sm text-jazz-text-muted">
          {t('sectionSubtitle')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* Honeypot field */}
        <input
          type="text"
          name="_hp"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          style={{ display: 'none', visibility: 'hidden' }}
          tabIndex={-1}
          autoComplete="off"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name Field */}
          <div className="flex flex-col gap-2 align-start text-left">
            <label htmlFor="contact-name" className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
              {t('labelName')}
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={handleNameChange}
              placeholder={t('placeholderName')}
              maxLength={100}
              disabled={status === 'submitting'}
              className={`w-full bg-jazz-charcoal/50 border rounded-xl px-4 py-3 text-sm text-jazz-text focus:outline-none focus:border-jazz-gold focus:ring-1 focus:ring-jazz-gold/50 transition-all ${
                errors.name ? 'border-red-500/50 focus:border-red-500/50' : 'border-jazz-slate'
              }`}
            />
            {errors.name && (
              <span className="text-xs text-red-400 mt-1 font-mono">{errors.name}</span>
            )}
          </div>

          {/* Email Field */}
          <div className="flex flex-col gap-2 align-start text-left">
            <label htmlFor="contact-email" className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
              {t('labelEmail')}
            </label>
            <input
              id="contact-email"
              type="email"
              value={email}
              onChange={handleEmailChange}
              onBlur={handleEmailBlur}
              placeholder={t('placeholderEmail')}
              maxLength={254}
              disabled={status === 'submitting'}
              className={`w-full bg-jazz-charcoal/50 border rounded-xl px-4 py-3 text-sm text-jazz-text focus:outline-none focus:border-jazz-gold focus:ring-1 focus:ring-jazz-gold/50 transition-all ${
                errors.email ? 'border-red-500/50 focus:border-red-500/50' : 'border-jazz-slate'
              }`}
            />
            {errors.email && (
              <span className="text-xs text-red-400 mt-1 font-mono">{errors.email}</span>
            )}
          </div>
        </div>

        {/* Subject Field */}
        <div className="flex flex-col gap-2 align-start text-left">
          <label htmlFor="contact-subject" className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
            {t('labelSubject')}
          </label>
          <input
            id="contact-subject"
            type="text"
            value={subject}
            onChange={handleSubjectChange}
            placeholder={t('placeholderSubject')}
            maxLength={150}
            disabled={status === 'submitting'}
            className={`w-full bg-jazz-charcoal/50 border rounded-xl px-4 py-3 text-sm text-jazz-text focus:outline-none focus:border-jazz-gold focus:ring-1 focus:ring-jazz-gold/50 transition-all ${
              errors.subject ? 'border-red-500/50 focus:border-red-500/50' : 'border-jazz-slate'
            }`}
          />
          {errors.subject && (
            <span className="text-xs text-red-400 mt-1 font-mono">{errors.subject}</span>
          )}
        </div>

        {/* Message Field */}
        <div className="flex flex-col gap-2 align-start text-left">
          <div className="flex justify-between items-center">
            <label htmlFor="contact-message" className="text-xs font-mono uppercase tracking-wider text-jazz-text-dim">
              {t('labelMessage')}
            </label>
            {/* Character limit/warning */}
            {showWarning && (
              <span className="text-xs text-yellow-500 font-mono">
                {t('charCountWarning', { remaining: remainingChars })}
              </span>
            )}
            {isLimit && (
              <span className="text-xs text-red-400 font-mono">
                {t('charCountLimit')}
              </span>
            )}
          </div>
          <textarea
            id="contact-message"
            value={message}
            onChange={handleMessageChange}
            placeholder={t('placeholderMessage')}
            rows={5}
            maxLength={5000}
            disabled={status === 'submitting'}
            className={`w-full bg-jazz-charcoal/50 border rounded-xl px-4 py-3 text-sm text-jazz-text focus:outline-none focus:border-jazz-gold focus:ring-1 focus:ring-jazz-gold/50 transition-all resize-y min-h-[120px] ${
              errors.message ? 'border-red-500/50 focus:border-red-500/50' : 'border-jazz-slate'
            }`}
          />
          {errors.message && (
            <span className="text-xs text-red-400 mt-1 font-mono">{errors.message}</span>
          )}
        </div>

        {/* Server Response Error */}
        {serverError && (
          <div className="bg-red-950/20 border border-red-500/30 px-4 py-3 rounded-xl text-xs text-red-400 font-mono text-left">
            ⚠️ {serverError}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={status === 'submitting'}
          className="w-full md:w-auto self-end px-8 py-3 rounded-full bg-jazz-gold hover:bg-jazz-amber text-jazz-black font-semibold shadow-[0_0_15px_rgba(212,165,116,0.15)] hover:shadow-[0_0_25px_rgba(212,165,116,0.35)] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {status === 'submitting' ? t('submitting') : t('submit')}
        </button>
      </form>
    </div>
  );
}
