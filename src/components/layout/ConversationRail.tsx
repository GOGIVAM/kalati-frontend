import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  History,
  MessageSquare,
  MessageSquarePlus,
  Pencil,
  ScrollText,
  LogOut,
  PanelLeft,
  Search,
  Settings,
  Star as StarIcon,
  Trash2,
  UserRound,
  Users,
  ChevronsUpDown,
} from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Form';
import { Dialog } from '@/components/common/Dialog';
import { Spinner } from '@/components/common/States';
import { Avatar } from '@/components/common/Avatar';
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from '@/hooks/useConversations';
import { useUiStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import type { Conversation, Role } from '@/types';

interface Tool {
  to: string;
  labelKey: string;
  icon: typeof MessageSquare;
  role?: Role;
}

const TOOLS: Tool[] = [
  { to: '/', labelKey: 'nav.chat', icon: MessageSquare },
  { to: '/historique', labelKey: 'nav.history', icon: History },
  { to: '/audit', labelKey: 'nav.audit', icon: ScrollText, role: 'AUDITEUR' },
  { to: '/administration', labelKey: 'nav.admin', icon: Users, role: 'ADMIN' },
  { to: '/parametres', labelKey: 'nav.settings', icon: Settings },
];

const FAV_KEY = 'kalati.favorites';

const readFavorites = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
};

export function ConversationRail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const railOpen = useUiStore((s) => s.railOpen);
  const collapsedPref = useUiStore((s) => s.railCollapsed);
  const toggleCollapsed = useUiStore((s) => s.toggleRailCollapsed);
  const collapsed = collapsedPref && !railOpen;
  const closeOverlays = useUiStore((s) => s.closeOverlays);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const roles = user?.roles ?? [];

  const [search, setSearch] = useState('');
  const [favorites, setFavorites] = useState<string[]>(readFavorites);
  const [renaming, setRenaming] = useState<Conversation | null>(null);
  const [deleting, setDeleting] = useState<Conversation | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [meOpen, setMeOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const meRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!meOpen) return;
    const onDown = (event: MouseEvent) => {
      if (!meRef.current?.contains(event.target as Node)) setMeOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [meOpen]);

  const activeId = location.pathname.startsWith('/c/') ? location.pathname.slice(3) : null;
  const { data, isPending } = useConversations(search || undefined);
  const rename = useRenameConversation();
  const remove = useDeleteConversation();

  useEffect(() => {
    try {
      localStorage.setItem(FAV_KEY, JSON.stringify(favorites));
    } catch {
      /* stockage indisponible : les favoris restent en mémoire */
    }
  }, [favorites]);

  /** Favoris d'abord, puis les plus récentes. */
  const items = useMemo(() => {
    const list = [...(data?.items ?? [])];
    list.sort((a, b) => {
      const fa = favorites.includes(a.id) ? 0 : 1;
      const fb = favorites.includes(b.id) ? 0 : 1;
      if (fa !== fb) return fa - fb;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
    return list;
  }, [data, favorites]);

  const toggleFavorite = (id: string) =>
    setFavorites((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );

  return (
    <aside
      className={`k-rail${railOpen ? ' is-open' : ''}${collapsed ? ' is-collapsed' : ''}`}
      aria-label={t('nav.conversations')}
    >
      <header className="k-rail__brand">
        {collapsed ? null : <img className="k-rail__logo" src="/logo.png" alt="KALATI" />}
        <button
          type="button"
          className="k-rail__collapse"
          aria-label={t('nav.conversations')}
          title={t('nav.conversations')}
          onClick={toggleCollapsed}
        >
          <PanelLeft size={17} />
        </button>
      </header>

      <div className="k-rail__new-wrap">
        <button
          type="button"
          className="k-rail__new"
          title={t('chat.newConversation')}
          onClick={() => {
            closeOverlays();
            navigate('/');
          }}
        >
          <MessageSquarePlus size={17} />
          {collapsed ? null : <span>{t('chat.newConversation')}</span>}
        </button>
      </div>

      <div className="k-rail__scroll" ref={listRef}>
        {collapsed ? null : <p className="k-rail__label">{t('nav.tools')}</p>}
        <nav className="k-rail__nav">
          {TOOLS.filter((tool) => !tool.role || roles.includes(tool.role)).map(
            ({ to, labelKey, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) => `k-rail__nav-item${isActive ? ' is-active' : ''}`}
                onClick={closeOverlays}
              >
                <Icon size={17} />
                {collapsed ? null : t(labelKey)}
              </NavLink>
            ),
          )}
        </nav>

        <hr className="k-rail__sep" />

        {collapsed ? null : (
          <div className="k-rail__list-head">
            <p className="k-rail__label">{t('nav.chatList')}</p>
          </div>
        )}

        <div className="k-rail__search">
          <Search size={14} aria-hidden="true" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('history.search')}
            aria-label={t('history.search')}
          />
        </div>

        {isPending ? (
          <div style={{ padding: 'var(--space-3)' }}>
            <Spinner label={t('common.loading')} />
          </div>
        ) : null}

        {!isPending && items.length === 0 ? (
          <p className="k-rail__empty">{t('history.empty')}</p>
        ) : null}

        <div className="k-rail__list">
          {items.map((conversation) => {
            const starred = favorites.includes(conversation.id);
            return (
              <div key={conversation.id} className="k-rail__row">
                <button
                  type="button"
                  className={`k-rail__item${conversation.id === activeId ? ' is-active' : ''}`}
                  onClick={() => {
                    closeOverlays();
                    navigate(`/c/${conversation.id}`);
                  }}
                >
                  <MessageSquare size={16} className="k-rail__item-icon" />
                  <span className="k-rail__item-title">{conversation.title}</span>
                </button>

                <span className="k-rail__actions">
                  <Button
                    variant="ghost"
                    icon
                    size="sm"
                    aria-label={t('common.rename')}
                    onClick={() => {
                      setRenaming(conversation);
                      setDraftTitle(conversation.title);
                    }}
                  >
                    <Pencil size={13} />
                  </Button>
                  <Button
                    variant="ghost"
                    icon
                    size="sm"
                    aria-label={t('common.delete')}
                    onClick={() => setDeleting(conversation)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </span>

                <button
                  type="button"
                  className={`k-rail__star${starred ? ' is-on' : ''}`}
                  aria-label={t('history.favorite')}
                  aria-pressed={starred}
                  onClick={() => toggleFavorite(conversation.id)}
                >
                  <StarIcon size={15} fill={starred ? 'currentColor' : 'none'} />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="k-rail__foot" ref={meRef}>
        {meOpen ? (
          <div className="k-menu" role="menu">
            <button
              type="button"
              className="k-menu__item"
              onClick={() => {
                setMeOpen(false);
                closeOverlays();
                navigate('/parametres');
              }}
            >
              <UserRound size={15} />
              {t('settings.profile')}
            </button>
            <button
              type="button"
              className="k-menu__item"
              onClick={() => {
                setMeOpen(false);
                closeOverlays();
                navigate('/parametres');
              }}
            >
              <Settings size={15} />
              {t('nav.settings')}
            </button>
            <button
              type="button"
              className="k-menu__item k-menu__item--danger"
              onClick={() => {
                setMeOpen(false);
                void logout();
              }}
            >
              <LogOut size={15} />
              {t('nav.logout')}
            </button>
          </div>
        ) : null}

        <button
          type="button"
          className={`k-rail__me${meOpen ? ' is-open' : ''}`}
          aria-haspopup="menu"
          aria-expanded={meOpen}
          title={user?.fullName ?? ''}
          onClick={() => setMeOpen((value) => !value)}
        >
          <Avatar size={collapsed ? 30 : 36} />
          {collapsed ? null : (
            <span className="k-rail__me-text">
              <span className="k-rail__me-line">
                <span className="k-rail__me-name">{user?.fullName ?? user?.matricule}</span>
                {user?.gradeLabel ? (
                  <span className="k-rail__me-tag">{user.gradeLabel}</span>
                ) : null}
              </span>
              <span className="k-rail__me-sub">{user?.email ?? user?.matricule}</span>
            </span>
          )}
          {collapsed ? null : <ChevronsUpDown size={15} className="k-rail__me-caret" />}
        </button>
      </div>

      <Dialog
        open={Boolean(renaming)}
        title={t('chat.renameTitle')}
        onClose={() => setRenaming(null)}
        actions={
          <>
            <Button
              variant="primary"
              disabled={!draftTitle.trim() || rename.isPending}
              onClick={() => {
                if (!renaming) return;
                rename.mutate(
                  { id: renaming.id, title: draftTitle.trim() },
                  { onSuccess: () => setRenaming(null) },
                );
              }}
            >
              {t('common.save')}
            </Button>
            <Button variant="ghost" onClick={() => setRenaming(null)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <Input
          value={draftTitle}
          onChange={(event) => setDraftTitle(event.target.value)}
          aria-label={t('chat.renameTitle')}
          autoFocus
        />
      </Dialog>

      <Dialog
        open={Boolean(deleting)}
        title={t('chat.deleteTitle')}
        onClose={() => setDeleting(null)}
        actions={
          <>
            <Button
              variant="danger"
              disabled={remove.isPending}
              onClick={() => {
                if (!deleting) return;
                remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
              }}
            >
              {t('common.delete')}
            </Button>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <p>{t('chat.deleteBody')}</p>
      </Dialog>
    </aside>
  );
}
