import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation } from '@tanstack/react-query';
import { Info, LogOut, Monitor, Moon, Sun, Trash2 } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { CheckChip, Segmented } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { Dialog } from '@/components/common/Dialog';
import { ErrorState } from '@/components/common/States';
import { Avatar } from '@/components/common/Avatar';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/authStore';
import { usePrefsStore, type Density, type TextSize } from '@/store/prefsStore';
import { useScopes } from '@/hooks/useConversations';
import { useTheme, type ThemeChoice } from '@/hooks/useTheme';
import { setLocale } from '@/i18n';
import { useLocale } from '@/hooks/useLocale';
import { env } from '@/lib/env';
import { formatDateTime } from '@/lib/format';
import type { Locale } from '@/types';

type TabKey = 'profile' | 'preferences' | 'appearance' | 'session' | 'account';

const TABS: TabKey[] = ['profile', 'preferences', 'appearance', 'session', 'account'];

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="k-toggle">
      <span className="k-toggle__text">
        <span className="k-toggle__label">{label}</span>
        {hint ? <span className="k-toggle__hint">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="k-toggle__track" aria-hidden="true" />
    </label>
  );
}

export function SettingsPage() {
  const { t } = useTranslation();
  const locale = useLocale();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const { scopes } = useScopes();
  const { theme, setTheme } = useTheme();
  const prefs = usePrefsStore();

  const [tab, setTab] = useState<TabKey>('profile');
  const [draftScopes, setDraftScopes] = useState<string[]>(user?.defaultScopes ?? []);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteAsked, setDeleteAsked] = useState(false);

  const save = useMutation({
    mutationFn: () => authService.updatePreferences({ locale, defaultScopes: draftScopes }),
    onSuccess: (updated) => setUser(updated),
  });

  if (!user) return null;

  const rows: [string, string][] = [
    [t('settings.fields.matricule'), user.matricule],
    [t('settings.fields.name'), user.fullName],
    [t('settings.fields.email'), user.email ?? t('common.none')],
    [t('settings.fields.grade'), `${user.grade} — ${user.gradeLabel}`],
    [t('settings.fields.department'), user.departmentLabel],
    [t('settings.fields.lastLogin'), formatDateTime(user.lastLoginAt, locale)],
  ];

  return (
    <AppShell>
      <div className="k-page">
        <PageHeader kicker={t('app.name')} title={t('settings.title')} lead={t('settings.lead')} />

        <div className="k-tabbar" role="tablist" aria-label={t('settings.title')}>
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={`k-tabbar__tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {t(`settings.tabs.${key}`)}
            </button>
          ))}
        </div>

        <div className="k-stack" style={{ maxWidth: 760 }}>
          {tab === 'profile' ? (
            <section className="k-stack">
              <div className="k-row">
                <Avatar size={56} />
                <div>
                  <h3>{user.fullName}</h3>
                  <p className="k-page__lead" style={{ marginTop: 2 }}>
                    {user.gradeLabel} · {user.departmentLabel}
                  </p>
                </div>
              </div>

              <div className="k-table-wrap">
                <table className="k-table">
                  <tbody>
                    {rows.map(([label, value]) => (
                      <tr key={label}>
                        <th style={{ width: 220 }}>{label}</th>
                        <td style={{ fontWeight: 600 }}>{value}</td>
                      </tr>
                    ))}
                    <tr>
                      <th>{t('settings.fields.roles')}</th>
                      <td>
                        <span className="k-row" style={{ gap: 'var(--space-1)' }}>
                          {user.roles.map((role) => (
                            <Tag key={role} tone="outline">
                              {role}
                            </Tag>
                          ))}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <th>{t('settings.fields.categories')}</th>
                      <td>
                        <span className="k-row" style={{ gap: 'var(--space-1)' }}>
                          {user.allowedCategories.length === 0 ? (
                            <span>{t('common.none')}</span>
                          ) : (
                            user.allowedCategories.map((code) => (
                              <Tag key={code} tone="accent">
                                {t(`scopes.${code}`, code)}
                              </Tag>
                            ))
                          )}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p className="k-notice">{t('settings.rbacNote')}</p>
            </section>
          ) : null}

          {tab === 'preferences' ? (
            <section className="k-stack">
              <div className="k-field">
                <label>{t('settings.language')}</label>
                <div>
                  <Segmented<Locale>
                    value={locale}
                    ariaLabel={t('settings.language')}
                    options={[
                      { value: 'fr', label: 'Français' },
                      { value: 'en', label: 'English' },
                    ]}
                    onChange={setLocale}
                  />
                </div>
              </div>

              <div className="k-field">
                <label>{t('settings.defaultScopes')}</label>
                <div className="k-scopes">
                  {scopes.map((scope) => (
                    <CheckChip
                      key={scope.code}
                      checked={draftScopes.includes(scope.code)}
                      label={t(`scopes.${scope.code}`, scope.label)}
                      onChange={(checked) =>
                        setDraftScopes((current) =>
                          checked
                            ? [...current, scope.code]
                            : current.filter((code) => code !== scope.code),
                        )
                      }
                    />
                  ))}
                </div>
              </div>

              <div className="k-stack" style={{ gap: 0 }}>
                <Toggle
                  label={t('settings.enterToSend')}
                  hint={t('settings.enterToSendHint')}
                  checked={prefs.enterToSend}
                  onChange={(value) => prefs.set('enterToSend', value)}
                />
                <Toggle
                  label={t('settings.autoOpenSources')}
                  hint={t('settings.autoOpenSourcesHint')}
                  checked={prefs.autoOpenSources}
                  onChange={(value) => prefs.set('autoOpenSources', value)}
                />
                <Toggle
                  label={t('settings.showQuality')}
                  hint={t('settings.showQualityHint')}
                  checked={prefs.showQuality}
                  onChange={(value) => prefs.set('showQuality', value)}
                />
              </div>

              <div className="k-row">
                <Button variant="primary" disabled={save.isPending} onClick={() => save.mutate()}>
                  {t('settings.save')}
                </Button>
                {save.isSuccess ? (
                  <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                    {t('settings.saved')}
                  </span>
                ) : null}
              </div>
              {save.isError ? <ErrorState error={save.error} /> : null}
            </section>
          ) : null}

          {tab === 'appearance' ? (
            <section className="k-stack">
              <div className="k-field">
                <label>{t('settings.theme')}</label>
                <div className="k-themes">
                  {(
                    [
                      ['light', Sun],
                      ['dark', Moon],
                      ['system', Monitor],
                    ] as [ThemeChoice, typeof Sun][]
                  ).map(([value, Icon]) => (
                    <button
                      key={value}
                      type="button"
                      className={`k-theme${theme === value ? ' is-active' : ''}`}
                      aria-pressed={theme === value}
                      onClick={() => setTheme(value)}
                    >
                      <Icon size={18} />
                      {t(`settings.themes.${value}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="k-field">
                <label>{t('settings.density')}</label>
                <div>
                  <Segmented<Density>
                    value={prefs.density}
                    ariaLabel={t('settings.density')}
                    options={[
                      { value: 'comfortable', label: t('settings.densities.comfortable') },
                      { value: 'compact', label: t('settings.densities.compact') },
                    ]}
                    onChange={(value) => prefs.set('density', value)}
                  />
                </div>
              </div>

              <div className="k-field">
                <label>{t('settings.textSize')}</label>
                <div>
                  <Segmented<TextSize>
                    value={prefs.textSize}
                    ariaLabel={t('settings.textSize')}
                    options={[
                      { value: 'small', label: t('settings.textSizes.small') },
                      { value: 'normal', label: t('settings.textSizes.normal') },
                      { value: 'large', label: t('settings.textSizes.large') },
                    ]}
                    onChange={(value) => prefs.set('textSize', value)}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {tab === 'session' ? (
            <section className="k-stack">
              <p className="k-row" style={{ fontSize: 'var(--text-sm)' }}>
                <Info size={15} />
                {t('settings.transport')} :{' '}
                <strong>
                  {env.authTransport === 'cookie'
                    ? t('settings.transportCookie')
                    : t('settings.transportHeader')}
                </strong>
              </p>

              <div className="k-table-wrap">
                <table className="k-table">
                  <tbody>
                    <tr>
                      <th style={{ width: 220 }}>{t('settings.fields.lastLogin')}</th>
                      <td>{formatDateTime(user.lastLoginAt, locale)}</td>
                    </tr>
                    <tr>
                      <th>{t('settings.apiBase')}</th>
                      <td className="k-mono">{env.apiUrl || t('settings.sameOrigin')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="k-row">
                <Button variant="secondary" onClick={() => void logout()}>
                  <LogOut size={15} />
                  {t('nav.logout')}
                </Button>
              </div>
            </section>
          ) : null}

          {tab === 'account' ? (
            <section className="k-stack">
              <div className="k-danger">
                <h3>{t('settings.deleteAccount')}</h3>
                <p className="k-page__lead">{t('settings.deleteAccountBody')}</p>
                <div className="k-row" style={{ marginTop: 'var(--space-3)' }}>
                  <Button variant="danger" onClick={() => setConfirmDelete(true)}>
                    <Trash2 size={15} />
                    {t('settings.deleteAccountAction')}
                  </Button>
                  {deleteAsked ? (
                    <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-success)' }}>
                      {t('settings.deleteAsked')}
                    </span>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}
        </div>

        <Dialog
          open={confirmDelete}
          title={t('settings.deleteAccount')}
          onClose={() => setConfirmDelete(false)}
          actions={
            <>
              <Button
                variant="danger"
                onClick={() => {
                  setConfirmDelete(false);
                  setDeleteAsked(true);
                }}
              >
                {t('settings.deleteAccountAction')}
              </Button>
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t('common.cancel')}
              </Button>
            </>
          }
        >
          <p>{t('settings.deleteAccountConfirm')}</p>
        </Dialog>
      </div>
    </AppShell>
  );
}
