import { TOOLS } from './tools.js'
import { runBackup } from './backup.js'
import { sendDigestPushIfDue } from './digestPush.js'

// Serveur MCP distant (transport "Streamable HTTP") pour le dashboard L3
// Physique — expose en outils ce que l'app fait déjà (lire/modifier
// chapitres, partiels, devoirs) en parlant au même document Firestore
// partagé, sans rien dupliquer de la logique (reducer.js/badges.js/dates.js
// sont importés directement depuis le dépôt principal, cf. tools.js).
//
// Pas d'authentification par défaut — même choix assumé que pour le site
// lui-même (cf. README principal : données non sensibles, URL non indexée).
// Si un secret `MCP_TOKEN` est configuré (wrangler secret put MCP_TOKEN),
// il devient obligatoire (en-tête `Authorization: Bearer <token>`).

const PROTOCOL_VERSION = '2024-11-05'
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id',
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  })
}

function rpcError(id, code, message) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } }
}

function rpcResult(id, result) {
  return { jsonrpc: '2.0', id, result }
}

async function handleMessage(msg) {
  const { id, method, params } = msg ?? {}
  const isNotification = id === undefined

  if (method === 'initialize') {
    return rpcResult(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: 'l3-physique-dashboard', version: '1.0.0' },
    })
  }
  if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
    return null // notification : pas de réponse
  }
  if (method === 'ping') {
    return rpcResult(id, {})
  }
  if (method === 'tools/list') {
    return rpcResult(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    })
  }
  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) return rpcError(id, -32602, `Outil inconnu : ${params?.name}`)
    try {
      const result = await tool.handler(params?.arguments ?? {})
      return rpcResult(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
    } catch (err) {
      return rpcResult(id, {
        content: [{ type: 'text', text: `Erreur : ${err.message}` }],
        isError: true,
      })
    }
  }
  if (isNotification) return null
  return rpcError(id, -32601, `Méthode inconnue : ${method}`)
}

function isAuthorized(request, env) {
  if (!env.MCP_TOKEN) return true
  const auth = request.headers.get('Authorization') ?? ''
  return auth === `Bearer ${env.MCP_TOKEN}`
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS })
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, name: 'l3-physique-dashboard MCP server', endpoint: '/mcp' })
    }

    if (url.pathname !== '/mcp') {
      return json({ error: 'Not found' }, 404)
    }

    if (!isAuthorized(request, env)) {
      return json(rpcError(null, -32001, 'Non autorisé'), 401)
    }

    // Un client MCP peut ouvrir un flux SSE en GET pour des messages poussés
    // par le serveur — ce serveur n'en envoie jamais (rien à pousser), donc
    // 405 comme le permet la spec "Streamable HTTP" pour un serveur qui n'a
    // pas de flux serveur→client à offrir.
    if (request.method === 'GET') {
      return json({ error: 'Ce serveur ne pousse pas de messages ; utiliser POST.' }, 405)
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method not allowed' }, 405)
    }

    let body
    try {
      body = await request.json()
    } catch {
      return json(rpcError(null, -32700, 'JSON invalide'), 400)
    }

    const messages = Array.isArray(body) ? body : [body]
    const responses = (await Promise.all(messages.map(handleMessage))).filter(Boolean)

    if (responses.length === 0) return new Response(null, { status: 202, headers: CORS_HEADERS })
    return json(Array.isArray(body) ? responses : responses[0])
  },

  // Cron Trigger (voir wrangler.toml) — sauvegarde quotidienne et résumé
  // push, tous deux no-op tant que leurs variables ne sont pas configurées
  // (cf. backup.js / digestPush.js). Indépendants l'un de l'autre : un échec
  // sur l'un ne doit jamais empêcher l'autre.
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runBackup(env))
    ctx.waitUntil(sendDigestPushIfDue(env))
  },
}
