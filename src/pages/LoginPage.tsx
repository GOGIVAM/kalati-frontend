import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Eye, EyeOff, Lock, User } from 'lucide-react';
import { Segmented } from '@/components/common/Form';
import { useAuthStore } from '@/store/authStore';
import { ApiError } from '@/lib/httpClient';
import { setLocale } from '@/i18n';
import { useLocale } from '@/hooks/useLocale';
import type { Locale } from '@/types';
import './login.css';

/** Comptes fictifs servis par l'API simulée du build de démonstration. */
const DEMO_ACCOUNTS = [
  { matricule: 'AG-01001', label: 'Agent de maîtrise, maintenance' },
  { matricule: 'AU-02002', label: 'Auditeur' },
  { matricule: 'AD-03003', label: 'Administrateur' },
];

/** Décor géométrique du panneau gauche — purement ornemental. */
function PosterDecor() {
  return (
    <div className="kl-decor" aria-hidden="true">
      <span className="kl-ring kl-ring--tl" />
      <span className="kl-pill" />
      <span className="kl-ring kl-ring--sm" />
      <span className="kl-dot kl-dot--pale" />
      <span className="kl-ball kl-ball--a" />
      <span className="kl-ball kl-ball--b" />
      <span className="kl-ring kl-ring--br" />
    </div>
  );
}

export function LoginPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const location = useLocation();
  const status = useAuthStore((s) => s.status);
  const login = useAuthStore((s) => s.login);

  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const formColumn = useRef<HTMLElement | null>(null);

  // Si le panneau doit défiler, on amène le message d'erreur dans la vue.
  useEffect(() => {
    if (error && formColumn.current) {
      formColumn.current.scrollTop = formColumn.current.scrollHeight;
    }
  }, [error]);

  if (status === 'authenticated') {
    const from = (location.state as { from?: string } | null)?.from;
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />;
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(matricule.trim(), password, remember);
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 0) setError(t('auth.unreachable'));
        else if (cause.status === 401) setError(t('auth.failed'));
        else setError(`${cause.message || t('auth.failed')} (${cause.status} ${cause.code})`);
      } else {
        setError(t('auth.failed'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="kl-stage">
      <div className="kl-backdrop" aria-hidden="true">
        <span className="kl-backdrop__left" />
        <span className="kl-blob kl-blob--top" />
        <span className="kl-blob kl-blob--bottom" />
      </div>

      <div className="kl-card">
        <section className="kl-poster">
          <PosterDecor />
          <div className="kl-poster__content">
            <h1 className="kl-poster__title">
              <span>{t('auth.posterTitleLine1')}</span>
              <span className="kl-poster__title-sub">{t('auth.posterTitleLine2')}</span>
            </h1>
            <p className="kl-poster__body">{t('auth.posterBody')}</p>
          </div>
        </section>

        <section className="kl-form" ref={formColumn}>
          <div className="kl-form__top">
            <Segmented<Locale>
              value={locale}
              ariaLabel={t('nav.language')}
              options={[
                { value: 'fr', label: 'FR' },
                { value: 'en', label: 'EN' },
              ]}
              onChange={setLocale}
            />
          </div>

          <div className="kl-brand">
            <span className="kl-brand__tile">
              <img src="/logo.png" alt="KALATI" />
            </span>
            <p className="kl-brand__app">{t('app.tagline')}</p>
            <h2 className="kl-brand__welcome">{t('auth.welcome')}</h2>
            <p className="kl-brand__lead">{t('auth.lead')}</p>
          </div>

          <form className="kl-fields" onSubmit={submit}>
            <div className="kl-field">
              <label htmlFor="matricule">{t('auth.matricule')}</label>
              <div className="kl-input">
                <User size={17} className="kl-input__icon" aria-hidden="true" />
                <input
                  id="matricule"
                  value={matricule}
                  onChange={(event) => setMatricule(event.target.value)}
                  placeholder={t('auth.matriculePlaceholder')}
                  autoComplete="username"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div className="kl-field">
              <label htmlFor="password">{t('auth.password')}</label>
              <div className="kl-input">
                <Lock size={17} className="kl-input__icon" aria-hidden="true" />
                <input
                  id="password"
                  type={revealed ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="kl-input__reveal"
                  aria-label={revealed ? t('auth.hidePassword') : t('auth.showPassword')}
                  onClick={() => setRevealed((value) => !value)}
                >
                  {revealed ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="kl-row">
              <label className="kl-remember">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="kl-remember__box" aria-hidden="true" />
                {t('auth.remember')}
              </label>
              <span className="kl-reset" title={t('auth.resetHint')}>
                {t('auth.reset')}
              </span>
            </div>

            {error ? (
              <p className="kl-error" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="kl-submit" disabled={submitting}>
              <span>{submitting ? t('auth.submitting') : t('auth.submit')}</span>
              {submitting ? <span className="kl-submit__spin" aria-hidden="true" /> : null}
            </button>

            <p className="kl-foot">
              {t('auth.noAccount')} <strong>{t('auth.noAccountAction')}</strong>
            </p>

            <p className="kl-notice">{t('auth.notice')}</p>

            {import.meta.env.MODE === 'demo' ? (
              <div className="kl-demo" role="group" aria-label="Comptes de démonstration">
                <p className="kl-demo__title">Comptes de démonstration (fictifs)</p>
                {DEMO_ACCOUNTS.map((account) => (
                  <button
                    key={account.matricule}
                    type="button"
                    className="kl-demo__account"
                    onClick={() => {
                      setMatricule(account.matricule);
                      setPassword('demo');
                    }}
                  >
                    <strong>{account.matricule}</strong> · {account.label}
                  </button>
                ))}
                <p className="kl-demo__hint">
                  Simulation pédagogique : le moteur RAG est simulé dans le navigateur sur un
                  corpus fictif, ce n'est pas le modèle déployé.
                </p>
              </div>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}
