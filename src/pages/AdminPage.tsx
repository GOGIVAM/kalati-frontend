import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Search, UserX } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { RoleGate } from '@/components/auth/Guards';
import { PageHeader } from '@/components/common/PageHeader';
import { Button } from '@/components/common/Button';
import { Dialog } from '@/components/common/Dialog';
import { Field, Input, Segmented, Select } from '@/components/common/Form';
import { Tag } from '@/components/common/Tag';
import { Pagination } from '@/components/common/Pagination';
import { EmptyState, ErrorState, LoadingBlock } from '@/components/common/States';
import { adminService } from '@/services/admin.service';
import { qk } from '@/lib/queryClient';
import { useLocale } from '@/hooks/useLocale';
import { formatDateTime } from '@/lib/format';

type TabKey = 'agents' | 'grades' | 'departments' | 'categories';

function AgentsTab() {
  const { t } = useTranslation();
  const locale = useLocale();
  const client = useQueryClient();

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    matricule: '',
    fullName: '',
    email: '',
    grade: 1,
    department: '',
  });

  const filters = { page, pageSize: 20, search: search || undefined };
  const agents = useQuery({
    queryKey: qk.agents(filters),
    queryFn: () => adminService.agents(filters),
  });
  const departments = useQuery({
    queryKey: qk.departments,
    queryFn: () => adminService.departments(),
  });
  const grades = useQuery({ queryKey: qk.grades, queryFn: () => adminService.grades() });

  const invalidate = () => client.invalidateQueries({ queryKey: ['admin', 'agents'] });
  const create = useMutation({
    mutationFn: () => adminService.createAgent(draft),
    onSuccess: () => {
      setCreating(false);
      invalidate();
    },
  });
  const disable = useMutation({
    mutationFn: (id: string) => adminService.disableAgent(id),
    onSuccess: invalidate,
  });
  const reset = useMutation({ mutationFn: (id: string) => adminService.resetPassword(id) });

  return (
    <>
      <div className="k-row" style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ position: 'relative', minWidth: 280 }}>
          <Search
            size={14}
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--color-text-faint)',
            }}
          />
          <Input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder={t('admin.searchAgents')}
            aria-label={t('admin.searchAgents')}
            style={{ paddingLeft: 30 }}
          />
        </div>
        <span className="k-spacer" />
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} />
          {t('admin.newAgent')}
        </Button>
      </div>

      {agents.isPending ? <LoadingBlock /> : null}
      {agents.isError ? (
        <ErrorState error={agents.error} onRetry={() => void agents.refetch()} />
      ) : null}
      {agents.data && agents.data.items.length === 0 ? (
        <EmptyState title={t('admin.empty')} />
      ) : null}

      {agents.data && agents.data.items.length > 0 ? (
        <>
          <div className="k-table-wrap">
            <table className="k-table">
              <thead>
                <tr>
                  <th>{t('admin.columns.matricule')}</th>
                  <th>{t('admin.columns.name')}</th>
                  <th>{t('admin.columns.email')}</th>
                  <th>{t('admin.columns.grade')}</th>
                  <th>{t('admin.columns.department')}</th>
                  <th>{t('admin.columns.roles')}</th>
                  <th>{t('admin.columns.state')}</th>
                  <th>{t('admin.columns.lastLogin')}</th>
                  <th style={{ width: 100 }}>{t('admin.columns.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {agents.data.items.map((agent) => (
                  <tr key={agent.id}>
                    <td className="k-mono">{agent.matricule}</td>
                    <td style={{ fontWeight: 600 }}>{agent.fullName}</td>
                    <td>{agent.email ?? t('common.none')}</td>
                    <td className="k-num">{agent.grade}</td>
                    <td>{agent.department}</td>
                    <td>
                      <span className="k-row" style={{ gap: 'var(--space-1)' }}>
                        {agent.roles.map((role) => (
                          <Tag key={role} tone="outline">
                            {role}
                          </Tag>
                        ))}
                      </span>
                    </td>
                    <td>
                      <Tag tone={agent.enabled ? 'success' : 'neutral'}>
                        {agent.enabled ? t('admin.enabled') : t('admin.disabled')}
                      </Tag>
                    </td>
                    <td className="k-num">{formatDateTime(agent.lastLoginAt, locale)}</td>
                    <td>
                      <span className="k-row" style={{ gap: 0 }}>
                        <Button
                          variant="ghost"
                          icon
                          size="sm"
                          aria-label={t('admin.resetPassword')}
                          onClick={() => reset.mutate(agent.id)}
                        >
                          <KeyRound size={14} />
                        </Button>
                        <Button
                          variant="ghost"
                          icon
                          size="sm"
                          aria-label={t('admin.disable')}
                          onClick={() => disable.mutate(agent.id)}
                        >
                          <UserX size={14} />
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            page={agents.data.page}
            pageSize={agents.data.pageSize}
            total={agents.data.total}
            onChange={setPage}
          />
        </>
      ) : null}

      {reset.isSuccess ? <p className="k-notice">{t('admin.resetDone')}</p> : null}

      <Dialog
        open={creating}
        title={t('admin.newAgent')}
        onClose={() => setCreating(false)}
        actions={
          <>
            <Button
              variant="primary"
              disabled={!draft.matricule.trim() || !draft.fullName.trim() || create.isPending}
              onClick={() => create.mutate()}
            >
              {t('common.save')}
            </Button>
            <Button variant="ghost" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </Button>
          </>
        }
      >
        <div className="k-stack">
          <Field label={t('admin.columns.matricule')} htmlFor="new-matricule">
            <Input
              id="new-matricule"
              value={draft.matricule}
              onChange={(event) => setDraft({ ...draft, matricule: event.target.value })}
            />
          </Field>
          <Field label={t('admin.columns.name')} htmlFor="new-name">
            <Input
              id="new-name"
              value={draft.fullName}
              onChange={(event) => setDraft({ ...draft, fullName: event.target.value })}
            />
          </Field>
          <Field label={t('admin.columns.email')} htmlFor="new-email">
            <Input
              id="new-email"
              type="email"
              value={draft.email}
              onChange={(event) => setDraft({ ...draft, email: event.target.value })}
            />
          </Field>
          <div className="k-grid k-grid--2">
            <Field label={t('admin.columns.grade')} htmlFor="new-grade">
              <Select
                id="new-grade"
                value={String(draft.grade)}
                onChange={(event) => setDraft({ ...draft, grade: Number(event.target.value) })}
              >
                {(grades.data ?? []).map((grade) => (
                  <option key={grade.level} value={grade.level}>
                    {grade.level} — {grade.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.columns.department')} htmlFor="new-department">
              <Select
                id="new-department"
                value={draft.department}
                onChange={(event) => setDraft({ ...draft, department: event.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {(departments.data ?? []).map((department) => (
                  <option key={department.code} value={department.code}>
                    {department.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {create.isError ? <ErrorState error={create.error} /> : null}
        </div>
      </Dialog>
    </>
  );
}

function GradesTab() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState({ level: 1, label: '' });
  const grades = useQuery({ queryKey: qk.grades, queryFn: () => adminService.grades() });
  const create = useMutation({
    mutationFn: () => adminService.createGrade(draft),
    onSuccess: () => {
      setDraft({ level: 1, label: '' });
      client.invalidateQueries({ queryKey: qk.grades });
    },
  });

  return (
    <div className="k-stack">
      <div className="k-row" style={{ alignItems: 'flex-end' }}>
        <Field label={t('admin.columns.level')} htmlFor="grade-level">
          <Input
            id="grade-level"
            type="number"
            min={1}
            value={draft.level}
            style={{ width: 120 }}
            onChange={(event) => setDraft({ ...draft, level: Number(event.target.value) })}
          />
        </Field>
        <Field label={t('admin.columns.label')} htmlFor="grade-label">
          <Input
            id="grade-label"
            value={draft.label}
            style={{ width: 280 }}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        </Field>
        <Button variant="primary" disabled={!draft.label.trim()} onClick={() => create.mutate()}>
          <Plus size={16} />
          {t('admin.newGrade')}
        </Button>
      </div>

      {grades.isPending ? <LoadingBlock /> : null}
      {grades.isError ? (
        <ErrorState error={grades.error} onRetry={() => void grades.refetch()} />
      ) : null}

      {grades.data ? (
        <div className="k-table-wrap">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 120 }}>{t('admin.columns.level')}</th>
                <th>{t('admin.columns.label')}</th>
              </tr>
            </thead>
            <tbody>
              {grades.data.map((grade) => (
                <tr key={grade.level}>
                  <td className="k-num">{grade.level}</td>
                  <td style={{ fontWeight: 600 }}>{grade.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function DepartmentsTab() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState({ code: '', label: '' });
  const departments = useQuery({
    queryKey: qk.departments,
    queryFn: () => adminService.departments(),
  });
  const create = useMutation({
    mutationFn: () => adminService.createDepartment(draft),
    onSuccess: () => {
      setDraft({ code: '', label: '' });
      client.invalidateQueries({ queryKey: qk.departments });
    },
  });

  return (
    <div className="k-stack">
      <div className="k-row" style={{ alignItems: 'flex-end' }}>
        <Field label={t('admin.columns.code')} htmlFor="dep-code">
          <Input
            id="dep-code"
            value={draft.code}
            style={{ width: 200 }}
            onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label={t('admin.columns.label')} htmlFor="dep-label">
          <Input
            id="dep-label"
            value={draft.label}
            style={{ width: 280 }}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        </Field>
        <Button
          variant="primary"
          disabled={!draft.code.trim() || !draft.label.trim()}
          onClick={() => create.mutate()}
        >
          <Plus size={16} />
          {t('admin.newDepartment')}
        </Button>
      </div>

      {departments.isPending ? <LoadingBlock /> : null}
      {departments.data ? (
        <div className="k-table-wrap">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>{t('admin.columns.code')}</th>
                <th>{t('admin.columns.label')}</th>
              </tr>
            </thead>
            <tbody>
              {departments.data.map((department) => (
                <tr key={department.code}>
                  <td className="k-mono">{department.code}</td>
                  <td style={{ fontWeight: 600 }}>{department.label}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function CategoriesTab() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const [draft, setDraft] = useState({ code: '', label: '', gradeMin: 1 });
  const categories = useQuery({
    queryKey: qk.categories,
    queryFn: () => adminService.categories(),
  });
  const create = useMutation({
    mutationFn: () => adminService.createCategory(draft),
    onSuccess: () => {
      setDraft({ code: '', label: '', gradeMin: 1 });
      client.invalidateQueries({ queryKey: qk.categories });
    },
  });

  return (
    <div className="k-stack">
      <div className="k-row" style={{ alignItems: 'flex-end' }}>
        <Field label={t('admin.columns.code')} htmlFor="cat-code">
          <Input
            id="cat-code"
            value={draft.code}
            style={{ width: 200 }}
            onChange={(event) => setDraft({ ...draft, code: event.target.value.toUpperCase() })}
          />
        </Field>
        <Field label={t('admin.columns.label')} htmlFor="cat-label">
          <Input
            id="cat-label"
            value={draft.label}
            style={{ width: 260 }}
            onChange={(event) => setDraft({ ...draft, label: event.target.value })}
          />
        </Field>
        <Field label={t('admin.columns.gradeMin')} htmlFor="cat-grade">
          <Input
            id="cat-grade"
            type="number"
            min={1}
            value={draft.gradeMin}
            style={{ width: 140 }}
            onChange={(event) => setDraft({ ...draft, gradeMin: Number(event.target.value) })}
          />
        </Field>
        <Button
          variant="primary"
          disabled={!draft.code.trim() || !draft.label.trim()}
          onClick={() => create.mutate()}
        >
          <Plus size={16} />
          {t('admin.newCategory')}
        </Button>
      </div>

      {categories.isPending ? <LoadingBlock /> : null}
      {categories.data ? (
        <div className="k-table-wrap">
          <table className="k-table">
            <thead>
              <tr>
                <th style={{ width: 200 }}>{t('admin.columns.code')}</th>
                <th>{t('admin.columns.label')}</th>
                <th style={{ width: 160 }}>{t('admin.columns.gradeMin')}</th>
              </tr>
            </thead>
            <tbody>
              {categories.data.map((category) => (
                <tr key={category.code}>
                  <td className="k-mono">{category.code}</td>
                  <td style={{ fontWeight: 600 }}>{category.label}</td>
                  <td className="k-num">{category.gradeMin}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

function AdminContent() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<TabKey>('agents');

  return (
    <div className="k-page">
      <PageHeader kicker={t('app.name')} title={t('admin.title')} lead={t('admin.lead')} />

      <div style={{ marginBottom: 'var(--space-5)' }}>
        <Segmented<TabKey>
          value={tab}
          ariaLabel={t('admin.title')}
          options={[
            { value: 'agents', label: t('admin.tabs.agents') },
            { value: 'grades', label: t('admin.tabs.grades') },
            { value: 'departments', label: t('admin.tabs.departments') },
            { value: 'categories', label: t('admin.tabs.categories') },
          ]}
          onChange={setTab}
        />
      </div>

      {tab === 'agents' ? <AgentsTab /> : null}
      {tab === 'grades' ? <GradesTab /> : null}
      {tab === 'departments' ? <DepartmentsTab /> : null}
      {tab === 'categories' ? <CategoriesTab /> : null}
    </div>
  );
}

export function AdminPage() {
  return (
    <AppShell>
      <RoleGate role="ADMIN">
        <AdminContent />
      </RoleGate>
    </AppShell>
  );
}
