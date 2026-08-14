import { env, usesCookieAuth } from './env';

export class ApiError extends Error {
  status: number;
  code: string;
  traceId?: string;
  fieldErrors?: Record<string, string>;

  constructor(
    status: number,
    code: string,
    message: string,
    extra?: { traceId?: string; fieldErrors?: Record<string, string> },
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.traceId = extra?.traceId;
    this.fieldErrors = extra?.fieldErrors;
  }
}

/* -------------------------------------------------------------------------
   Jeton d'accès

   Transport "header" : le JWT reste en mémoire du module — jamais dans
   localStorage ni sessionStorage (§ V.1 du cahier des charges). Au
   rechargement, la session est restaurée par GET /api/auth/me.
   Transport "cookie" : le frontend ne voit jamais le jeton.
   ------------------------------------------------------------------------- */

const TOKEN_KEY = 'kalati.token';

/* Transport "header" : le jeton est conservé pour la durée de l'onglet
   (sessionStorage), ou du navigateur si l'agent a coché « se souvenir de moi ».
   Sans cela, un simple rafraîchissement de page renvoie à l'écran de connexion,
   le backend n'ayant aucun cookie à présenter. */
const readStoredToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

let accessToken: string | null = usesCookieAuth ? null : readStoredToken();
let onUnauthorized: (() => void) | null = null;

export const setAccessToken = (token: string | null, persist = false) => {
  accessToken = token;
  if (usesCookieAuth) return;
  try {
    if (!token) {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    } else if (persist) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
    }
  } catch {
    /* stockage indisponible : la session ne survivra pas au rafraîchissement */
  }
};

export const getAccessToken = () => accessToken;

/** Appelé sur toute réponse 401 : permet au store d'auth de purger la session. */
export const setUnauthorizedHandler = (handler: (() => void) | null) => {
  onUnauthorized = handler;
};

const currentLocale = () =>
  (typeof document !== 'undefined' && document.documentElement.lang) || env.defaultLocale;

export const buildUrl = (path: string, query?: Record<string, unknown>) => {
  const base = env.apiUrl ? `${env.apiUrl}${path}` : path;
  if (!query) return base;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v) => params.append(key, String(v)));
    } else {
      params.set(key, String(value));
    }
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
};

export const authHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Accept-Language': currentLocale() };
  if (!usesCookieAuth && accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return headers;
};

export const credentialsMode: RequestCredentials = usesCookieAuth ? 'include' : 'same-origin';

const parseError = async (response: Response): Promise<ApiError> => {
  let code = `HTTP_${response.status}`;
  let message = response.statusText || 'Erreur réseau';
  let traceId: string | undefined;
  let fieldErrors: Record<string, string> | undefined;
  try {
    const body = await response.json();
    if (body && typeof body === 'object') {
      code = body.code ?? code;
      message = body.message ?? message;
      traceId = body.traceId;
      fieldErrors = body.fieldErrors;
    }
  } catch {
    /* corps non JSON : on garde le statut brut */
  }
  return new ApiError(response.status, code, message, { traceId, fieldErrors });
};

interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  signal?: AbortSignal;
  /** Ne déclenche pas la purge de session sur 401 (utile pour /auth/me). */
  silent401?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const isForm = options.body instanceof FormData;
  const headers: Record<string, string> = { Accept: 'application/json', ...authHeaders() };
  if (!isForm && options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      credentials: credentialsMode,
      signal: options.signal,
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  } catch (cause) {
    if ((cause as Error).name === 'AbortError') throw cause;
    throw new ApiError(0, 'NETWORK_UNREACHABLE', 'Service documentaire injoignable.');
  }

  if (response.status === 401 && !options.silent401) {
    setAccessToken(null);
    onUnauthorized?.();
  }

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return (await response.text()) as unknown as T;
  return (await response.json()) as T;
}

export const http = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, { ...options, body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, { ...options, body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, { ...options, body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>('DELETE', path, options),
};
